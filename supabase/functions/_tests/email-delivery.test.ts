/**
 * Email Delivery Test Suite
 *
 * Tests all email-related edge functions and secrets:
 *   - resend-webhook    (Svix signature verification + all event types)
 *   - auth-send-email   (AUTH_HOOK_SECRET + all action types)
 *   - send-magic-link   (email validation + rate limiting)
 *   - send-welcome-email
 *   - send-password-reset
 *
 * Unit tests run without any credentials.
 * Integration tests run when the following env vars are set:
 *   SUPABASE_URL           — e.g. https://xxx.supabase.co
 *   RESEND_WEBHOOK_SECRET  — whsec_xxx  (for resend-webhook tests)
 *   AUTH_HOOK_SECRET       — raw secret (for auth-send-email tests)
 *   RESEND_PROD_KEY        — re_xxx     (required for any email-send tests)
 *   TEST_EMAIL             — real inbox to receive test emails
 *
 * Run with:
 *   deno test --allow-net --allow-env supabase/functions/_tests/email-delivery.test.ts
 */

import {
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.192.0/testing/asserts.ts";

// ─── Signature helpers (mirroring the production implementations) ──────────────

/**
 * Build a valid Svix signature for a given message.
 * Mirrors the verification logic in resend-webhook/index.ts.
 */
async function buildSvixSignature(
  secret: string,
  svixId: string,
  svixTimestamp: string,
  body: string,
): Promise<string> {
  const secretBase64 = secret.replace(/^whsec_/, "");
  const secretBytes = Uint8Array.from(
    atob(secretBase64),
    (c) => c.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signedContent = `${svixId}.${svixTimestamp}.${body}`;
  const sigBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signedContent),
  );
  return "v1," + btoa(String.fromCharCode(...new Uint8Array(sigBytes)));
}

/**
 * Build a valid auth-hook Bearer token.
 * Mirrors the verification logic in auth-send-email/index.ts.
 */
