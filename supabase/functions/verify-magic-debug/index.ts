import { serve } from "std/server";
import { createClient } from "@supabase/supabase-js";
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
    const { token, deviceNonce } = body || {};

    console.log("[verify-magic-debug] Request received", {
      hasToken: !!token,
      tokenPrefix: token?.substring(0, 10),
      hasDeviceNonce: !!deviceNonce,
      deviceNoncePrefix: deviceNonce?.substring(0, 10),
    });

    if (!token) {
      return new Response(
        JSON.stringify({
          error: "Missing token",
          debug: { requestBody: body }
        }),
        { status: 400, headers: jsonHeaders }
      );
    }

    // Use HMAC-SHA256 with service role key (same as verify-magic-link)
    const tokenHash = await hashTokenHmac(token, supabaseKey);
    const nowIso = new Date().toISOString();

    console.log("[verify-magic-debug] Looking up token", { tokenHash: tokenHash.substring(0, 16) });

    // Query token WITHOUT consuming it (read-only check)
    const { data: tokenRows, error: queryError } = await supabase
      .from("auth_tokens")
      .select("*")
      .eq("token_hash", tokenHash)
      .eq("token_type", "magic_link")
      .limit(10);

    if (queryError) {
      console.error("[verify-magic-debug] DB query error:", queryError);
      return new Response(
        JSON.stringify({
          error: "Failed to query token",
          debug: { queryError: queryError.message }
        }),
        { status: 500, headers: jsonHeaders }
      );
    }

    console.log("[verify-magic-debug] Query result", {
      foundTokens: tokenRows?.length || 0
    });

    if (!tokenRows || tokenRows.length === 0) {
      return new Response(
        JSON.stringify({
          valid: false,
          reason: "Token not found",
          debug: {
            tokenHash: tokenHash.substring(0, 16) + "...",
            timestamp: nowIso,
          }
        }),
        { status: 200, headers: jsonHeaders }
      );
    }

    // Analyze all matching tokens
    const tokenAnalysis = tokenRows.map(row => {
      const isExpired = row.expires_at ? new Date(row.expires_at) <= new Date(nowIso) : false;
      const isUsed = !!row.used_at;
      const deviceMatch = !deviceNonce || !row.device_nonce || row.device_nonce === deviceNonce;

      return {
        email: row.email,
        created_at: row.created_at,
        expires_at: row.expires_at,
        used_at: row.used_at,
        device_nonce: row.device_nonce ? row.device_nonce.substring(0, 10) + "..." : null,
        device_match: deviceMatch,
        is_expired: isExpired,
        is_used: isUsed,
        is_valid: !isExpired && !isUsed && deviceMatch,
      };
    });

    const validTokens = tokenAnalysis.filter(t => t.is_valid);

    return new Response(
      JSON.stringify({
        valid: validTokens.length > 0,
        reason: validTokens.length > 0
          ? "Token is valid and ready to use"
          : "Token is expired, used, or device mismatch",
        debug: {
          timestamp: nowIso,
          providedDeviceNonce: deviceNonce ? deviceNonce.substring(0, 10) + "..." : null,
          totalMatches: tokenRows.length,
          validMatches: validTokens.length,
          tokens: tokenAnalysis,
        }
      }),
      { status: 200, headers: jsonHeaders }
    );

  } catch (err: any) {
    console.error("[verify-magic-debug] unexpected error:", err);
    return new Response(
      JSON.stringify({
        error: err?.message || "Unexpected error",
        debug: { stack: err?.stack }
      }),
      { status: 500, headers: jsonHeaders }
    );
  }
});

// HMAC-SHA256 helper that must align with send-magic-link hashing scheme
async function hashTokenHmac(token: string, key: string) {
  const enc = new TextEncoder();
  const keyData = enc.encode(key);
  const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(token));
  const arr = Array.from(new Uint8Array(sig));
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
}
