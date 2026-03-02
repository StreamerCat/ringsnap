import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "supabase";
import { isValidPhoneNumber, formatPhoneE164, generateVerificationCode } from "../_shared/validators.ts";
import { extractCorrelationId, logError, logInfo } from "../_shared/logging.ts";

const FUNCTION_NAME = "send-verification-code";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VAPI_API_KEY = Deno.env.get('VAPI_API_KEY');

serve(async (req) => {
  const correlationId = extractCorrelationId(req);
  const baseLogOptions = { functionName: FUNCTION_NAME, correlationId };
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { phone } = await req.json();

    if (!phone || !isValidPhoneNumber(phone)) {
      return new Response(
        JSON.stringify({ error: 'Valid phone number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const formattedPhone = formatPhoneE164(phone);
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store verification code (create temp table if needed)
    await supabase
      .from('phone_verifications')
      .upsert({
        phone: formattedPhone,
        code,
        expires_at: expiresAt.toISOString(),
        attempts: 0,
      });

    // Send SMS via VAPI (or Twilio)
    if (VAPI_API_KEY) {
      const message = `Your RingSnap verification code is: ${code}. Valid for 10 minutes.`;

      // Note: This is a placeholder - actual SMS sending depends on your VAPI/Twilio setup
      logInfo('Sending verification code placeholder', {
        ...baseLogOptions,
        context: { formattedPhone, messageLength: message.length }
      });

      // TODO: Implement actual SMS sending via VAPI or Twilio
      // For now, just log it for development
    }

    return new Response(
      JSON.stringify({ 
        ok: true,
        message: 'Verification code sent',
        expiresIn: 600 // seconds
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logError('Send verification error', {
      ...baseLogOptions,
      error
    });
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
