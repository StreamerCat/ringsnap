import { corsHeaders } from '../_shared/cors.ts';

// This one-off development utility must never delete production users.
Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  return new Response(JSON.stringify({ error: 'Database cleanup endpoint has been retired' }), {
    status: 410,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
