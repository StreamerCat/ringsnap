/**
 * Edge Function: ops-bridge
 *
 * PURPOSE: Minimal, safe bridge from Supabase events → CrewAI AMP.
 *
 * What it does:
 *   1. Receives a POST from internal app functions (or a DB webhook).
 *   2. Validates the shared OPS_WEBHOOK_SECRET.
 *   3. Allows only the 6 approved high-value event types.
 *   4. Forwards to the CrewAI AMP kickoff endpoint.
 *   5. Returns 200 immediately; AMP processing is async.
 *
 * Supabase Secrets required (set via Dashboard → Edge Functions → Secrets):
 *   OPS_WEBHOOK_SECRET  – shared secret between this function and AMP
 *   CREW_AMP_URL        – e.g. https://your-deployment.crewai.com/kickoff
 *   CREW_AMP_API_KEY    – Bearer token issued by CrewAI AMP dashboard
 *
 * Approved event types (all others are silently dropped):
 *   qualified_lead | payment_failure | signup_failure |
 *   provisioning_failure | onboarding_stalled | daily_digest
 *
 * ---------------------------------------------------------------------------
 * INBOUND PAYLOAD SHAPE  (POST body from your app functions)
 * ---------------------------------------------------------------------------
 * {
 *   "event_type": "qualified_lead",          // required — one of 6 approved types
 *   "entity_id":  "lead_abc123",             // optional — lead or account UUID
 *   "account_id": "acct_xyz789",             // optional — account UUID
 *   "source":     "supabase_function",       // optional — defaults to "supabase_function"
 *   "idempotency_key": "vapi-call-123",      // optional — prevents double-processing
 *   "payload": {                             // optional — event-specific data
 *     "phone":       "+15551234567",
 *     "email":       "owner@example.com",
 *     "full_name":   "Jane Smith",
 *     "trade":       "HVAC",
 *     "score":       82,
 *     "failure_reason": "stripe_card_declined"  // for failure events
 *   }
 * }
 *
 * ---------------------------------------------------------------------------
 * OUTBOUND PAYLOAD SHAPE  (POST body sent to CrewAI AMP)
 * ---------------------------------------------------------------------------
 * {
 *   "inputs": {
 *     "event_data": {
 *       "event_type":       "qualified_lead",
 *       "entity_id":        "lead_abc123",
 *       "account_id":       null,
 *       "payload":          { ... },
 *       "source":           "supabase_function",
 *       "idempotency_key":  "vapi-call-123",
 *       "timestamp":        "2026-03-14T12:00:00.000Z"
 *     }
 *   }
 * }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ALLOWED_EVENT_TYPES = new Set([
  "qualified_lead",
  "payment_failure",
  "signup_failure",
  "provisioning_failure",
  "onboarding_stalled",
  "daily_digest",
]);

const OPS_WEBHOOK_SECRET = Deno.env.get("OPS_WEBHOOK_SECRET") ?? "";
const CREW_AMP_URL       = Deno.env.get("CREW_AMP_URL") ?? "";
const CREW_AMP_API_KEY   = Deno.env.get("CREW_AMP_API_KEY") ?? "";

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // 1. Validate shared secret
  const incomingSecret = req.headers.get("x-ops-secret") ?? "";
  if (!OPS_WEBHOOK_SECRET || incomingSecret !== OPS_WEBHOOK_SECRET) {
    return json({ error: "Unauthorized" }, 401);
  }

  // 2. Parse body
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const eventType = typeof body.event_type === "string" ? body.event_type : "";

  // 3. Allow only approved event types
  if (!ALLOWED_EVENT_TYPES.has(eventType)) {
    return json({ status: "dropped", reason: "event_type_not_approved", event_type: eventType }, 200);
  }

  // 4. Check AMP is configured
  if (!CREW_AMP_URL || !CREW_AMP_API_KEY) {
    console.error("ops-bridge: CREW_AMP_URL or CREW_AMP_API_KEY not configured");
    return json({ error: "AMP not configured" }, 503);
  }

  // 5. Build AMP payload
  const eventData = {
    event_type:       eventType,
    entity_id:        body.entity_id   ?? null,
    account_id:       body.account_id  ?? null,
    payload:          body.payload     ?? {},
    source:           body.source      ?? "supabase_function",
    idempotency_key:  body.idempotency_key ?? null,
    timestamp:        new Date().toISOString(),
  };

  const ampPayload = { inputs: { event_data: eventData } };

  // 6. Forward to AMP (fire-and-forget with a reasonable timeout)
  let ampStatus = 0;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8 s

    const ampResp = await fetch(CREW_AMP_URL, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${CREW_AMP_API_KEY}`,
        "x-ops-secret":  OPS_WEBHOOK_SECRET,
      },
      body: JSON.stringify(ampPayload),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    ampStatus = ampResp.status;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`ops-bridge: AMP forward failed event_type=${eventType} error=${msg}`);
    return json({ error: "AMP unreachable", detail: msg }, 502);
  }

  if (ampStatus < 200 || ampStatus >= 300) {
    console.error(`ops-bridge: AMP returned ${ampStatus} for event_type=${eventType}`);
    return json({ error: "AMP rejected event", amp_status: ampStatus }, 502);
  }

  console.log(`ops-bridge: forwarded event_type=${eventType} amp_status=${ampStatus}`);
  return json({ status: "forwarded", event_type: eventType, amp_status: ampStatus }, 200);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
