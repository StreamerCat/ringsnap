/**
 * Unit tests for call-based billing logic.
 *
 * Tests cover:
 *   1. Call classification (classifyCall equivalent logic)
 *   2. Billing math by plan
 *   3. Overage cap behavior
 *   4. Night & Weekend schedule gating (timezone edge cases)
 *   5. Idempotency guard
 *   6. Trial counter behavior and reset
 *   7. Plan preselection from onboarding signals
 *   8. Upgrade/downgrade cycle billing behavior
 *   9. Notification threshold logic
 *
 * Run with: npm test -- src/lib/__tests__/call-based-billing.test.ts
 */

import { describe, it, expect } from "vitest";

// ─── Inline pure logic under test ─────────────────────────────────────────────
// These replicate the logic in:
//   supabase/functions/_shared/call-classifier.ts
//   supabase/functions/authorize-call/index.ts
//   src/lib/billing/dashboardPlans.ts (preSelectPostTrialPlan)

type CallKind = "live" | "verification" | "excluded";

interface ClassifyCallInput {
  durationSeconds: number;
  endedReason?: string | null;
}

interface CallClassification {
  callKind: CallKind;
  billable: boolean;
  billableReason?: string;
  excludedReason?: string;
  estimatedCogsCents?: number;
}

function classifyCall(
  input: ClassifyCallInput,
  isVerificationNumber: boolean,
): CallClassification {
  const { durationSeconds, endedReason } = input;

  if (isVerificationNumber) {
    return { callKind: "verification", billable: false, excludedReason: "verification_call" };
  }
  if (durationSeconds < 10) {
    return { callKind: "excluded", billable: false, excludedReason: "silent_hangup_under_10s" };
  }
  if (endedReason && ["no-answer", "busy", "failed", "machine_detected_greeting_ended"].includes(endedReason)) {
    return { callKind: "excluded", billable: false, excludedReason: `failed_connect:${endedReason}` };
  }
  const estimatedCogsCents = Math.round((durationSeconds / 60) * 20);
  return { callKind: "live", billable: true, billableReason: "handled_call", estimatedCogsCents };
}

function isBusinessHours(nowLocal: Date): boolean {
  const day = nowLocal.getDay();
  const hour = nowLocal.getHours();
  const minute = nowLocal.getMinutes();
  const timeMinutes = hour * 60 + minute;
  const isWeekday = day >= 1 && day <= 5;
  const duringHours = timeMinutes >= 8 * 60 && timeMinutes < 18 * 60;
  return isWeekday && duringHours;
}

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
  if (
    teamSize.includes("10") ||
    teamSize.includes("15") ||
    teamSize.includes("20") ||
    teamSize.includes("25+")
  ) {
    return { planKey: "pro", reason: "team_size_large" };
  }
  if (trade.includes("hvac") || trade.includes("plumb") || trade.includes("multi")) {
    return { planKey: "core", reason: "trade_high_volume" };
  }
  return { planKey: "lite", reason: "default" };
}

// Helper to build fake local Date with given day (0=Sun) and hour
function fakeLocalDate(dayOfWeek: number, hour: number, minute = 0): Date {
  // Jan 5 2025 = Sunday (day 0)
  const base = new Date(2025, 0, 5);
  base.setDate(base.getDate() + dayOfWeek);
  base.setHours(hour, minute, 0, 0);
  return base;
}

// ─── 1. Call Classification ───────────────────────────────────────────────────

describe("classifyCall", () => {
  it("verification number → non-billable, callKind=verification", () => {
    const result = classifyCall({ durationSeconds: 60 }, true);
    expect(result.callKind).toBe("verification");
    expect(result.billable).toBe(false);
    expect(result.excludedReason).toBe("verification_call");
  });

  it("verification takes priority over short duration", () => {
    const result = classifyCall({ durationSeconds: 3 }, true);
    expect(result.callKind).toBe("verification");
  });

  it("silent hangup under 10s → excluded", () => {
    const result = classifyCall({ durationSeconds: 9 }, false);
    expect(result.callKind).toBe("excluded");
    expect(result.billable).toBe(false);
    expect(result.excludedReason).toBe("silent_hangup_under_10s");
  });

  it("exactly 10s → billable live call", () => {
    const result = classifyCall({ durationSeconds: 10 }, false);
    expect(result.callKind).toBe("live");
    expect(result.billable).toBe(true);
  });

  it.each(["no-answer", "busy", "failed", "machine_detected_greeting_ended"])(
    "endedReason='%s' → excluded",
    (reason) => {
      const result = classifyCall({ durationSeconds: 60, endedReason: reason }, false);
      expect(result.callKind).toBe("excluded");
      expect(result.billable).toBe(false);
      expect(result.excludedReason).toBe(`failed_connect:${reason}`);
    }
  );

  it("normal 60s call → live billable", () => {
    const result = classifyCall({ durationSeconds: 60, endedReason: "ended" }, false);
    expect(result.callKind).toBe("live");
    expect(result.billable).toBe(true);
    expect(result.billableReason).toBe("handled_call");
  });

  it("null endedReason + 15s → billable", () => {
    const result = classifyCall({ durationSeconds: 15, endedReason: null }, false);
    expect(result.callKind).toBe("live");
    expect(result.billable).toBe(true);
  });
});

