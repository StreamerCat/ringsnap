/**
 * retry-outbound-account-creation
 *
 * Durable retry sweep for outbound Stripe checkouts whose create-trial
 * account adoption failed. stripe-webhook marks a row in
 * outbound_checkout_log as status='account_creation_failed' when its
 * create-trial call errors or is rejected — but by that point
 * record_stripe_event has already marked the originating Stripe event id
 * as seen, so Stripe will never redeliver that webhook. Without this sweep,
 * a prospect who genuinely paid (Stripe subscription live) could be left
 * with no RingSnap account and no automatic recovery.
 *
 * Invoked on a schedule by pg_cron (see the accompanying cron migration).
 * Auth: verify_jwt = false (pg_cron calls it without a user session) but
 * requires header `x-cron-secret` to match the CRON_SECRET env var.
 */

import { createClient } from "supabase";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno&deno-std=0.168.0";
import { logInfo, logError, extractCorrelationId } from "../_shared/logging.ts";
import { captureServerEvent, captureServerException, flushServerAnalytics } from "../_shared/server-analytics.ts";

const FUNCTION_NAME = "retry-outbound-account-creation";
const DEFAULT_BATCH_SIZE = 5;
const MAX_RETRIES = 5;

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

  const correlationId = extractCorrelationId(req);

  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret) {
    logError("CRON_SECRET not configured — refusing to run", { functionName: FUNCTION_NAME, correlationId });
    return jsonResponse({ error: "not configured" }, 500);
  }
  if (req.headers.get("x-cron-secret") !== cronSecret) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const batchSize = Number(Deno.env.get("OUTBOUND_RETRY_BATCH_SIZE") ?? DEFAULT_BATCH_SIZE);

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  if (!stripeKey) {
    logError("STRIPE_SECRET_KEY missing — cannot re-verify checkout sessions", { functionName: FUNCTION_NAME, correlationId });
    return jsonResponse({ error: "STRIPE_SECRET_KEY not set" }, 500);
  }
  const stripe = new Stripe(stripeKey, {
    apiVersion: "2023-10-16",
    httpClient: Stripe.createFetchHttpClient(),
  });

  const { data: failedRows, error: fetchError } = await supabase
    .from("outbound_checkout_log")
    .select("id, stripe_session_id, retry_count")
    .eq("status", "account_creation_failed")
    .lt("retry_count", MAX_RETRIES)
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (fetchError) {
    logError("Failed to fetch retryable rows", { functionName: FUNCTION_NAME, correlationId, error: fetchError });
    return jsonResponse({ error: "failed to fetch retryable rows" }, 500);
  }

  if (!failedRows || failedRows.length === 0) {
    return jsonResponse({ retried: 0, message: "no rows to retry" });
  }

  const results: Array<{ id: string; status: string }> = [];

  for (const row of failedRows) {
    if (!row.stripe_session_id) {
      results.push({ id: row.id, status: "skipped_no_session_id" });
      continue;
    }

    try {
      // Re-fetch the session fresh rather than trusting anything cached —
      // this mirrors exactly what stripe-webhook does on the first attempt.
      const session = await stripe.checkout.sessions.retrieve(row.stripe_session_id, {
        expand: ["customer"],
      });

      if (session.metadata?.source !== "outbound_agent") {
        results.push({ id: row.id, status: "skipped_wrong_source" });
        continue;
      }
      if (typeof session.customer === "string" || !session.customer) {
        results.push({ id: row.id, status: "skipped_no_customer" });
        continue;
      }

      const createTrialUrl = `${supabaseUrl}/functions/v1/create-trial`;
      const res = await fetch(createTrialUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceRoleKey}`,
          "apikey": supabaseServiceRoleKey,
          "Idempotency-Key": `outbound-agent-${session.id}`,
        },
        body: JSON.stringify({
          name: session.metadata?.contact_name || session.metadata?.business_name || "Business Owner",
          email: session.customer_details?.email || session.customer.email,
          phone: session.customer.phone,
          companyName: session.metadata?.business_name || session.metadata?.contact_name || "New Business",
          trade: "general",
          planType: session.metadata?.plan_key || "core",
          source: "outbound_agent",
          stripeSessionId: session.id,
          vapiCallId: session.metadata?.vapi_call_id || undefined,
          serviceArea: session.metadata?.city || undefined,
          billingState: /^[A-Za-z]{2}$/.test(session.metadata?.state || "") ? session.metadata!.state!.toUpperCase() : undefined,
        }),
      });
      const resultBody = await res.json().catch(() => ({}));

      if (res.ok && resultBody?.success) {
        await supabase
          .from("outbound_checkout_log")
          .update({ status: "account_created", account_id: resultBody.accountId, retry_count: row.retry_count + 1 })
          .eq("id", row.id);
        await captureServerEvent("outbound_trial_creation_succeeded", resultBody.accountId || row.stripe_session_id, {
          signup_channel: "outbound_agent",
          outcome: "trial_created",
          function_name: FUNCTION_NAME,
          account_id: resultBody.accountId,
          retry_count: row.retry_count + 1,
          stripe_session_id: session.id,
        });
        results.push({ id: row.id, status: "recovered" });
      } else {
        const nextRetryCount = row.retry_count + 1;
        const permanent = nextRetryCount >= MAX_RETRIES;
        await supabase
          .from("outbound_checkout_log")
          .update({
            status: permanent ? "account_creation_failed_permanent" : "account_creation_failed",
            retry_count: nextRetryCount,
          })
          .eq("id", row.id);
        await captureServerEvent("outbound_trial_creation_failed", row.stripe_session_id, {
          signup_channel: "outbound_agent",
          outcome: "trial_failed",
          function_name: FUNCTION_NAME,
          failure_stage: resultBody?.phase || "retry_create_trial_invoke",
          error_code: resultBody?.errorCode || resultBody?.code || "CREATE_TRIAL_REJECTED",
          http_status: res.status,
          retry_count: nextRetryCount,
          stripe_session_id: session.id,
        });
        results.push({ id: row.id, status: permanent ? "permanently_failed" : "retry_failed" });
      }
    } catch (err) {
      logError("Unhandled error retrying outbound account creation", {
        functionName: FUNCTION_NAME,
        correlationId,
        error: err,
        context: { rowId: row.id, stripeSessionId: row.stripe_session_id },
      });
      await captureServerException(err, row.stripe_session_id ?? row.id, {
        signup_channel: "outbound_agent",
        function_name: FUNCTION_NAME,
        failure_stage: "retry_unhandled",
      });
      const nextRetryCount = row.retry_count + 1;
      await supabase
        .from("outbound_checkout_log")
        .update({
          status: nextRetryCount >= MAX_RETRIES ? "account_creation_failed_permanent" : "account_creation_failed",
          retry_count: nextRetryCount,
        })
        .eq("id", row.id);
      results.push({ id: row.id, status: "error" });
    }
  }

  logInfo("Retry sweep complete", { functionName: FUNCTION_NAME, correlationId, context: { retried: results.length } });
  await flushServerAnalytics();

  return jsonResponse({ retried: results.length, results });
});
