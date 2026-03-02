import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "supabase";
import { isValidZipCode } from "../_shared/validators.ts";
import { getAreaCodeFromZip } from "../_shared/area-code-lookup.ts";
import { extractCorrelationId, logError, logInfo } from "../_shared/logging.ts";

const FUNCTION_NAME = "complete-onboarding";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const correlationId = extractCorrelationId(req);
  const baseLogOptions = { functionName: FUNCTION_NAME, correlationId };
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let currentAccountId: string | null = null;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Get auth user from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get authenticated user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      logError('Auth error during onboarding completion', {
        ...baseLogOptions,
        error: userError
      });
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      areaCode,
      selectedNumber,
      companyName,
      trade,
      assistantGender,
      defaultAvailability,
      connectCalendar,
      referralCode,
      timezone,
      skipOnboarding,
      accountId: passedAccountId
    } = await req.json();

    // Get user's profile to find account_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('account_id, name, phone')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      logError('Profile fetch error during onboarding completion', {
        ...baseLogOptions,
        error: profileError
      });
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accountId = passedAccountId || profile.account_id;
    currentAccountId = accountId;

    // SECURITY: Ensure user owns the account they are trying to access
    // We enforce strict ownership: profile.account_id MUST match the target accountId
    // This prevents any user from completing onboarding for another account
    if (accountId !== profile.account_id) {
      logError('Unauthorized onboarding completion attempt for different account', {
        ...baseLogOptions,
        accountId,
        profileAccountId: profile.account_id
      });
      return new Response(
        JSON.stringify({ error: 'Unauthorized attempt' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SKIP MODE: Bypass all validations and just mark onboarding complete
    if (skipOnboarding === true) {
      logInfo('Skip onboarding mode activated', {
        ...baseLogOptions,
        accountId
      });

      // Set onboarding_completed_at without modifying other fields
      const { error: skipError } = await supabase
        .from('accounts')
        .update({
          onboarding_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', accountId);

      if (skipError) {
        logError('Failed to skip onboarding', {
          ...baseLogOptions,
          accountId,
          error: skipError
        });
        return new Response(
          JSON.stringify({ error: 'Failed to skip onboarding' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Log skip event
      await supabase.from('onboarding_events').insert({
        account_id: accountId,
        user_id: user.id,
        step: 'complete',
        status: 'skipped',
        metadata: { reason: 'user_skip' }
      });

      return new Response(
        JSON.stringify({
          ok: true,
          message: 'Onboarding skipped successfully.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate required fields (only for normal flow)
    if (!areaCode || !selectedNumber || !companyName || !trade || !assistantGender) {
      return new Response(
        JSON.stringify({ error: 'Area code, phone number, company name, trade, and assistant voice are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }


    // Validate area code format
    if (!/^\d{3}$/.test(areaCode)) {
      return new Response(
        JSON.stringify({ error: 'Invalid area code format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logInfo('Using selected phone number and company details', {
      ...baseLogOptions,
      context: { areaCode, selectedNumber, companyName }
    });

    // Note: profile and accountId already fetched above (before skip mode check)


    // Update account with setup data
    const updateData: Record<string, unknown> = {
      trade: trade,
      company_name: companyName,
      assistant_gender: assistantGender,
      phone_number_area_code: areaCode,
      provisioning_status: 'provisioning',
      updated_at: new Date().toISOString(),
      timezone: timezone || 'America/Denver', // Use passed timezone or fallback
      onboarding_completed_at: new Date().toISOString()
    };

    // Add optional fields if provided
    if (defaultAvailability) {
      updateData.custom_instructions = defaultAvailability;
    }

    const { error: updateError } = await supabase
      .from('accounts')
      .update(updateData)
      .eq('id', accountId);

    if (updateError) {
      logError('Account update error during onboarding completion', {
        ...baseLogOptions,
        accountId,
        error: updateError
      });
      return new Response(
        JSON.stringify({ error: 'Failed to update account' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logInfo('Account updated successfully', {
      ...baseLogOptions,
      accountId
    });

    // Handle referral code if provided
    if (referralCode) {
      const { data: referralCodeData } = await supabase
        .from('referral_codes')
        .select('account_id')
        .eq('code', referralCode)
        .maybeSingle();

      if (referralCodeData) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('phone, email:id')
          .eq('id', user.id)
          .single();

        if (profileData) {
          // Get client IP
          const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0] ||
            req.headers.get('cf-connecting-ip') ||
            'unknown';

          await supabase.from('referrals').insert({
            referrer_account_id: referralCodeData.account_id,
            referee_account_id: accountId,
            referral_code: referralCode,
            referee_email: user.email,
            referee_phone: profileData.phone,
            referee_signup_ip: clientIP,
            status: 'pending',
          });
          logInfo('Referral created for onboarding account', {
            ...baseLogOptions,
            accountId,
            context: {
              referralCode,
              referrerAccountId: referralCodeData.account_id
            }
          });
        }
      }
    }

    // Trigger provisioning (call provision-resources function)
    try {
      const { error: provisionError } = await supabase.functions.invoke('provision-resources', {
        body: {
          accountId,
          email: user.email,
          name: profile.name,
          phone: profile.phone,
          selectedNumber,
          companyName,
          defaultAvailability: defaultAvailability || null
        }
      });

      if (provisionError) {
        logError('Provisioning invocation error', {
          ...baseLogOptions,
          accountId,
          error: provisionError
        });
        // Update provisioning status to failed
        await supabase
          .from('accounts')
          .update({
            provisioning_status: 'failed',
            provisioning_error: provisionError.message
          })
          .eq('id', accountId);

        return new Response(
          JSON.stringify({ error: 'Failed to start provisioning' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      logInfo('Provisioning triggered successfully', {
        ...baseLogOptions,
        accountId
      });
    } catch (provisionError) {
      logError('Provisioning error while invoking function', {
        ...baseLogOptions,
        accountId,
        error: provisionError
      });
      await supabase
        .from('accounts')
        .update({
          provisioning_status: 'failed',
          provisioning_error: provisionError instanceof Error ? provisionError.message : 'Unknown error'
        })
        .eq('id', accountId);

      return new Response(
        JSON.stringify({ error: 'Failed to provision resources' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        message: 'Onboarding complete. Resources are being provisioned.'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logError('Complete onboarding error', {
      ...baseLogOptions,
      accountId: currentAccountId,
      error
    });
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