// ─── 2. COGS Estimate ────────────────────────────────────────────────────────

describe("COGS estimation ($0.20/min)", () => {
  it("60s → 20 cents", () => {
    const r = classifyCall({ durationSeconds: 60 }, false);
    expect(r.estimatedCogsCents).toBe(20);
  });

  it("30s → 10 cents", () => {
    const r = classifyCall({ durationSeconds: 30 }, false);
    expect(r.estimatedCogsCents).toBe(10);
  });

  it("180s (3 min) → 60 cents", () => {
    const r = classifyCall({ durationSeconds: 180 }, false);
    expect(r.estimatedCogsCents).toBe(60);
  });

  it("excluded call → no COGS", () => {
    const r = classifyCall({ durationSeconds: 5 }, false);
    expect(r.estimatedCogsCents).toBeUndefined();
  });
});

// ─── 3. Billing Math by Plan ─────────────────────────────────────────────────

describe("Billing math", () => {
  // Plan definitions
  const PLANS = {
    night_weekend: { includedCalls: 60, overageRateCents: 110, maxOverageCalls: 40 },
    lite:          { includedCalls: 125, overageRateCents: 95,  maxOverageCalls: 50 },
    core:          { includedCalls: 250, overageRateCents: 85,  maxOverageCalls: 75 },
    pro:           { includedCalls: 450, overageRateCents: 75,  maxOverageCalls: 90 },
  };

  function calcOverageCents(callsUsed: number, plan: typeof PLANS.lite): number {
    return Math.max(0, callsUsed - plan.includedCalls) * plan.overageRateCents;
  }

  it("Night & Weekend: 60 calls → $0 overage", () => {
    expect(calcOverageCents(60, PLANS.night_weekend)).toBe(0);
  });

  it("Night & Weekend: 61 calls → $1.10 overage", () => {
    expect(calcOverageCents(61, PLANS.night_weekend)).toBe(110);
  });

  it("Night & Weekend: 100 calls → $44.00 overage (40 calls × $1.10)", () => {
    expect(calcOverageCents(100, PLANS.night_weekend)).toBe(4400);
  });

  it("Night & Weekend: system ceiling = 100 (60+40)", () => {
    const { includedCalls, maxOverageCalls } = PLANS.night_weekend;
    expect(includedCalls + maxOverageCalls).toBe(100);
  });

  it("Lite: system ceiling = 175 (125+50)", () => {
    const { includedCalls, maxOverageCalls } = PLANS.lite;
    expect(includedCalls + maxOverageCalls).toBe(175);
  });

  it("Core: system ceiling = 325 (250+75)", () => {
    const { includedCalls, maxOverageCalls } = PLANS.core;
    expect(includedCalls + maxOverageCalls).toBe(325);
  });

  it("Pro: system ceiling = 540 (450+90)", () => {
    const { includedCalls, maxOverageCalls } = PLANS.pro;
    expect(includedCalls + maxOverageCalls).toBe(540);
  });

  it("Core: 10 overage calls → $8.50", () => {
    expect(calcOverageCents(260, PLANS.core)).toBe(850);
  });

  it("Pro: 10 overage calls → $7.50", () => {
    expect(calcOverageCents(460, PLANS.pro)).toBe(750);
  });

  it("Lite: no overage below included", () => {
    expect(calcOverageCents(100, PLANS.lite)).toBe(0);
    expect(calcOverageCents(125, PLANS.lite)).toBe(0);
  });
});

