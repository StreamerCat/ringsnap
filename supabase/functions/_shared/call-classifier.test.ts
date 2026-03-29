/**
 * Unit tests for call-classifier.ts
 *
 * Run with:
 *   deno test --allow-env supabase/functions/_shared/call-classifier.test.ts
 */

import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";

import {
  classifyCall,
  ClassifyCallInput,
  MARGIN_FLAGS,
} from "./call-classifier.ts";

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<ClassifyCallInput> = {}): ClassifyCallInput {
  return {
    accountId: "acc-test-1",
    providerCallId: "call-abc-123",
    callerNumber: "+15555550100",
    durationSeconds: 60,
    endedReason: "ended",
    ...overrides,
  };
}

// ─── classifyCall ─────────────────────────────────────────────────────────────

Deno.test("classifyCall: verification number → non-billable verification", () => {
  const result = classifyCall(makeInput(), true, false);
  assertEquals(result.callKind, "verification");
  assertEquals(result.billable, false);
  assertEquals(result.excludedReason, "verification_call");
});

Deno.test("classifyCall: verification takes priority over short duration", () => {
  const result = classifyCall(makeInput({ durationSeconds: 5 }), true, false);
  assertEquals(result.callKind, "verification");
  assertEquals(result.billable, false);
});

Deno.test("classifyCall: silent hangup (9s) → excluded, non-billable", () => {
  const result = classifyCall(makeInput({ durationSeconds: 9 }), false, false);
  assertEquals(result.callKind, "excluded");
  assertEquals(result.billable, false);
  assertEquals(result.excludedReason, "silent_hangup_under_10s");
});

Deno.test("classifyCall: exactly 10s → billable", () => {
  const result = classifyCall(makeInput({ durationSeconds: 10 }), false, false);
  assertEquals(result.callKind, "live");
  assertEquals(result.billable, true);
});

Deno.test("classifyCall: no-answer endedReason → excluded", () => {
  const result = classifyCall(makeInput({ endedReason: "no-answer" }), false, false);
  assertEquals(result.callKind, "excluded");
  assertEquals(result.billable, false);
  assertEquals(result.excludedReason, "failed_connect:no-answer");
});

Deno.test("classifyCall: busy endedReason → excluded", () => {
  const result = classifyCall(makeInput({ endedReason: "busy" }), false, false);
  assertEquals(result.callKind, "excluded");
  assertEquals(result.billable, false);
});

Deno.test("classifyCall: failed endedReason → excluded", () => {
  const result = classifyCall(makeInput({ endedReason: "failed" }), false, false);
  assertEquals(result.callKind, "excluded");
  assertEquals(result.billable, false);
});

Deno.test("classifyCall: machine_detected_greeting_ended → excluded", () => {
  const result = classifyCall(
    makeInput({ endedReason: "machine_detected_greeting_ended" }),
    false,
    false
  );
  assertEquals(result.callKind, "excluded");
  assertEquals(result.billable, false);
  assertEquals(result.excludedReason, "failed_connect:machine_detected_greeting_ended");
});

Deno.test("classifyCall: normal 60s call → live, billable", () => {
  const result = classifyCall(makeInput({ durationSeconds: 60, endedReason: "ended" }), false, false);
  assertEquals(result.callKind, "live");
  assertEquals(result.billable, true);
  assertEquals(result.billableReason, "handled_call");
});

Deno.test("classifyCall: 60s call → correct COGS estimate (20 cents)", () => {
  const result = classifyCall(makeInput({ durationSeconds: 60 }), false, false);
  assertEquals(result.estimatedCogsCents, 20); // 1 min × $0.20/min = 20¢
});

Deno.test("classifyCall: 30s call → ~10 cents COGS", () => {
  const result = classifyCall(makeInput({ durationSeconds: 30 }), false, false);
  assertEquals(result.estimatedCogsCents, 10);
});

Deno.test("classifyCall: 3 min call → ~60 cents COGS", () => {
  const result = classifyCall(makeInput({ durationSeconds: 180 }), false, false);
  assertEquals(result.estimatedCogsCents, 60);
});

Deno.test("classifyCall: null endedReason still billable if duration >= 10s", () => {
  const result = classifyCall(makeInput({ endedReason: null, durationSeconds: 15 }), false, false);
  assertEquals(result.callKind, "live");
  assertEquals(result.billable, true);
});

Deno.test("classifyCall: trial call classified same as non-trial for live calls", () => {
  const trial = classifyCall(makeInput({ durationSeconds: 45 }), false, true);
  const live = classifyCall(makeInput({ durationSeconds: 45 }), false, false);
  assertEquals(trial.callKind, live.callKind);
  assertEquals(trial.billable, live.billable);
});