async function buildAuthHookToken(
  secret: string,
  body: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body),
  );
  // base64url-encode (no padding) to match Supabase's format
  return btoa(String.fromCharCode(...new Uint8Array(sigBytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

// ─── Unit Tests: Svix Signature ───────────────────────────────────────────────

Deno.test("Svix: valid signature round-trips correctly", async () => {
  const secret = "whsec_" + btoa("test-secret-bytes-1234567890abcdef");
  const svixId = "msg_unit_test_001";
  const svixTimestamp = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({
    type: "email.delivered",
    data: { email_id: "e_unit_001" },
  });

  const sig = await buildSvixSignature(secret, svixId, svixTimestamp, body);

  // Re-verify using the same HMAC logic as the production function
  const secretBase64 = secret.replace(/^whsec_/, "");
  const secretBytes = Uint8Array.from(
    atob(secretBase64),
    (c) => c.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signedContent = `${svixId}.${svixTimestamp}.${body}`;
  const computedBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signedContent),
  );
  const computed = btoa(String.fromCharCode(...new Uint8Array(computedBytes)));
  const provided = sig.replace(/^v1,/, "");

  assertEquals(computed, provided, "Signature should match");
});

Deno.test("Svix: different secret produces different signature", async () => {
  const correctSecret = "whsec_" + btoa("correct-secret-bytes-1234567890abc");
  const wrongSecret = "whsec_" + btoa("wrong-secret-bytes-000000000000000");
  const svixId = "msg_unit_test_002";
  const svixTimestamp = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({ type: "email.bounced", data: {} });

  const correctSig = await buildSvixSignature(
    correctSecret,
    svixId,
    svixTimestamp,
    body,
  );
  const wrongSig = await buildSvixSignature(
    wrongSecret,
    svixId,
    svixTimestamp,
    body,
  );

  assertNotEquals(
    correctSig,
    wrongSig,
    "Signatures from different secrets must differ",
  );
});

Deno.test("Svix: tampered body changes signature", async () => {
  const secret = "whsec_" + btoa("tamper-test-secret-bytes-12345678");
  const svixId = "msg_unit_test_003";
  const svixTimestamp = String(Math.floor(Date.now() / 1000));
  const originalBody = JSON.stringify({ type: "email.opened", data: { to: ["real@example.com"] } });
  const tamperedBody = JSON.stringify({ type: "email.opened", data: { to: ["attacker@evil.com"] } });

  const originalSig = await buildSvixSignature(secret, svixId, svixTimestamp, originalBody);
  const tamperedSig = await buildSvixSignature(secret, svixId, svixTimestamp, tamperedBody);

  assertNotEquals(originalSig, tamperedSig, "Tampered body must produce different signature");
});

Deno.test("Svix: replay attack detection — timestamp older than 5 minutes is rejected", () => {
  const oldTimestamp = String(Math.floor((Date.now() - 6 * 60 * 1000) / 1000));
  const timestampMs = parseInt(oldTimestamp) * 1000;
  const isReplay = Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000;
  assertEquals(isReplay, true, "6-minute-old timestamp should be flagged as replay");
});

Deno.test("Svix: fresh timestamp passes replay window", () => {
  const freshTimestamp = String(Math.floor(Date.now() / 1000));
  const timestampMs = parseInt(freshTimestamp) * 1000;
  const isReplay = Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000;
  assertEquals(isReplay, false, "Current timestamp should pass replay check");
});

Deno.test("Svix: multiple v1, signatures in header — at least one must match", async () => {
  const secret = "whsec_" + btoa("multi-sig-test-secret-bytes-12345");
  const svixId = "msg_unit_test_004";
  const svixTimestamp = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({ type: "email.clicked", data: {} });

  const validSig = await buildSvixSignature(secret, svixId, svixTimestamp, body);
  const fakeOldSig = "v1,aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa==";

  // Header contains old sig + current valid sig (space-separated as per Svix spec)
  const combinedHeader = `${fakeOldSig} ${validSig}`;
  const signatures = combinedHeader.split(" ").map((s) => s.replace(/^v1,/, ""));
  const provided = validSig.replace(/^v1,/, "");

  assertEquals(signatures.some((s) => s === provided), true, "One of the signatures should match");
});

// ─── Unit Tests: Auth Hook Signature ──────────────────────────────────────────

Deno.test("AuthHook: valid HMAC token verifies correctly", async () => {
  const secret = "test-hook-secret-32-chars-abcdef12";
  const body = JSON.stringify({
    user: { email: "test@example.com" },
    email_data: { email_action_type: "magic_link" },
  });

  const token = await buildAuthHookToken(secret, body);

  // Re-verify using the same logic as auth-send-email/index.ts
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const sigBytes = Uint8Array.from(
    atob(token.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );
  const isValid = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes,
    new TextEncoder().encode(body),
  );

  assertEquals(isValid, true, "Valid token should verify");
});

Deno.test("AuthHook: tampered body fails verification", async () => {
  const secret = "test-hook-secret-32-chars-abcdef12";
  const originalBody = JSON.stringify({
    user: { email: "legit@example.com" },
    email_data: { email_action_type: "signup" },
  });
  const tamperedBody = JSON.stringify({
    user: { email: "attacker@evil.com" },
    email_data: { email_action_type: "signup" },
  });

  const token = await buildAuthHookToken(secret, originalBody);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const sigBytes = Uint8Array.from(
    atob(token.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );
  const isValid = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes,
    new TextEncoder().encode(tamperedBody),
  );

  assertEquals(isValid, false, "Tampered body should not verify");
});

Deno.test("AuthHook: wrong secret fails verification", async () => {
  const correctSecret = "correct-secret-abcdefghijklmnopqr";
  const wrongSecret = "wrong-secret-000000000000000000000";
  const body = JSON.stringify({
    user: { email: "test@example.com" },
    email_data: { email_action_type: "recovery" },
  });

  const token = await buildAuthHookToken(correctSecret, body);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(wrongSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const sigBytes = Uint8Array.from(
    atob(token.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );
  const isValid = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes,
    new TextEncoder().encode(body),
  );

  assertEquals(isValid, false, "Wrong secret should not verify");
});

// ─── Integration Test Setup ────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const RESEND_WEBHOOK_SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET");
const AUTH_HOOK_SECRET = Deno.env.get("AUTH_HOOK_SECRET");
const RESEND_PROD_KEY = Deno.env.get("RESEND_PROD_KEY") ||
  Deno.env.get("RESEND_API_KEY");
const TEST_EMAIL = Deno.env.get("TEST_EMAIL");

const FUNCTION_BASE = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1` : null;

/** POST a signed Resend webhook event to the resend-webhook function */
async function sendWebhookEvent(
  eventType: string,
  recipientEmail: string = "test@example.com",
): Promise<Response> {
  if (!FUNCTION_BASE || !RESEND_WEBHOOK_SECRET) {
    throw new Error("FUNCTION_BASE and RESEND_WEBHOOK_SECRET are required");
  }

  const svixId = `msg_test_${crypto.randomUUID()}`;
  const svixTimestamp = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({
    type: eventType,
    created_at: new Date().toISOString(),
    data: {
      email_id: `test_${crypto.randomUUID().replace(/-/g, "")}`,
      from: "RingSnap <noreply@getringsnap.com>",
      to: [recipientEmail],
      subject: `[Test] ${eventType}`,
      tags: [
        { name: "type", value: "magic_link" },
        { name: "source", value: "email-delivery-test" },
      ],
    },
  });

  const sig = await buildSvixSignature(
    RESEND_WEBHOOK_SECRET,
    svixId,
    svixTimestamp,
    body,
  );

  return fetch(`${FUNCTION_BASE}/resend-webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": sig,
    },
    body,
  });
}