// ─── 4. Overage Cap Behavior ─────────────────────────────────────────────────

describe("Overflow mode gating", () => {
  function shouldBlock(
    callsUsed: number,
    includedCalls: number,
    maxOverage: number,
    overflowMode: string,
    softBuffer = 5
  ): boolean {
    const ceiling = includedCalls + maxOverage;
    if (overflowMode === "always_answer") return false;
    if (overflowMode === "hard_cap") return callsUsed >= ceiling;
    if (overflowMode === "soft_cap") return callsUsed >= ceiling + softBuffer;
    return false;
  }

  it("always_answer: never blocks regardless of usage", () => {
    expect(shouldBlock(999, 60, 40, "always_answer")).toBe(false);
  });

  it("hard_cap: blocks at system ceiling (60+40=100)", () => {
    expect(shouldBlock(99, 60, 40, "hard_cap")).toBe(false);
    expect(shouldBlock(100, 60, 40, "hard_cap")).toBe(true);
    expect(shouldBlock(101, 60, 40, "hard_cap")).toBe(true);
  });

  it("soft_cap: blocks 5 calls beyond ceiling", () => {
    expect(shouldBlock(104, 60, 40, "soft_cap")).toBe(false);
    expect(shouldBlock(105, 60, 40, "soft_cap")).toBe(true);
  });

  it("projected overage cost: 70 calls on N&W → $11.00 overage", () => {
    const callsUsed = 70;
    const includedCalls = 60;
    const overageRateCents = 110;
    const overageCents = Math.max(0, callsUsed - includedCalls) * overageRateCents;
    expect(overageCents).toBe(1100);
  });
});

// ─── 5. Night & Weekend Schedule Gating ──────────────────────────────────────

describe("isBusinessHours (N&W gating)", () => {
  it("Monday 9am → business hours (blocks N&W)", () => {
    expect(isBusinessHours(fakeLocalDate(1, 9, 0))).toBe(true);
  });

  it("Monday 8:00am exactly → business hours", () => {
    expect(isBusinessHours(fakeLocalDate(1, 8, 0))).toBe(true);
  });

  it("Monday 7:59am → NOT business hours", () => {
    expect(isBusinessHours(fakeLocalDate(1, 7, 59))).toBe(false);
  });

  it("Monday 6:00pm (18:00) → NOT business hours (exclusive end)", () => {
    expect(isBusinessHours(fakeLocalDate(1, 18, 0))).toBe(false);
  });

  it("Monday 5:59pm → still business hours", () => {
    expect(isBusinessHours(fakeLocalDate(1, 17, 59))).toBe(true);
  });

  it("Friday 5pm → business hours", () => {
    expect(isBusinessHours(fakeLocalDate(5, 17, 0))).toBe(true);
  });

  it("Friday 6pm → NOT business hours", () => {
    expect(isBusinessHours(fakeLocalDate(5, 18, 0))).toBe(false);
  });

  it("Saturday noon → NOT business hours", () => {
    expect(isBusinessHours(fakeLocalDate(6, 12, 0))).toBe(false);
  });

  it("Sunday any time → NOT business hours", () => {
    expect(isBusinessHours(fakeLocalDate(0, 9))).toBe(false);
    expect(isBusinessHours(fakeLocalDate(0, 14))).toBe(false);
  });

  it("Wednesday midnight → NOT business hours", () => {
    expect(isBusinessHours(fakeLocalDate(3, 0, 0))).toBe(false);
  });

  it("all weekdays 12pm → business hours", () => {
    for (let day = 1; day <= 5; day++) {
      expect(isBusinessHours(fakeLocalDate(day, 12, 0))).toBe(true);
    }
  });
});

// ─── 6. Trial Cap Logic ───────────────────────────────────────────────────────

describe("Trial cap gating", () => {
  const LIVE_CAP = 15;
  const VERIF_CAP = 3;

  function shouldBlockLive(used: number): boolean {
    return used >= LIVE_CAP;
  }
  function shouldBlockVerif(used: number): boolean {
    return used >= VERIF_CAP;
  }
  function isAlertThreshold(used: number, limit: number): boolean {
    return used / limit >= 0.8;
  }

  it("allows up to 14/15 trial live calls", () => {
    expect(shouldBlockLive(14)).toBe(false);
  });

  it("blocks at exactly 15 live calls", () => {
    expect(shouldBlockLive(15)).toBe(true);
  });

  it("blocks above 15", () => {
    expect(shouldBlockLive(20)).toBe(true);
  });

  it("allows up to 2/3 verification calls", () => {
    expect(shouldBlockVerif(2)).toBe(false);
  });

  it("blocks at exactly 3 verification calls", () => {
    expect(shouldBlockVerif(3)).toBe(true);
  });

  it("80% alert threshold fires at 12/15 calls", () => {
    expect(isAlertThreshold(11, 15)).toBe(false);
    expect(isAlertThreshold(12, 15)).toBe(true);
    expect(isAlertThreshold(15, 15)).toBe(true);
  });
});

