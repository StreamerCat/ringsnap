/**
 * trigger-outbound-calls
 *
 * Replaces the n8n "outbound trigger" workflow. Invoked on a schedule by
 * pg_cron (see supabase/migrations/*_schedule_outbound_trigger_cron.sql).
 * Pulls due leads from outbound_leads, skips anything marked dnc, and
 * places outbound calls via the Vapi API using the Sarah assistant +
 * dedicated outbound number. Does not touch accounts, profiles, or any
 * product tables.
 *
 * SAFETY: defaults to dry-run. No call is placed unless the
 * OUTBOUND_DIALER_LIVE secret is set to exactly "true". Every run — dry
 * or live — writes one row per lead to outbound_call_log so behavior is
 * auditable from the DB alone.
 *
 * Auth: this function has verify_jwt = false (pg_cron calls it without a
 * user session) but requires header `x-cron-secret` to match the
 * CRON_SECRET env var, so it can't be triggered by an arbitrary request.
 */

import { createClient } from "supabase";

const VAPI_ASSISTANT_ID = "e2329175-069b-457f-8984-0f2e62742ed8";
const VAPI_PHONE_NUMBER_ID = "7c61b25d-d31f-4216-b5fb-1a877f5cf2be";
const DEFAULT_BATCH_SIZE = 3;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type, x-cron-secret",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  // ── Auth: shared secret, not a user JWT ─────────────────────────────────────
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret) {
    console.error("[trigger-outbound-calls] CRON_SECRET not configured — refusing to run");
    return jsonResponse({ error: "not configured" }, 500);
  }
  if (req.headers.get("x-cron-secret") !== cronSecret) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const isLive = Deno.env.get("OUTBOUND_DIALER_LIVE") === "true";
  const batchSize = Number(Deno.env.get("OUTBOUND_BATCH_SIZE") ?? DEFAULT_BATCH_SIZE);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // ── 1. Pull due leads (never touches dnc/called/checkout_sent leads) ────────
  const { data: leads, error: leadsError } = await supabase
    .from("outbound_leads")
    .select("id, phone, business_name")
    .eq("status", "new")
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (leadsError) {
    console.error("[trigger-outbound-calls] Failed to fetch leads:", leadsError);
    return jsonResponse({ error: "failed to fetch leads" }, 500);
  }

  if (!leads || leads.length === 0) {
    return jsonResponse({ mode: isLive ? "live" : "dry_run", called: 0, message: "no due leads" });
  }

  const vapiKey = Deno.env.get("VAPI_API_KEY");
  if (isLive && !vapiKey) {
    console.error("[trigger-outbound-calls] OUTBOUND_DIALER_LIVE=true but VAPI_API_KEY missing");
    return jsonResponse({ error: "live mode requested but VAPI_API_KEY not set" }, 500);
  }

  const results: Array<{ leadId: string; phone: string; status: string }> = [];

  for (const lead of leads) {
    if (!isLive) {
      // ── Dry run: log intent only, do not call Vapi or update lead status ────
      await supabase.from("outbound_call_log").insert({
        lead_id: lead.id,
        phone: lead.phone,
        status: "dry_run",
      });
      results.push({ leadId: lead.id, phone: lead.phone, status: "dry_run" });
      continue;
    }

    // ── Claim the lead before dialing so a concurrent/overlapping cron run
    // can't select and dial the same row twice.
    const { data: claimed, error: claimError } = await supabase
      .from("outbound_leads")
      .update({ status: "calling", updated_at: new Date().toISOString() })
      .eq("id", lead.id)
      .eq("status", "new")
      .select("id");

    if (claimError || !claimed || claimed.length === 0) {
      // Already claimed by another run, or the update itself failed —
      // either way, don't dial.
      results.push({ leadId: lead.id, phone: lead.phone, status: "skipped_unclaimed" });
      continue;
    }

    try {
      const vapiRes = await fetch("https://api.vapi.ai/call", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${vapiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assistantId: VAPI_ASSISTANT_ID,
          phoneNumberId: VAPI_PHONE_NUMBER_ID,
          customer: { number: lead.phone },
        }),
      });

      const vapiBody = await vapiRes.json();

      if (vapiRes.ok) {
        // Lead was already claimed into "calling" above; nothing further
        // to update on the lead row.
        const { error: logError } = await supabase.from("outbound_call_log").insert({
          lead_id: lead.id,
          phone: lead.phone,
          vapi_call_id: vapiBody?.id ?? null,
          status: "initiated",
        });
        if (logError) console.error("[trigger-outbound-calls] Failed to log call:", logError);
        results.push({ leadId: lead.id, phone: lead.phone, status: "initiated" });
      } else {
        console.error("[trigger-outbound-calls] Vapi call failed:", vapiBody);
        await supabase.from("outbound_call_log").insert({
          lead_id: lead.id,
          phone: lead.phone,
          status: "failed",
        });
        // Move off "calling" so a persistently failing number doesn't
        // keep winning the head of the queue on every cron run.
        const { error: releaseError } = await supabase
          .from("outbound_leads")
          .update({ status: "call_failed", updated_at: new Date().toISOString() })
          .eq("id", lead.id);
        if (releaseError) console.error("[trigger-outbound-calls] Failed to release lead:", releaseError);
        results.push({ leadId: lead.id, phone: lead.phone, status: "failed" });
      }
    } catch (err) {
      console.error("[trigger-outbound-calls] Unhandled error dialing lead:", lead.id, err);
      await supabase.from("outbound_call_log").insert({
        lead_id: lead.id,
        phone: lead.phone,
        status: "error",
      });
      const { error: releaseError } = await supabase
        .from("outbound_leads")
        .update({ status: "call_failed", updated_at: new Date().toISOString() })
        .eq("id", lead.id);
      if (releaseError) console.error("[trigger-outbound-calls] Failed to release lead:", releaseError);
      results.push({ leadId: lead.id, phone: lead.phone, status: "error" });
    }
  }

  return jsonResponse({ mode: isLive ? "live" : "dry_run", called: results.length, results });
});