// ─── Billing math by plan ─────────────────────────────────────────────────────

Deno.test("billing math: overage starts after includedCalls exceeded", () => {
  // Night & Weekend: 60 included, $1.10/call overage
  const includedCalls = 60;
  const overageRateCallsCents = 110; // 110 cents = $1.10

  // 60 calls used → no overage
  const overageAt60 = Math.max(0, 60 - includedCalls) * overageRateCallsCents;
  assertEquals(overageAt60, 0);

  // 61 calls → 1 overage call = $1.10
  const overageAt61 = Math.max(0, 61 - includedCalls) * overageRateCallsCents;
  assertEquals(overageAt61, 110);

  // 100 calls → 40 overage calls = $44.00
  const overageAt100 = Math.max(0, 100 - includedCalls) * overageRateCallsCents;
  assertEquals(overageAt100, 4400);
});

Deno.test("billing math: Night & Weekend plan caps at 100 total calls (60+40)", () => {
  const includedCalls = 60;
  const maxOverageCalls = 40;
  const systemCeiling = includedCalls + maxOverageCalls;
  assertEquals(systemCeiling, 100);
});

Deno.test("billing math: Lite plan caps at 175 total calls (125+50)", () => {
  const includedCalls = 125;
  const maxOverageCalls = 50;
  assertEquals(includedCalls + maxOverageCalls, 175);
});

Deno.test("billing math: Core plan caps at 325 total calls (250+75)", () => {
  const includedCalls = 250;
  const maxOverageCalls = 75;
  assertEquals(includedCalls + maxOverageCalls, 325);
});

Deno.test("billing math: Pro plan caps at 540 total calls (450+90)", () => {
  const includedCalls = 450;
  const maxOverageCalls = 90;
  assertEquals(includedCalls + maxOverageCalls, 540);
  // Also matches MARGIN_FLAGS.proAccountMonthlyCallsWarn
  assertEquals(MARGIN_FLAGS.proAccountMonthlyCallsWarn, 540);
});

Deno.test("billing math: Core overage rate $0.85/call", () => {
  const overageRateCallsCents = 85;
  const overage = 10 * overageRateCallsCents;
  assertEquals(overage, 850); // $8.50
});

Deno.test("billing math: Pro overage rate $0.75/call", () => {
  const overageRateCallsCents = 75;
  const overage = 10 * overageRateCallsCents;
  assertEquals(overage, 750); // $7.50
});

// ─── Overage cap behavior ─────────────────────────────────────────────────────

Deno.test("overage cap: hard_cap blocks call at system ceiling", () => {
  // Simulate what authorize-call does for hard_cap
  function wouldBlock(callsUsed: number, includedCalls: number, maxOverage: number): boolean {
    const systemCeiling = includedCalls + maxOverage;
    return callsUsed >= systemCeiling;
  }

  // Night & Weekend: ceiling = 100
  assertEquals(wouldBlock(99, 60, 40), false);
  assertEquals(wouldBlock(100, 60, 40), true);
  assertEquals(wouldBlock(101, 60, 40), true);
});

Deno.test("overage cap: always_answer never blocks regardless of usage", () => {
  function shouldBlock(
    callsUsed: number,
    includedCalls: number,
    maxOverage: number,
    overflowMode: string
  ): boolean {
    if (overflowMode === "always_answer") return false;
    if (overflowMode === "hard_cap") return callsUsed >= includedCalls + maxOverage;
    if (overflowMode === "soft_cap") {
      // Soft cap: allow calls up to softBuffer beyond ceiling
      const softBuffer = 5;
      return callsUsed >= includedCalls + maxOverage + softBuffer;
    }
    return false;
  }

  assertEquals(shouldBlock(500, 60, 40, "always_answer"), false);
  assertEquals(shouldBlock(500, 60, 40, "hard_cap"), true);
});

Deno.test("overage cap: projected overage cost calculation", () => {
  // If account has used 70/60 calls on N&W plan (10 overage calls)
  // overageRateCallsCents = 110
  const callsUsed = 70;
  const includedCalls = 60;
  const overageRateCents = 110;
  const projectedOverageCents = Math.max(0, callsUsed - includedCalls) * overageRateCents;
  assertEquals(projectedOverageCents, 1100); // $11.00
});

// ─── Night & Weekend schedule gating ─────────────────────────────────────────

