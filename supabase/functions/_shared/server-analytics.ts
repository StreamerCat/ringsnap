/**
 * Shared server-side PostHog analytics helper for Supabase Edge Functions.
 *
 * Single source of truth for server-side event capture so functions don't
 * each reimplement their own fetch-based PostHog client (create-trial and
 * vapi-webhook previously had separate local copies).
 *
 * Contract:
 *   - Best-effort only. A PostHog outage or missing API key must never
 *     throw or block the calling function's response.
 *   - Never pass raw PII (email, full phone, transcript). Use
 *     maskEmailForLogs/maskPhoneForLogs from _shared/logging.ts for any
 *     value that must be included for debugging.
 */

import { posthog } from "./posthog.ts";

const POSTHOG_API_KEY = Deno.env.get("POSTHOG_API_KEY");

export interface ServerAnalyticsProps {
  signup_channel?: "website" | "outbound_agent";
  lead_id?: string | null;
  account_id?: string | null;
  call_id?: string | null;
  vapi_call_id?: string | null;
  trial_attempt_id?: string | null;
  correlation_id?: string | null;
  environment?: string;
  outcome?: string;
  failure_stage?: string;
  error_code?: string;
  error_category?: string;
  http_status?: number;
  retry_count?: number;
  provisioning_status?: string;
  function_name?: string;
  duration_ms?: number;
  [key: string]: unknown;
}

function currentEnvironment(): string {
  return Deno.env.get("ENVIRONMENT") || Deno.env.get("SUPABASE_ENV") || "production";
}

/** Capture a custom server-side event. Best-effort, never throws. */
export async function captureServerEvent(
  event: string,
  distinctId: string,
  props: ServerAnalyticsProps = {}
): Promise<void> {
  if (!POSTHOG_API_KEY) return;
  try {
    await fetch("https://us.i.posthog.com/capture/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: POSTHOG_API_KEY,
        event,
        properties: {
          distinct_id: distinctId,
          environment: currentEnvironment(),
          $lib: "edge-function",
          ...props,
        },
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    /* best-effort — analytics failures must never block the caller */
  }
}

/** Capture a server-side exception via posthog-node. Best-effort, never throws. */
export async function captureServerException(
  err: unknown,
  distinctId: string,
  tags: ServerAnalyticsProps = {}
): Promise<void> {
  const e = err instanceof Error ? err : new Error(String(err));
  try {
    await posthog?.captureException(e, distinctId, {
      error_message: e.message,
      environment: currentEnvironment(),
      ...tags,
    });
  } catch {
    /* best-effort */
  }
}

/** Flush the posthog-node client. Call at the end of a function invocation. */
export async function flushServerAnalytics(): Promise<void> {
  if (!posthog) return;
  try {
    await posthog.flush();
  } catch {
    /* best-effort */
  }
}
