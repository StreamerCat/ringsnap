import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { extractCorrelationId, logError } from '../_shared/logging.ts';

const FUNCTION_NAME = 'vapi-demo-call';

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

  try {
    const VAPI_PUBLIC_KEY = Deno.env.get('VAPI_PUBLIC_KEY');
    const VAPI_ASSISTANT_ID = Deno.env.get('VAPI_DEMO_ASSISTANT_ID');

    if (!VAPI_PUBLIC_KEY || !VAPI_ASSISTANT_ID) {
      logError('Missing VAPI configuration', {
        ...baseLogOptions,
        error: new Error('Missing VAPI configuration values')
      });
      return new Response(
        JSON.stringify({ error: 'VAPI not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        publicKey: VAPI_PUBLIC_KEY,
        assistantId: VAPI_ASSISTANT_ID
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logError('VAPI demo call error', {
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
