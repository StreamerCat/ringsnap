import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "supabase";
import { extractCorrelationId, logError, logInfo, logWarn } from "../_shared/logging.ts";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const FUNCTION_NAME = "handle-referral-signup";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const correlationId = extractCorrelationId(req);
  const baseLogOptions = { functionName: FUNCTION_NAME, correlationId };
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let currentAccountId: string | null = null;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Define validation schema
    const referralSchema = z.object({
      referralCode: z.string().trim().min(1).max(50),
      refereeAccountId: z.string().uuid(),
      refereeEmail: z.string().email().max(255),
      refereePhone: z.string().min(1),
      refereeIP: z.string().max(45),
    });

    const rawData = await req.json();
    let validatedData;
    try {
      validatedData = referralSchema.parse(rawData);
    } catch (zodError: any) {
      return new Response(
        JSON.stringify({ error: 'Invalid input data', details: zodError.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { referralCode, refereeAccountId, refereeEmail, refereePhone, refereeIP } = validatedData;
    currentAccountId = refereeAccountId;

    // Find referrer
    const { data: referralCodeData } = await supabase
      .from('referral_codes')
      .select('account_id')
      .eq('code', referralCode)
      .maybeSingle();

    if (!referralCodeData) {
      logWarn('Invalid referral code', {
        ...baseLogOptions,
        accountId: currentAccountId,
        context: { referralCode }
      });
      return new Response(
        JSON.stringify({ error: 'Invalid referral code' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const referrerAccountId = referralCodeData.account_id;

    // Fraud detection checks
    let isFlagged = false;
    let flagReason = null;

    // Check if referee email domain matches referrer domain
    const { data: referrerAccount } = await supabase
      .from('accounts')
      .select('company_domain, signup_ip')
      .eq('id', referrerAccountId)
      .single();

    const refereeDomain = refereeEmail?.split('@')[1]?.toLowerCase();
    if (referrerAccount?.company_domain && refereeDomain === referrerAccount.company_domain) {
      isFlagged = true;
      flagReason = 'Same company domain as referrer';
    }

    // Check if IPs match (self-referral)
    if (referrerAccount?.signup_ip && refereeIP === referrerAccount.signup_ip) {
      isFlagged = true;
      flagReason = (flagReason ? flagReason + '; ' : '') + 'Same IP as referrer';
    }

    // Check if phone was already used in referrals
    if (refereePhone) {
      const { count } = await supabase
        .from('referrals')
        .select('*', { count: 'exact', head: true })
        .eq('referee_phone', refereePhone);

      if (count && count > 0) {
        isFlagged = true;
        flagReason = (flagReason ? flagReason + '; ' : '') + 'Phone used in previous referral';
      }
    }

    // Create referral record
    const { error: insertError } = await supabase
      .from('referrals')
      .insert({
        referrer_account_id: referrerAccountId,
        referee_account_id: refereeAccountId,
        referral_code: referralCode,
        referee_email: refereeEmail,
        referee_phone: refereePhone,
        referee_signup_ip: refereeIP,
        status: 'pending',
        is_flagged: isFlagged,
        flag_reason: flagReason,
      });

    if (insertError) {
      logError('Error creating referral', {
        ...baseLogOptions,
        accountId: currentAccountId,
        error: insertError,
        context: { referralCode }
      });
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logInfo('Referral created', {
      ...baseLogOptions,
      accountId: currentAccountId,
      context: {
        referrerAccountId,
        isFlagged,
        referralCode,
        flagReason
      }
    });

    return new Response(
      JSON.stringify({ 
        ok: true,
        isFlagged,
        message: 'Referral tracked successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logError('Handle referral error', {
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
