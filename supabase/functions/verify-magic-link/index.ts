import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "supabase";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const body = await req.json().catch(() => ({}));
    const { token } = body || {};

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing token" }), { status: 400, headers: jsonHeaders });
    }

    const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: "email",
    });

    if (verifyError || !verifyData.session || !verifyData.user) {
      console.error("[verify-magic-link] verifyOtp error:", verifyError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired magic link" }),
        { status: 401, headers: jsonHeaders }
      );
    }

    // Return session + user to the client; the client will call supabase.auth.setSession(...)
    return new Response(
      JSON.stringify({
        success: true,
        session: {
          access_token: verifyData.session.access_token,
          refresh_token: verifyData.session.refresh_token,
        },
        user: { id: verifyData.user.id, email: verifyData.user.email },
      }),
      { status: 200, headers: jsonHeaders }
    );
  } catch (err: any) {
    console.error("[verify-magic-link] unexpected error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Unexpected error" }), { status: 500, headers: jsonHeaders });
  }
});
