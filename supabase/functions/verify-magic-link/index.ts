/**
 * verify-magic-link
 * - Uses an atomic UPDATE ... RETURNING pattern to mark a token as used only when it's still valid.
 * - Enforces optional device nonce matching.
 * - Returns a clear error when token is invalid/expired/consumed or when device nonce mismatches.
 *
 * IMPORTANT:
 * - This file replaces the token validation call site to ensure single-use and device-nonce checks.
 * - Keep other logic (session setting) as-is.
 */

import { serve } from "std/server";
import { createClient } from "@supabase/supabase-js";

serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const corsHeaders = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };

  try {
    const body = await req.json();
    const { token, deviceNonce } = body || {};

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing token" }), { status: 400, headers: corsHeaders });
    }

    // Hash the incoming token the same way send-magic-link did (assumes HMAC/sha256 or similar)
    // IMPORTANT: use the same hashing/HMAC function you use in send-magic-link
    const tokenHash = await hashToken(token); // implement similar to send-magic-link

    console.log('[verify-magic-link] Validating token...', { tokenHash, deviceNonce });

    // Attempt an atomic consume by updating used_at and returning the row IF:
    // - token_hash matches
    // - token_type = 'magic_link'
    // - used_at IS NULL
    // - expires_at > now()
    // - device_nonce is NULL OR matches provided deviceNonce
    //
    // Using Supabase client: update(...).match(...).is('used_at', null).gt('expires_at', now) .or(...)
    // The .or condition allows device_nonce to be NULL OR equal to the provided deviceNonce.
    //
    const nowIso = new Date().toISOString();

    // Build OR clause for device nonce match: device_nonce.is.null OR device_nonce.eq.<deviceNonce>
    // If no deviceNonce is provided, require device_nonce IS NULL (safer) or allow both? Decide policy.
    // Here we allow consumption if stored device_nonce IS NULL OR equals provided deviceNonce.
    const deviceOrClause = deviceNonce
      ? `device_nonce.is.null,device_nonce.eq.${deviceNonce}`
      : `device_nonce.is.null`;

    const { data: consumedRows, error: updateError } = await supabase
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
      console.error('[verify-magic-link] DB error updating token', updateError);
      return new Response(JSON.stringify({ error: "Failed to validate token" }), { status: 500, headers: corsHeaders });
    }

    if (!consumedRows) {
      console.warn('[verify-magic-link] Token invalid/expired/consumed or device mismatch');
      // Log event for monitoring
      await logAuthEvent(supabase, null, null, 'magic_link_invalid', { reason: 'invalid_or_consumed' }, req.headers.get('x-forwarded-for') || null, req.headers.get('user-agent') || '', false);

      return new Response(JSON.stringify({ error: "Invalid or expired magic link" }), { status: 401, headers: corsHeaders });
    }

    // At this point, the token row was atomically marked used_at = now()
    // consumedRows contains the token metadata (email, user_id, account_id, meta...)
    const tokenData = consumedRows;
    const email = tokenData.email;

    // continue with the rest of your existing verify flow:
    // - create or fetch the user (if new)
    // - create session via supabase.auth.admin.createUser or set cookies as appropriate
    // - return success

    // Example: return success with minimal payload (the client will then getUser() in MagicCallback)
    await logAuthEvent(supabase, tokenData.user_id || null, tokenData.account_id || null, 'magic_link_consumed', { email }, req.headers.get('x-forwarded-for') || null, req.headers.get('user-agent') || '', true);

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
  } catch (err: any) {
    console.error("[verify-magic-link] Unexpected error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Unexpected error" }), { status: 500, headers: corsHeaders });
  }
});

/**
 * Helper: simple hashing wrapper
 * - Must use the same algorithm as send-magic-link when storing token_hash.
 * - Replace with HMAC-SHA256 or other project standard.
 */
async function hashToken(token: string) {
  // Example: SHA-256 hex digest (not HMAC). Replace with HMAC if you use HMAC.
  const enc = new TextEncoder();
  const data = enc.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Stub: logAuthEvent
 * - Reuse your existing logging helper to record audit events.
 */
async function logAuthEvent(supabase: any, userId: string | null, accountId: string | null, eventType: string, meta: any, ip: string | null, userAgent: string | null, success: boolean) {
  try {
    await supabase.from('auth_audit_log').insert([{ user_id: userId, account_id: accountId, event: eventType, meta, ip_address: ip, user_agent: userAgent, success }]);
  } catch (e) {
    console.error("[verify-magic-link] Failed to log auth event:", e);
  }
}