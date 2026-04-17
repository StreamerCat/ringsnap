const allowedOriginsEnv = Deno.env.get('ALLOWED_ORIGINS');
const resolvedOrigin = allowedOriginsEnv
  ? allowedOriginsEnv.split(',')[0].trim()
  : '*';

export const corsHeaders = {
  'Access-Control-Allow-Origin': resolvedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, PATCH, DELETE',
};

export const ALLOWED_ORIGINS: string[] = allowedOriginsEnv
  ? allowedOriginsEnv.split(',').map(o => o.trim()).filter(Boolean)
  : [];

/**
 * Returns CORS headers with the correct Allow-Origin for the given request origin.
 * Falls back to corsHeaders (first allowed origin or *) if origin is not in the allowlist.
 */
export function corsHeadersForOrigin(requestOrigin: string | null): typeof corsHeaders {
  if (!requestOrigin || ALLOWED_ORIGINS.length === 0) return corsHeaders;
  const matched = ALLOWED_ORIGINS.find(o => o === requestOrigin);
  if (!matched) return corsHeaders;
  return { ...corsHeaders, 'Access-Control-Allow-Origin': matched };
}