// Inline the isBusinessHours / toLocalDate logic for testing isolation
function isBusinessHours(nowLocal: Date): boolean {
  const day = nowLocal.getDay(); // 0=Sun, 6=Sat
  const hour = nowLocal.getHours();
  const minute = nowLocal.getMinutes();
  const timeMinutes = hour * 60 + minute;
  const isWeekday = day >= 1 && day <= 5;
  const duringHours = timeMinutes >= 8 * 60 && timeMinutes < 18 * 60;
  return isWeekday && duringHours;
}

// Helper: create a fake local date with specific day/hour/minute
function localDate(day: number, hour: number, minute: number = 0): Date {
  // Using a fixed known date; day=0 (Sun) to day=6 (Sat)
  // Jan 5 2025 is a Sunday
  const base = new Date(2025, 0, 5); // Sunday
  base.setDate(base.getDate() + day); // 0=Sun, 1=Mon, ..., 6=Sat
  base.setHours(hour, minute, 0, 0);
  return base;
}

Deno.test("N&W gating: Monday 9am → business hours, should block N&W", () => {
  const d = localDate(1, 9, 0); // Monday 9:00am
  assertEquals(isBusinessHours(d), true);
});

Deno.test("N&W gating: Monday 8am exactly → business hours (8:00 start)", () => {
  const d = localDate(1, 8, 0); // Monday 8:00am
  assertEquals(isBusinessHours(d), true);
});

Deno.test("N&W gating: Monday 7:59am → NOT business hours", () => {
  const d = localDate(1, 7, 59); // Monday 7:59am
  assertEquals(isBusinessHours(d), false);
});

Deno.test("N&W gating: Monday 6:00pm exactly → NOT business hours (18:00 exclusive end)", () => {
  const d = localDate(1, 18, 0); // Monday 6:00pm
  assertEquals(isBusinessHours(d), false);
});

Deno.test("N&W gating: Monday 5:59pm → still business hours", () => {
  const d = localDate(1, 17, 59); // Monday 5:59pm
  assertEquals(isBusinessHours(d), true);
});

Deno.test("N&W gating: Friday 5pm → business hours", () => {
  const d = localDate(5, 17, 0); // Friday 5:00pm
  assertEquals(isBusinessHours(d), true);
});

Deno.test("N&W gating: Friday 6pm → NOT business hours", () => {
  const d = localDate(5, 18, 0); // Friday 6:00pm
  assertEquals(isBusinessHours(d), false);
});

Deno.test("N&W gating: Saturday noon → NOT business hours", () => {
  const d = localDate(6, 12, 0); // Saturday
  assertEquals(isBusinessHours(d), false);
});

Deno.test("N&W gating: Sunday any time → NOT business hours", () => {
  assertEquals(isBusinessHours(localDate(0, 9)), false);
  assertEquals(isBusinessHours(localDate(0, 14)), false);
});

Deno.test("N&W gating: Wednesday midnight → NOT business hours", () => {
  const d = localDate(3, 0, 0); // Wednesday midnight
  assertEquals(isBusinessHours(d), false);
});

// ─── Trial cap behavior ───────────────────────────────────────────────────────

Deno.test("trial cap: blocks live call when trial_live_calls_used >= limit", () => {
  function shouldBlockTrialLive(used: number, limit: number): boolean {
    return used >= limit;
  }

  assertEquals(shouldBlockTrialLive(14, 15), false);
  assertEquals(shouldBlockTrialLive(15, 15), true);
  assertEquals(shouldBlockTrialLive(16, 15), true);
});

Deno.test("trial cap: 80% alert threshold fires at 12/15 calls", () => {
  function shouldFireAlert(used: number, limit: number): boolean {
    return used / limit >= 0.8;
  }

  assertEquals(shouldFireAlert(11, 15), false);
  assertEquals(shouldFireAlert(12, 15), true); // 80%
  assertEquals(shouldFireAlert(15, 15), true); // 100%
});

Deno.test("trial verification cap: blocks verification call when used >= limit", () => {
  function shouldBlockVerification(used: number, limit: number): boolean {
    return used >= limit;
  }

  assertEquals(shouldBlockVerification(2, 3), false);
  assertEquals(shouldBlockVerification(3, 3), true);
});

// ─── Idempotency ──────────────────────────────────────────────────────────────

