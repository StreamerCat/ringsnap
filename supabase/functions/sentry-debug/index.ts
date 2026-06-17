import { createClient } from "supabase";
import { withSentryEdge } from "../_shared/sentry.ts";
import { corsHeaders } from "../_shared/cors.ts";

const ALLOWED_ROLES = ["platform_owner", "platform_admin"];

// This function is for staging validation only. 
// It forces an error to verify Sentry capture and context.
Deno.serve(withSentryEdge({ functionName: "sentry-debug" }, async (req, ctx) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    // ── Auth gate ──────────────────────────────────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
        return new Response(JSON.stringify({ error: "Missing authorization header" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
        authHeader.replace("Bearer ", "")
    );
    if (userError || !user) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const { data: staffRole } = await supabase
        .from("staff_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

    if (!staffRole || !ALLOWED_ROLES.includes(staffRole.role)) {
        return new Response(JSON.stringify({ error: "Forbidden: admin role required" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
    // ── End auth gate ──────────────────────────────────────────

    const url = new URL(req.url);
    const force = url.searchParams.get("force");

    if (force === "true") {
        throw new Error("FORCED_STAGING_ERROR: Sentry integration test");
    }

    return new Response(JSON.stringify({
        message: "Use ?force=true to trigger a Sentry event.",
        correlationId: ctx.correlationId
    }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
}));
