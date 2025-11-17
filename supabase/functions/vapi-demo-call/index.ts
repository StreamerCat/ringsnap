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

    // Check for missing configuration and provide explicit details
    const requiredKeys = ['VAPI_PUBLIC_KEY', 'VAPI_DEMO_ASSISTANT_ID'];
    const missingKeys: string[] = [];

    if (!VAPI_PUBLIC_KEY) missingKeys.push('VAPI_PUBLIC_KEY');
    if (!VAPI_ASSISTANT_ID) missingKeys.push('VAPI_DEMO_ASSISTANT_ID');

    if (missingKeys.length > 0) {
      console.error('[Voice Demo] Missing configuration keys:', missingKeys);
      logError('Missing voice demo configuration', {
        ...baseLogOptions,
        error: new Error('Missing voice demo configuration values'),
        context: {
          missingKeys,
          requiredKeys
        }
      });
      return new Response(
        JSON.stringify({
          error: 'MissingConfig',
          message: 'Voice demo is not configured correctly. Please contact support.',
          missingKeys,
          details: 'Required environment variables are not set in Supabase Edge Function configuration.'
        }),
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