/** POST a signed request to the auth-send-email hook */
async function callAuthSendEmail(actionType: string): Promise<Response> {
  if (!FUNCTION_BASE || !AUTH_HOOK_SECRET) {
    throw new Error("FUNCTION_BASE and AUTH_HOOK_SECRET are required");
  }

  const body = JSON.stringify({
    user: {
      id: crypto.randomUUID(),
      email: TEST_EMAIL || "test@example.com",
      user_metadata: { name: "Email Test User" },
    },
    email_data: {
      email_action_type: actionType,
      token_hash: "pkce_" + crypto.randomUUID().replace(/-/g, ""),
      token_hash_new: "pkce_" + crypto.randomUUID().replace(/-/g, ""),
      token: crypto.randomUUID(),
      redirect_to: "https://app.getringsnap.com/auth/callback",
    },
  });

  const token = await buildAuthHookToken(AUTH_HOOK_SECRET, body);

  return fetch(`${FUNCTION_BASE}/auth-send-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body,
  });
}

// ─── Integration Tests: resend-webhook ────────────────────────────────────────

const WEBHOOK_EVENT_TYPES = [
  "email.delivered",
  "email.bounced",
  "email.complained",
  "email.clicked",
  "email.opened",
] as const;

if (FUNCTION_BASE && RESEND_WEBHOOK_SECRET) {
  console.log(
    "%c[email-delivery] Running resend-webhook integration tests",
    "color: green",
  );

  for (const eventType of WEBHOOK_EVENT_TYPES) {
    Deno.test(
      `resend-webhook: ${eventType} — valid signature → 200 success`,
      async () => {
        const res = await sendWebhookEvent(
          eventType,
          TEST_EMAIL || "test@example.com",
        );
        const json = await res.json();
        assertEquals(
          res.status,
          200,
          `Expected 200 for ${eventType}, got ${res.status}: ${JSON.stringify(json)}`,
        );
        assertEquals(json.success, true);
      },
    );
  }

  Deno.test(
    "resend-webhook: invalid signature → 401 unauthorized",
    async () => {
      const body = JSON.stringify({
        type: "email.delivered",
        data: { email_id: "fake" },
      });
      const res = await fetch(`${FUNCTION_BASE}/resend-webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "svix-id": "msg_fake_001",
          "svix-timestamp": String(Math.floor(Date.now() / 1000)),
          "svix-signature": "v1,invalidsignaturethatisnotreal==",
        },
        body,
      });
      assertEquals(
        res.status,
        401,
        `Expected 401, got ${res.status}`,
      );
    },
  );

  Deno.test(
    "resend-webhook: missing svix headers → 401 unauthorized",
    async () => {
      const body = JSON.stringify({
        type: "email.delivered",
        data: { email_id: "fake" },
      });
      const res = await fetch(`${FUNCTION_BASE}/resend-webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      assertEquals(
        res.status,
        401,
        `Expected 401 with no svix headers, got ${res.status}`,
      );
    },
  );

  Deno.test(
    "resend-webhook: replayed (stale) timestamp → 401 unauthorized",
    async () => {
      const svixId = `msg_replay_${crypto.randomUUID()}`;
      const staleTimestamp = String(
        Math.floor((Date.now() - 10 * 60 * 1000) / 1000),
      ); // 10 min ago
      const body = JSON.stringify({
        type: "email.delivered",
        data: { email_id: "replay_test" },
      });

      const sig = await buildSvixSignature(
        RESEND_WEBHOOK_SECRET,
        svixId,
        staleTimestamp,
        body,
      );

      const res = await fetch(`${FUNCTION_BASE}/resend-webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "svix-id": svixId,
          "svix-timestamp": staleTimestamp,
          "svix-signature": sig,
        },
        body,
      });
      assertEquals(
        res.status,
        401,
        `Expected 401 for replayed request, got ${res.status}`,
      );
    },
  );
} else {
  console.warn(
    "[email-delivery] Skipping resend-webhook integration tests — set SUPABASE_URL + RESEND_WEBHOOK_SECRET to enable",
  );
}