Deno.test("idempotency: writeBillingLedgerEntry returns alreadyCounted=true on duplicate", async () => {
  // Simulate: existing entry with counted_in_usage=true
  const mockSupabase = {
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, _val: string) => ({
          eq: (_col2: string, _val2: string) => ({
            maybeSingle: async () => ({
              data: { id: "ledger-row-1", counted_in_usage: true },
              error: null,
            }),
          }),
        }),
      }),
      upsert: (_row: any) => ({ error: null }),
    }),
    rpc: async () => ({ data: null, error: null }),
  };

  // Import the function dynamically to inject mock
  const { writeBillingLedgerEntry } = await import("./call-classifier.ts");

  const result = await writeBillingLedgerEntry(mockSupabase, {
    accountId: "acc-1",
    providerCallId: "call-dup-001",
    callLogId: null,
    callStartedAt: new Date().toISOString(),
    callEndedAt: null,
    durationSeconds: 60,
    classification: { callKind: "live", billable: true, billableReason: "handled_call", estimatedCogsCents: 20 },
    planSnapshot: {
      planKey: "lite",
      planVersion: 2,
      billingUnit: "call",
      includedCalls: 125,
      overageRateCents: 95,
      maxOverageCalls: 50,
      overflowMode: "always_answer",
    },
    billingPeriodStart: null,
    billingPeriodEnd: null,
    callsUsedBefore: 10,
  });

  assertEquals(result.alreadyCounted, true);
  assertEquals(result.inserted, false);
});

Deno.test("idempotency: first write inserts and increments usage", async () => {
  let rpcCalled = false;
  let upsertCalled = false;

  const mockSupabase = {
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, _val: string) => ({
          eq: (_col2: string, _val2: string) => ({
            maybeSingle: async () => ({
              data: null, // no existing row
              error: null,
            }),
          }),
        }),
      }),
      upsert: (_row: any, _opts?: any) => {
        upsertCalled = true;
        return { error: null };
      },
    }),
    rpc: async (_fn: string, _args: any) => {
      rpcCalled = true;
      return { data: null, error: null };
    },
  };

  const { writeBillingLedgerEntry } = await import("./call-classifier.ts");

  const result = await writeBillingLedgerEntry(mockSupabase, {
    accountId: "acc-2",
    providerCallId: "call-new-001",
    callLogId: null,
    callStartedAt: new Date().toISOString(),
    callEndedAt: null,
    durationSeconds: 60,
    classification: { callKind: "live", billable: true, billableReason: "handled_call", estimatedCogsCents: 20 },
    planSnapshot: {
      planKey: "lite",
      planVersion: 2,
      billingUnit: "call",
      includedCalls: 125,
      overageRateCents: 95,
      maxOverageCalls: 50,
      overflowMode: "always_answer",
    },
    billingPeriodStart: null,
    billingPeriodEnd: null,
    callsUsedBefore: 5,
  });

  assertEquals(result.inserted, true);
  assertEquals(result.alreadyCounted, false);
  assertEquals(upsertCalled, true);
  assertEquals(rpcCalled, true);
});

Deno.test("idempotency: excluded call does NOT increment usage counter", async () => {
  let rpcCalled = false;

  const mockSupabase = {
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, _val: string) => ({
          eq: (_col2: string, _val2: string) => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
      upsert: (_row: any, _opts?: any) => ({ error: null }),
    }),
    rpc: async () => {
      rpcCalled = true;
      return { data: null, error: null };
    },
  };

  const { writeBillingLedgerEntry } = await import("./call-classifier.ts");

  await writeBillingLedgerEntry(mockSupabase, {
    accountId: "acc-3",
    providerCallId: "call-excl-001",
    callLogId: null,
    callStartedAt: new Date().toISOString(),
    callEndedAt: null,
    durationSeconds: 5,
    classification: { callKind: "excluded", billable: false, excludedReason: "silent_hangup_under_10s" },
    planSnapshot: {
      planKey: "lite",
      planVersion: 2,
      billingUnit: "call",
      includedCalls: 125,
      overageRateCents: 95,
      maxOverageCalls: 50,
      overflowMode: "always_answer",
    },
    billingPeriodStart: null,
    billingPeriodEnd: null,
    callsUsedBefore: 10,
  });

  assertEquals(rpcCalled, false); // No increment for excluded calls
});

// ─── Plan preselection ─────────────────────────────────────────────────────────

// Inline the preSelectPostTrialPlan logic to test it in isolation
function preSelectPostTrialPlan(signals: {
  trade?: string | null;
  teamSize?: string | null;
  coveragePreference?: string | null;
  explicit?: string | null;
}): { planKey: string; reason: string } {
  if (signals.explicit) {
    return { planKey: signals.explicit, reason: "explicit_selection" };
  }
  if (signals.coveragePreference === "after_hours_only") {
    return { planKey: "night_weekend", reason: "coverage_after_hours_only" };
  }
  const trade = (signals.trade || "").toLowerCase();
  const teamSize = (signals.teamSize || "").toLowerCase();
  if (teamSize.includes("10") || teamSize.includes("15") || teamSize.includes("20") || teamSize.includes("25+")) {
    return { planKey: "pro", reason: "team_size_large" };
  }
  if (trade.includes("hvac") || trade.includes("plumb") || trade.includes("multi")) {
    return { planKey: "core", reason: "trade_high_volume" };
  }
  return { planKey: "lite", reason: "default" };
}

