import { serve } from "std/server";
import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";
import { hashToken, isUserNotFoundError } from "../_shared/auth-utils.ts";

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
    const { token, deviceNonce } = body || {};

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing token" }), { status: 400, headers: jsonHeaders });
    }

    // Use SHA256 to match send-magic-link hashing (fixes token mismatch bug)
    const tokenHash = await hashToken(token);
    const nowIso = new Date().toISOString();

    // Device clause: if deviceNonce provided, allow stored device_nonce NULL or equal to provided
    const deviceOrClause = deviceNonce ? `device_nonce.is.null,device_nonce.eq.${deviceNonce}` : `device_nonce.is.null`;

    // Atomically mark token used and return the consumed row
    const { data: consumedRow, error: updateError } = await supabase
      .from("auth_tokens")
      .update({ used_at: nowIso })
      .match({ token_hash: tokenHash, token_type: "magic_link" })
      .is("used_at", null)
      .gt("expires_at", nowIso)
      .or(deviceOrClause)
      .select("*")
      .limit(1)
      .maybeSingle();

    if (updateError) {
      console.error("[verify-magic-link] DB update error:", updateError);
      return new Response(JSON.stringify({ error: "Failed to validate token" }), { status: 500, headers: jsonHeaders });
    }

    if (!consumedRow) {
      // token invalid/expired/consumed or device mismatch
      return new Response(JSON.stringify({ error: "Invalid or expired magic link" }), { status: 401, headers: jsonHeaders });
    }

    const email = consumedRow.email;
    if (!email) {
      return new Response(JSON.stringify({ error: "Token missing email" }), { status: 500, headers: jsonHeaders });
    }

    // Find existing auth user or create
    const { data: userLookup, error: userLookupError } = await supabase.auth.admin.getUserByEmail(email);
    if (userLookupError && !isUserNotFoundError(userLookupError)) {
      console.error("[verify-magic-link] getUserByEmail error:", userLookupError);
      return new Response(JSON.stringify({ error: "Failed to verify user" }), { status: 500, headers: jsonHeaders });
    }

    let userId: string;
    if (userLookup?.user) {
      userId = userLookup.user.id;
    } else {
      const createResp = await supabase.auth.admin.createUser({ email, email_confirm: true, user_metadata: { email_verified: true } });
      if (createResp.error || !createResp.data?.user) {
        console.error("[verify-magic-link] createUser error:", createResp.error);
        return new Response(JSON.stringify({ error: "Failed to create user" }), { status: 500, headers: jsonHeaders });
      }
      userId = createResp.data.user.id;
      // small delay for triggers if needed
      await new Promise((res) => setTimeout(res, 300));
    }

    // Create a temporary password, set it, sign in to obtain session tokens
    const tempPassword = randomHex(32);
    const updatePw = await supabase.auth.admin.updateUserById(userId, { password: tempPassword });
    if (updatePw.error) {
      console.error("[verify-magic-link] updateUserById error:", updatePw.error);
      return new Response(JSON.stringify({ error: "Failed to create session" }), { status: 500, headers: jsonHeaders });
    }

    const signInResp = await supabase.auth.signInWithPassword({ email, password: tempPassword });
    if (signInResp.error || !signInResp.data?.session) {
      console.error("[verify-magic-link] signInWithPassword error:", signInResp.error);
      return new Response(JSON.stringify({ error: "Failed to create session" }), { status: 500, headers: jsonHeaders });
    }

    // Rotate password after short delay to minimize window (best-effort)
    setTimeout(async () => {
      try {
        const newPw = randomHex(32);
        await supabase.auth.admin.updateUserById(userId, { password: newPw });
      } catch (e) {
        console.warn("[verify-magic-link] failed to rotate password:", e);
      }
    }, 100);

    // Return session + user to the client; the client will call supabase.auth.setSession(...)
    return new Response(
      JSON.stringify({
        success: true,
        session: {
          access_token: signInResp.data.session.access_token,
          refresh_token: signInResp.data.session.refresh_token,
        },
        user: { id: userId, email },
      }),
      { status: 200, headers: jsonHeaders }
    );
  } catch (err: any) {
    console.error("[verify-magic-link] unexpected error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Unexpected error" }), { status: 500, headers: jsonHeaders });
  }
});

// helper: random hex string
function randomHex(bytes = 32) {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}