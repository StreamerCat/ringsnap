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
      logError('Missing voice demo configuration', {
        ...baseLogOptions,
        error: new Error('Missing voice demo configuration values')
      });
      return new Response(
        JSON.stringify({ error: 'Voice demo service not configured' }),
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
    logError('Voice demo error', {
      ...baseLogOptions,
      error
    });
    const errorMessage = error instanceof Error ? error.message : 'Voice demo service error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