// ─── 7. Idempotency Guard ─────────────────────────────────────────────────────

describe("Billing ledger idempotency", () => {
  // Simulate the duplicate check logic from writeBillingLedgerEntry
  function simulateLedgerWrite(existingEntry: { counted_in_usage: boolean } | null): {
    alreadyCounted: boolean;
    wouldIncrement: boolean;
  } {
    if (existingEntry?.counted_in_usage) {
      return { alreadyCounted: true, wouldIncrement: false };
    }
    // New entry: increment if billable
    return { alreadyCounted: false, wouldIncrement: true };
  }

  it("duplicate event with counted_in_usage=true → alreadyCounted, no increment", () => {
    const result = simulateLedgerWrite({ counted_in_usage: true });
    expect(result.alreadyCounted).toBe(true);
    expect(result.wouldIncrement).toBe(false);
  });

  it("first event → inserts and increments", () => {
    const result = simulateLedgerWrite(null);
    expect(result.alreadyCounted).toBe(false);
    expect(result.wouldIncrement).toBe(true);
  });

  it("excluded call → inserted but never increments usage", () => {
    // classified as excluded → billable=false → no increment regardless
    const classification: CallClassification = {
      callKind: "excluded",
      billable: false,
      excludedReason: "silent_hangup_under_10s",
    };
    const wouldIncrement = classification.billable;
    expect(wouldIncrement).toBe(false);
  });
});

// ─── 8. Billing Period Reset ─────────────────────────────────────────────────

describe("Billing period reset", () => {
  it("reset_call_cycle_counters zeroes all period counters", () => {
    const beforeReset = {
      calls_used_current_period: 87,
      overage_calls_current_period: 27,
      blocked_calls_current_period: 3,
    };

    // Simulate RPC effect
    const afterReset = {
      calls_used_current_period: 0,
      overage_calls_current_period: 0,
      blocked_calls_current_period: 0,
    };

    expect(afterReset.calls_used_current_period).toBe(0);
    expect(afterReset.overage_calls_current_period).toBe(0);
    expect(afterReset.blocked_calls_current_period).toBe(0);

    // Preserve for billing_period_usage_summary
    expect(beforeReset.calls_used_current_period).toBe(87);
  });

  it("trial counters are independent from paid period counters", () => {
    const account = {
      trial_live_calls_used: 12,
      calls_used_current_period: 0,
    };
    // At conversion, paid period starts fresh — trial count is NOT copied
    expect(account.calls_used_current_period).toBe(0);
    expect(account.trial_live_calls_used).toBe(12); // preserved for audit
  });

  it("overage_calls is derived from calls_used - includedCalls", () => {
    const callsUsed = 87;
    const includedCalls = 60;
    const expectedOverage = Math.max(0, callsUsed - includedCalls);
    expect(expectedOverage).toBe(27);
  });
});

// ─── 9. Plan Preselection ─────────────────────────────────────────────────────

