import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractCorrelationId, logInfo, logError } from "../_shared/logging.ts";

const FUNCTION_NAME = "capture-trial-lead";

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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { name, email, phone, source, step_reached } = await req.json();

    logInfo('Capturing trial lead', {
      ...baseLogOptions,
      context: { email, source, step_reached }
    });

    // Get client IP for tracking
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]
      || req.headers.get('cf-connecting-ip')
      || 'unknown';

    // Insert into trial_leads table (create if doesn't exist)
    const { data, error } = await supabase
      .from('trial_leads')
      .insert({
        name,
        email,
        phone,
        source: source || 'website',
        step_reached: step_reached || 'contact_info',
        ip_address: clientIP,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      // If table doesn't exist, log but don't fail
      if (error.message?.includes('relation') || error.message?.includes('does not exist')) {
        logInfo('trial_leads table not found - skipping lead capture', {
          ...baseLogOptions,
          context: { email }
        });
        return new Response(
          JSON.stringify({ success: true, message: 'Lead tracking not configured' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw error;
    }

    logInfo('Trial lead captured successfully', {
      ...baseLogOptions,
      context: { leadId: data?.id, email }
    });

    return new Response(
      JSON.stringify({ success: true, leadId: data?.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logError('Lead capture error', {
      ...baseLogOptions,
      error
    });

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