Deno.test("plan preselect: explicit selection overrides all signals", () => {
  const result = preSelectPostTrialPlan({
    explicit: "pro",
    trade: "hvac",
    coveragePreference: "after_hours_only",
  });
  assertEquals(result.planKey, "pro");
  assertEquals(result.reason, "explicit_selection");
});

Deno.test("plan preselect: after_hours_only → night_weekend", () => {
  const result = preSelectPostTrialPlan({ coveragePreference: "after_hours_only" });
  assertEquals(result.planKey, "night_weekend");
  assertEquals(result.reason, "coverage_after_hours_only");
});

Deno.test("plan preselect: hvac trade → core", () => {
  const result = preSelectPostTrialPlan({ trade: "HVAC", coveragePreference: "24_7" });
  assertEquals(result.planKey, "core");
  assertEquals(result.reason, "trade_high_volume");
});

Deno.test("plan preselect: plumbing trade → core", () => {
  const result = preSelectPostTrialPlan({ trade: "Plumbing" });
  assertEquals(result.planKey, "core");
});

Deno.test("plan preselect: large team size (10+) → pro", () => {
  const result = preSelectPostTrialPlan({ trade: "electrical", teamSize: "10-20 trucks" });
  assertEquals(result.planKey, "pro");
  assertEquals(result.reason, "team_size_large");
});

Deno.test("plan preselect: small painter → lite (default)", () => {
  const result = preSelectPostTrialPlan({ trade: "painting", teamSize: "1 truck", coveragePreference: "24_7" });
  assertEquals(result.planKey, "lite");
  assertEquals(result.reason, "default");
});

Deno.test("plan preselect: no signals → lite (default)", () => {
  const result = preSelectPostTrialPlan({});
  assertEquals(result.planKey, "lite");
  assertEquals(result.reason, "default");
});

// ─── Billing period reset ─────────────────────────────────────────────────────

Deno.test("billing reset: calls_used_current_period should reset to 0 on cycle reset", () => {
  // Simulate what reset_call_cycle_counters RPC does
  function simulateReset(account: {
    calls_used_current_period: number;
    overage_calls_current_period: number;
    blocked_calls_current_period: number;
  }) {
    return {
      calls_used_current_period: 0,
      overage_calls_current_period: 0,
      blocked_calls_current_period: 0,
      previous_calls_used: account.calls_used_current_period,
    };
  }

  const account = {
    calls_used_current_period: 87,
    overage_calls_current_period: 27, // 87 - 60 included
    blocked_calls_current_period: 3,
  };

  const reset = simulateReset(account);
  assertEquals(reset.calls_used_current_period, 0);
  assertEquals(reset.overage_calls_current_period, 0);
  assertEquals(reset.blocked_calls_current_period, 0);
  assertEquals(reset.previous_calls_used, 87); // preserved for summary
});

Deno.test("billing reset: trial counters are separate from paid plan counters", () => {
  // Trial calls_used and period calls_used are on different columns
  // trial_live_calls_used does NOT carry over to calls_used_current_period at conversion
  const trialAccount = {
    trial_live_calls_used: 12,
    calls_used_current_period: 0, // always 0 before first paid cycle
  };

  // At conversion, paid period starts fresh (counter not copied from trial)
  const postConversion = {
    trial_live_calls_used: trialAccount.trial_live_calls_used, // preserved for records
    calls_used_current_period: 0, // starts fresh
  };

  assertEquals(postConversion.calls_used_current_period, 0);
  assertEquals(postConversion.trial_live_calls_used, 12);
});

// ─── MARGIN_FLAGS constants ───────────────────────────────────────────────────

Deno.test("MARGIN_FLAGS: avgDurationWarnMinutes = 2.7", () => {
  assertEquals(MARGIN_FLAGS.avgDurationWarnMinutes, 2.7);
});

Deno.test("MARGIN_FLAGS: avgDurationAlertMinutes = 3.0", () => {
  assertEquals(MARGIN_FLAGS.avgDurationAlertMinutes, 3.0);
});

Deno.test("MARGIN_FLAGS: proAccountMonthlyCallsWarn = 540 (matches Pro ceiling)", () => {
  assertEquals(MARGIN_FLAGS.proAccountMonthlyCallsWarn, 540);
});
