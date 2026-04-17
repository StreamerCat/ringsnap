import { withSentryEdge } from "../_shared/sentry.ts";

// Staging-only: validates Sentry capture and context sanitization.
// Requires DEBUG_SECRET env var + x-debug-secret request header.
Deno.serve(withSentryEdge({ functionName: "sentry-debug" }, async (req, ctx) => {
    const debugSecret = Deno.env.get("DEBUG_SECRET");
    if (!debugSecret) {
        return new Response(JSON.stringify({ error: "Disabled in this environment" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
        });
    }
    const provided = req.headers.get("x-debug-secret");
    if (!provided || provided !== debugSecret) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    const url = new URL(req.url);
    const force = url.searchParams.get("force");

    if (force === "true") {
        throw new Error(`FORCED_STAGING_ERROR: sentry-debug trigger`);
    }

    return new Response(JSON.stringify({
        message: "Use ?force=true to trigger a Sentry event.",
        correlationId: ctx.correlationId
    }), {
        headers: { "Content-Type": "application/json" }
    });
}));