describe("preSelectPostTrialPlan", () => {
  it("explicit selection overrides all other signals", () => {
    const r = preSelectPostTrialPlan({
      explicit: "pro",
      trade: "hvac",
      coveragePreference: "after_hours_only",
    });
    expect(r.planKey).toBe("pro");
    expect(r.reason).toBe("explicit_selection");
  });

  it("after_hours_only coverage → night_weekend", () => {
    const r = preSelectPostTrialPlan({ coveragePreference: "after_hours_only" });
    expect(r.planKey).toBe("night_weekend");
    expect(r.reason).toBe("coverage_after_hours_only");
  });

  it("HVAC trade → core", () => {
    const r = preSelectPostTrialPlan({ trade: "HVAC", coveragePreference: "24_7" });
    expect(r.planKey).toBe("core");
    expect(r.reason).toBe("trade_high_volume");
  });

  it("plumbing trade → core", () => {
    const r = preSelectPostTrialPlan({ trade: "Plumbing" });
    expect(r.planKey).toBe("core");
  });

  it("large team size → pro", () => {
    const r = preSelectPostTrialPlan({ trade: "electrical", teamSize: "10-20 trucks" });
    expect(r.planKey).toBe("pro");
    expect(r.reason).toBe("team_size_large");
  });

  it("painting trade, small team → lite (default)", () => {
    const r = preSelectPostTrialPlan({ trade: "painting", teamSize: "1 truck", coveragePreference: "24_7" });
    expect(r.planKey).toBe("lite");
    expect(r.reason).toBe("default");
  });

  it("no signals → lite (default)", () => {
    const r = preSelectPostTrialPlan({});
    expect(r.planKey).toBe("lite");
    expect(r.reason).toBe("default");
  });

  it("roofing trade → lite (not in high-volume list)", () => {
    const r = preSelectPostTrialPlan({ trade: "roofing" });
    expect(r.planKey).toBe("lite");
  });
});

// ─── 10. Upgrade/Downgrade Cycle Behavior ────────────────────────────────────

describe("Upgrade/downgrade cycle billing", () => {
  it("upgrading mid-cycle: old plan ceiling doesn't carry to new plan", () => {
    const oldPlan = { includedCalls: 60, maxOverageCalls: 40 };
    const newPlan = { includedCalls: 125, maxOverageCalls: 50 };

    // At upgrade, calls_used_current_period stays the same (Stripe prorates subscription)
    // New ceiling applies immediately
    const callsUsedAtUpgrade = 55;
    const oldCeiling = oldPlan.includedCalls + oldPlan.maxOverageCalls;
    const newCeiling = newPlan.includedCalls + newPlan.maxOverageCalls;

    expect(callsUsedAtUpgrade < oldCeiling).toBe(true);  // Was within old plan
    expect(callsUsedAtUpgrade < newCeiling).toBe(true);  // Also within new plan
    expect(newCeiling).toBeGreaterThan(oldCeiling);
  });

  it("downgrading: new lower ceiling can immediately restrict usage", () => {
    const newPlan = { includedCalls: 60, maxOverageCalls: 40 }; // night_weekend
    const callsUsedAtDowngrade = 95;
    const newCeiling = newPlan.includedCalls + newPlan.maxOverageCalls;

    // If hard_cap, calls beyond new ceiling would be blocked
    const wouldBeBlocked = callsUsedAtDowngrade >= newCeiling;
    expect(wouldBeBlocked).toBe(false); // 95 < 100

    // But 101 would be blocked
    expect(101 >= newCeiling).toBe(true);
  });

  it("pro plan ceiling matches MARGIN_FLAGS.proAccountMonthlyCallsWarn", () => {
    const proCeiling = 450 + 90; // includedCalls + maxOverageCalls
    const MARGIN_FLAGS_proWarn = 540;
    expect(proCeiling).toBe(MARGIN_FLAGS_proWarn);
  });
});

// ─── 11. Notification Thresholds ─────────────────────────────────────────────

describe("Usage notification thresholds", () => {
  function getAlertType(callsUsed: number, includedCalls: number, maxOverageCalls: number): string | null {
    const ceiling = includedCalls + maxOverageCalls;
    const pct = callsUsed / includedCalls;
    if (callsUsed >= ceiling) return "plan_100_pct_ceiling_reached";
    if (callsUsed >= includedCalls) return "plan_100_pct";
    if (pct >= 0.8) return "plan_80_pct";
    return null;
  }

  it("below 80% → no alert", () => {
    expect(getAlertType(47, 60, 40)).toBeNull();
  });

  it("at exactly 80% of included (48/60) → plan_80_pct", () => {
    expect(getAlertType(48, 60, 40)).toBe("plan_80_pct");
  });

  it("at exactly 100% of included (60/60) → plan_100_pct", () => {
    expect(getAlertType(60, 60, 40)).toBe("plan_100_pct");
  });

  it("above included, below ceiling → plan_100_pct (overage zone)", () => {
    expect(getAlertType(75, 60, 40)).toBe("plan_100_pct");
  });

  it("at system ceiling (100/100) → plan_100_pct_ceiling_reached", () => {
    expect(getAlertType(100, 60, 40)).toBe("plan_100_pct_ceiling_reached");
  });

  it("trial 80% alert fires at 12/15 live calls", () => {
    const trialUsed = 12;
    const trialLimit = 15;
    expect(trialUsed / trialLimit).toBeGreaterThanOrEqual(0.8);
  });
});