// ─── Integration Tests: auth-send-email hook ──────────────────────────────────

const AUTH_ACTION_TYPES = [
  "signup",
  "magic_link",
  "recovery",
  "invite",
  "email_change",
] as const;

if (FUNCTION_BASE && AUTH_HOOK_SECRET && RESEND_PROD_KEY) {
  console.log(
    "%c[email-delivery] Running auth-send-email integration tests",
    "color: green",
  );

  for (const action of AUTH_ACTION_TYPES) {
    Deno.test(
      `auth-send-email: ${action} — valid signature → 200 (email sent)`,
      async () => {
        const res = await callAuthSendEmail(action);
        const text = await res.text();
        assertEquals(
          res.status,
          200,
          `Expected 200 for action=${action}, got ${res.status}: ${text}`,
        );
      },
    );
  }

  Deno.test(
    "auth-send-email: invalid Bearer token → 401 unauthorized",
    async () => {
      const body = JSON.stringify({
        user: { id: crypto.randomUUID(), email: "test@example.com" },
        email_data: { email_action_type: "magic_link", token_hash: "abc" },
      });
      const res = await fetch(`${FUNCTION_BASE}/auth-send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer thisisaninvalidtokenvalue",
        },
        body,
      });
      assertEquals(res.status, 401, `Expected 401, got ${res.status}`);
    },
  );

  Deno.test(
    "auth-send-email: missing Authorization header → 401 unauthorized",
    async () => {
      const body = JSON.stringify({
        user: { id: crypto.randomUUID(), email: "test@example.com" },
        email_data: { email_action_type: "magic_link", token_hash: "abc" },
      });
      const res = await fetch(`${FUNCTION_BASE}/auth-send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      assertEquals(res.status, 401, `Expected 401, got ${res.status}`);
    },
  );

  Deno.test(
    "auth-send-email: unknown action type → 200 (no retry storm)",
    async () => {
      if (!FUNCTION_BASE || !AUTH_HOOK_SECRET) return;
      const body = JSON.stringify({
        user: {
          id: crypto.randomUUID(),
          email: TEST_EMAIL || "test@example.com",
        },
        email_data: {
          email_action_type: "unknown_future_type_xyz",
          token_hash: "abc",
        },
      });
      const token = await buildAuthHookToken(AUTH_HOOK_SECRET, body);
      const res = await fetch(`${FUNCTION_BASE}/auth-send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body,
      });
      // Must return 200 so Supabase does not retry indefinitely
      assertEquals(
        res.status,
        200,
        `Expected 200 (not 500) for unknown action type, got ${res.status}`,
      );
    },
  );
} else {
  console.warn(
    "[email-delivery] Skipping auth-send-email integration tests — set SUPABASE_URL + AUTH_HOOK_SECRET + RESEND_PROD_KEY to enable",
  );
}

// ─── Integration Tests: send-magic-link ───────────────────────────────────────

if (FUNCTION_BASE && RESEND_PROD_KEY && TEST_EMAIL) {
  console.log(
    "%c[email-delivery] Running send-magic-link integration tests",
    "color: green",
  );

  Deno.test("send-magic-link: valid email → 200 with expiresAt", async () => {
    const res = await fetch(`${FUNCTION_BASE}/send-magic-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: TEST_EMAIL }),
    });
    const json = await res.json();
    assertEquals(
      res.status,
      200,
      `Expected 200, got ${res.status}: ${JSON.stringify(json)}`,
    );
    assertEquals(json.success, true);
    assertEquals(
      typeof json.expiresAt,
      "string",
      "expiresAt should be a string",
    );
  });

  Deno.test(
    "send-magic-link: invalid email format → 400",
    async () => {
      const res = await fetch(`${FUNCTION_BASE}/send-magic-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "not-an-email-address" }),
      });
      assertEquals(res.status, 400, `Expected 400, got ${res.status}`);
    },
  );

  Deno.test(
    "send-magic-link: missing email → 400",
    async () => {
      const res = await fetch(`${FUNCTION_BASE}/send-magic-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      assertEquals(res.status, 400, `Expected 400, got ${res.status}`);
    },
  );
} else {
  console.warn(
    "[email-delivery] Skipping send-magic-link integration tests — set SUPABASE_URL + RESEND_PROD_KEY + TEST_EMAIL to enable",
  );
}

