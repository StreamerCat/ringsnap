/**
 * Unit tests for server-analytics.ts
 *
 * Run with: deno test --allow-env --allow-net _shared/server-analytics.test.ts
 *
 * Verifies the "analytics failures must never block the caller" contract
 * required for both website and outbound trial-creation instrumentation.
 */

import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  captureServerEvent,
  captureServerException,
  flushServerAnalytics,
} from "./server-analytics.ts";

Deno.test("captureServerEvent is a no-op and resolves cleanly when POSTHOG_API_KEY is unset", async () => {
  const original = Deno.env.get("POSTHOG_API_KEY");
  Deno.env.delete("POSTHOG_API_KEY");
  try {
    // Must not throw even though no network call is made.
    await captureServerEvent("outbound_trial_requested", "test-distinct-id", {
      signup_channel: "outbound_agent",
    });
  } finally {
    if (original) Deno.env.set("POSTHOG_API_KEY", original);
  }
});

Deno.test("captureServerEvent never throws even if fetch fails (simulated PostHog outage)", async () => {
  const original = Deno.env.get("POSTHOG_API_KEY");
  const originalFetch = globalThis.fetch;
  Deno.env.set("POSTHOG_API_KEY", "test-key");
  // deno-lint-ignore no-explicit-any
  (globalThis as any).fetch = () => {
    throw new Error("simulated network outage");
  };
  try {
    let threw = false;
    try {
      await captureServerEvent("outbound_trial_creation_failed", "test-distinct-id", {
        signup_channel: "outbound_agent",
        failure_stage: "unhandled",
      });
    } catch {
      threw = true;
    }
    assertEquals(threw, false, "captureServerEvent must swallow analytics-layer failures");
  } finally {
    globalThis.fetch = originalFetch;
    if (original) Deno.env.set("POSTHOG_API_KEY", original);
    else Deno.env.delete("POSTHOG_API_KEY");
  }
});

Deno.test("captureServerException never throws when the posthog client is unavailable", async () => {
  let threw = false;
  try {
    await captureServerException(new Error("boom"), "test-distinct-id", {
      function_name: "agent-trial-checkout",
    });
  } catch {
    threw = true;
  }
  assertEquals(threw, false);
});

Deno.test("flushServerAnalytics never throws when the posthog client is unavailable", async () => {
  let threw = false;
  try {
    await flushServerAnalytics();
  } catch {
    threw = true;
  }
  assertEquals(threw, false);
});
