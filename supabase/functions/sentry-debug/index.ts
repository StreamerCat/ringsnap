import { withSentryEdge } from "../_shared/sentry.ts";

// This function is for staging validation only. 
// It forces an error to verify Sentry capture and context.
Deno.serve(withSentryEdge({ functionName: "sentry-debug" }, async (req, ctx) => {
    const url = new URL(req.url);
    const force = url.searchParams.get("force");

    if (force === "true") {
        // Add extra context to verify sanitization
        const sensitiveData = {
            email: "test-user@example.com",
            token: "secret-token-123",
            payload: "safe-payload"
        };

        throw new Error(`FORCED_STAGING_ERROR: ${JSON.stringify(sensitiveData)}`);
    }

    return new Response(JSON.stringify({
        message: "Use ?force=true to trigger a Sentry event.",
        correlationId: ctx.correlationId
    }), {
        headers: { "Content-Type": "application/json" }
    });
}));