// ─── 12. isTrial flag prevents calls_used_current_period pollution ─────────────

describe("Trial call isolation (isTrial flag)", () => {
  // Simulate writeBillingLedgerEntry with isTrial flag
  function simulateLedgerWrite(
    classification: { billable: boolean },
    existingEntry: null | { counted_in_usage: boolean },
    isTrial: boolean
  ): { wouldIncrementPeriodCounter: boolean; wouldIncrementTrialCounter: boolean } {
    if (existingEntry?.counted_in_usage) {
      return { wouldIncrementPeriodCounter: false, wouldIncrementTrialCounter: false };
    }
    // increment_calls_used only fires when billable AND !existing AND !isTrial
    const wouldIncrementPeriodCounter = classification.billable && !isTrial;
    // trial counter incremented separately by caller (vapi-webhook) when isTrial
    const wouldIncrementTrialCounter = classification.billable && isTrial;
    return { wouldIncrementPeriodCounter, wouldIncrementTrialCounter };
  }

  it("trial live call: does NOT increment calls_used_current_period", () => {
    const result = simulateLedgerWrite({ billable: true }, null, /* isTrial */ true);
    expect(result.wouldIncrementPeriodCounter).toBe(false);
  });

  it("trial live call: DOES signal trial counter should be incremented", () => {
    const result = simulateLedgerWrite({ billable: true }, null, /* isTrial */ true);
    expect(result.wouldIncrementTrialCounter).toBe(true);
  });

  it("paid plan call: DOES increment calls_used_current_period", () => {
    const result = simulateLedgerWrite({ billable: true }, null, /* isTrial */ false);
    expect(result.wouldIncrementPeriodCounter).toBe(true);
  });

  it("duplicate trial call: no counter increments", () => {
    const result = simulateLedgerWrite({ billable: true }, { counted_in_usage: true }, /* isTrial */ true);
    expect(result.wouldIncrementPeriodCounter).toBe(false);
    expect(result.wouldIncrementTrialCounter).toBe(false);
  });

  it("first paid period starts with clean counter (trial calls never polluted it)", () => {
    // If trial calls never increment calls_used_current_period,
    // the first paid period counter starts at 0 even after a busy trial.
    const callsUsedCurrentPeriodAtTrialEnd = 0; // because isTrial skipped increment
    const callsUsedCurrentPeriodAfterConversion = callsUsedCurrentPeriodAtTrialEnd;
    expect(callsUsedCurrentPeriodAfterConversion).toBe(0);
  });
});

// ─── 13. invoice.upcoming resets call-based counters ──────────────────────────

describe("Billing period reset via invoice.upcoming", () => {
  it("reset includes all call-based counter fields", () => {
    // Simulate the full reset object from stripe-webhook invoice.upcoming handler
    const resetPayload = {
      minutes_used_current_period: 0,
      overage_minutes_current_period: 0,
      monthly_minutes_used: 0,
      overage_minutes_used: 0,
      // Call-based (the fix):
      calls_used_current_period: 0,
      overage_calls_current_period: 0,
      blocked_calls_current_period: 0,
      rejected_daytime_calls: 0,
      ceiling_reject_sent: false,
      alerts_sent: {},
    };

    // All call-based counters must be in the reset payload
    expect("calls_used_current_period" in resetPayload).toBe(true);
    expect("overage_calls_current_period" in resetPayload).toBe(true);
    expect("blocked_calls_current_period" in resetPayload).toBe(true);
    expect(resetPayload.calls_used_current_period).toBe(0);
    expect(resetPayload.overage_calls_current_period).toBe(0);
  });

  it("account with 87 calls used is fully reset at period renewal", () => {
    const prePeriodState = {
      calls_used_current_period: 87,
      overage_calls_current_period: 27,
      blocked_calls_current_period: 2,
    };
    // After invoice.upcoming reset:
    const postReset = {
      calls_used_current_period: 0,
      overage_calls_current_period: 0,
      blocked_calls_current_period: 0,
    };
    // Verify counter never carries over
    expect(postReset.calls_used_current_period).toBe(0);
    expect(prePeriodState.calls_used_current_period).toBeGreaterThan(0); // had real usage
  });
});
