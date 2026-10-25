import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'supabase';
import { authorizePlatformStaff } from '../_shared/staff-authorization.ts';
import { withSentryEdge } from "../_shared/sentry.ts";

// This function is for staging validation only. 
// It forces an error to verify Sentry capture and context.
Deno.serve(withSentryEdge({ functionName: "sentry-debug" }, async (req, ctx) => {
    if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const denial = await authorizePlatformStaff(req, authClient);
    if (denial) return denial;

    const url = new URL(req.url);
    const force = url.searchParams.get("force");

    if (force === "true") {
        throw new Error('FORCED_STAGING_ERROR');
    }

    return new Response(JSON.stringify({
        message: "Use ?force=true to trigger a Sentry event.",
        correlationId: ctx.correlationId
    }), {
        headers: { "Content-Type": "application/json" }
    });
}));
