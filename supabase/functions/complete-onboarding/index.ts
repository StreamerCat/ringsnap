import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isValidZipCode } from "../_shared/validators.ts";
import { getAreaCodeFromZip } from "../_shared/area-code-lookup.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { zipCode, trade, assistantGender, referralCode } = await req.json();

    // Validate required fields
    if (!zipCode || !trade || !assistantGender) {
      return new Response(
        JSON.stringify({ error: 'ZIP code, trade, and assistant voice are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate ZIP code format
    if (!isValidZipCode(zipCode)) {
      return new Response(
        JSON.stringify({ error: 'Invalid ZIP code format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get area code from ZIP
    const areaCode = getAreaCodeFromZip(zipCode);
    console.log(`ZIP ${zipCode} mapped to area code ${areaCode}`);

    // Get user's profile to find account_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError);
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accountId = profile.account_id;

    // Update account with setup data
    const { error: updateError } = await supabase
      .from('accounts')
      .update({
        zip_code: zipCode,
        trade: trade,
        assistant_gender: assistantGender,
        phone_number_area_code: areaCode,
        provisioning_status: 'provisioning',
        updated_at: new Date().toISOString()
      })
      .eq('id', accountId);

    if (updateError) {
      console.error('Account update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update account' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Account updated successfully:', accountId);

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
          console.log('Referral created for code:', referralCode);
        }
      }
    }

    // Trigger provisioning (call provision-resources function)
    try {
      const { error: provisionError } = await supabase.functions.invoke('provision-resources', {
        body: { accountId }
      });

      if (provisionError) {
        console.error('Provisioning invocation error:', provisionError);
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

      console.log('Provisioning triggered successfully for account:', accountId);
    } catch (provisionError) {
      console.error('Provisioning error:', provisionError);
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
    console.error('Complete onboarding error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
