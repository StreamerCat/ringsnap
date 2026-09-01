/**
 * pause-expired-cardless-trials
 *
 * Sweeps trial accounts whose trial_end_date has passed and who never added
 * a payment method (trial_payment_method_added, set by
 * stripe-payment-method-default on a successful card attach) and sets
 * account_status='suspended'. authorize-call already blocks calls for
 * suspended/disabled/cancelled accounts (see supabase/functions/
 * authorize-call/index.ts), so this is the entire enforcement mechanism —
 * no separate call-blocking logic needed here.
 *
 * Invoked on a schedule by pg_cron (see the accompanying cron migration).
 * Auth: verify_jwt = false (pg_cron calls it without a user session) but
 * requires header `x-cron-secret` to match the CRON_SECRET env var, same as
 * trigger-outbound-calls.
 */

import { createClient } from "supabase";
import { logInfo, logError, extractCorrelationId } from "../_shared/logging.ts";

const FUNCTION_NAME = "pause-expired-cardless-trials";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "content-type, x-cron-secret",
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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: expired, error: selectError } = await supabase
    .from("accounts")
    .select("id, company_name, trial_end_date")
    .eq("trial_active", true)
    .eq("account_status", "active")
    .eq("trial_payment_method_added", false)
    .lt("trial_end_date", new Date().toISOString());

  if (selectError) {
    logError("Failed to query expired cardless trials", { functionName: FUNCTION_NAME, correlationId, error: selectError });
    return jsonResponse({ error: "failed to query accounts" }, 500);
  }

  if (!expired || expired.length === 0) {
    return jsonResponse({ paused: 0 });
  }

  const ids = expired.map((a) => a.id);
  const { error: updateError } = await supabase
    .from("accounts")
    .update({ account_status: "suspended" })
    .in("id", ids);

  if (updateError) {
    logError("Failed to suspend expired cardless trials", { functionName: FUNCTION_NAME, correlationId, error: updateError, context: { accountIds: ids } });
    return jsonResponse({ error: "failed to update accounts" }, 500);
  }

  logInfo("Paused expired cardless trials", { functionName: FUNCTION_NAME, correlationId, context: { count: ids.length, accountIds: ids } });

  return jsonResponse({ paused: ids.length, accountIds: ids });
});
