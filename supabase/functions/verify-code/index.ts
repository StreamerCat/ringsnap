import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "supabase";
import { formatPhoneE164 } from "../_shared/validators.ts";
import { extractCorrelationId, logError } from "../_shared/logging.ts";

const FUNCTION_NAME = "verify-code";

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

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { phone, code } = await req.json();

    if (!phone || !code) {
      return new Response(
        JSON.stringify({ error: 'Phone and code are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const formattedPhone = formatPhoneE164(phone);

    // Fetch verification record
    const { data: verification, error: fetchError } = await supabase
      .from('phone_verifications')
      .select('*')
      .eq('phone', formattedPhone)
      .single();

    if (fetchError || !verification) {
      return new Response(
        JSON.stringify({ error: 'Verification code not found or expired' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if expired
    if (new Date(verification.expires_at) < new Date()) {
      await supabase
        .from('phone_verifications')
        .delete()
        .eq('phone', formattedPhone);
      
      return new Response(
        JSON.stringify({ error: 'Verification code expired' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if blocked (3+ failed attempts)
    if (verification.attempts >= 3) {
      return new Response(
        JSON.stringify({ error: 'Too many failed attempts. Request a new code.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify code
    if (verification.code !== code) {
      // Increment attempt counter
      await supabase
        .from('phone_verifications')
        .update({ attempts: verification.attempts + 1 })
        .eq('phone', formattedPhone);

      return new Response(
        JSON.stringify({ 
          error: 'Invalid verification code',
          attemptsRemaining: 3 - (verification.attempts + 1)
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Success - delete verification record
    await supabase
      .from('phone_verifications')
      .delete()
      .eq('phone', formattedPhone);

    return new Response(
      JSON.stringify({ 
        ok: true,
        message: 'Phone verified successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logError('Verify code error', {
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