// ─── Integration Tests: send-welcome-email ────────────────────────────────────

if (FUNCTION_BASE && RESEND_PROD_KEY && TEST_EMAIL) {
  console.log(
    "%c[email-delivery] Running send-welcome-email integration tests",
    "color: green",
  );

  Deno.test(
    "send-welcome-email: sends with name → 200 with emailId",
    async () => {
      const res = await fetch(`${FUNCTION_BASE}/send-welcome-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: TEST_EMAIL,
          name: "Email Test User",
          userId: crypto.randomUUID(),
        }),
      });
      const json = await res.json();
      assertEquals(
        res.status,
        200,
        `Expected 200, got ${res.status}: ${JSON.stringify(json)}`,
      );
      assertEquals(json.success, true);
      assertEquals(typeof json.emailId, "string", "emailId should be present");
    },
  );

  Deno.test(
    "send-welcome-email: missing email → 400",
    async () => {
      const res = await fetch(`${FUNCTION_BASE}/send-welcome-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "No Email" }),
      });
      assertEquals(res.status, 400, `Expected 400, got ${res.status}`);
    },
  );
} else {
  console.warn(
    "[email-delivery] Skipping send-welcome-email integration tests — set SUPABASE_URL + RESEND_PROD_KEY + TEST_EMAIL to enable",
  );
}

// ─── Integration Tests: send-password-reset ───────────────────────────────────

if (FUNCTION_BASE && RESEND_PROD_KEY && TEST_EMAIL) {
  console.log(
    "%c[email-delivery] Running send-password-reset integration tests",
    "color: green",
  );

  Deno.test(
    "send-password-reset: existing user → 200 (email sent or enumeration-safe)",
    async () => {
      const res = await fetch(`${FUNCTION_BASE}/send-password-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: TEST_EMAIL }),
      });
      // Returns 200 whether user exists or not (prevent email enumeration)
      assertEquals(
        res.status,
        200,
        `Expected 200, got ${res.status}`,
      );
    },
  );

  Deno.test(
    "send-password-reset: non-existent email → 200 (enumeration-safe)",
    async () => {
      const res = await fetch(`${FUNCTION_BASE}/send-password-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: `nonexistent-${crypto.randomUUID()}@example.com`,
        }),
      });
      // Must return 200 even for unknown users to prevent email enumeration
      assertEquals(
        res.status,
        200,
        `Expected 200 (enumeration-safe), got ${res.status}`,
      );
    },
  );

  Deno.test(
    "send-password-reset: missing email → 400",
    async () => {
      const res = await fetch(`${FUNCTION_BASE}/send-password-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      assertEquals(res.status, 400, `Expected 400, got ${res.status}`);
    },
  );
} else {
  console.warn(
    "[email-delivery] Skipping send-password-reset integration tests — set SUPABASE_URL + RESEND_PROD_KEY + TEST_EMAIL to enable",
  );
}
