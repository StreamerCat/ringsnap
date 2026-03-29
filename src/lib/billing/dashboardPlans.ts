/**
 * Dashboard Plan Definitions
 *
 * Used by customer dashboard for plan display, upgrade modal, billing tab, and settings.
 * Do NOT import this into marketing/homepage components.
 *
 * Plan keys: night_weekend | lite | core | pro
 * These must match the `plans` table plan_key values exactly.
 *
 * Billing units:
 *   billingUnit = 'call'   → new call-based pricing (v2 plans, pricingCallBasedV1=true)
 *   billingUnit = 'minute' → legacy minute-based pricing (grandfathered accounts)
 */

export type PlanKey = "night_weekend" | "lite" | "core" | "pro";
export type BillingUnit = "call" | "minute";

export type PlanDef = {
    key: PlanKey;
    name: string;
    headline: string;
    priceMonthly: number;

    // ── Call-based billing (billingUnit = 'call') ─────────────────────────────
    billingUnit: BillingUnit;

    /** Handled calls included in base price */
    includedCalls: number;
    /** Cost per overage call in cents */
    overageRateCallsCents: number;
    /** $/call formatted (convenience) */
    overageRateCalls: number;
    /** Hard ceiling: max overage calls above includedCalls (non-user-configurable) */
    maxOverageCalls: number;

    // ── Minute-based billing (billingUnit = 'minute', legacy) ─────────────────
    /** @deprecated Use includedCalls for new plans */
    includedMinutes: number;
    /** @deprecated Use overageRateCalls for new plans */
    overageRate: number; // $/min

    /** System-enforced hard ceiling for overage (legacy minute-based) */
    systemCeilingMinutes: number;

    /** Description of when calls are handled */
    coverageHours: "after_hours_only" | "24_7";

    /** Env variable name for base Stripe price ID */
    priceIdEnv: string;
    /** Env variable name for overage Stripe price ID */
    overagePriceIdEnv: string;

    features: string[];
    recommended?: boolean;
    badgeText?: string;
    notes?: string;

    /** Plan schema version: 1=minute-based (legacy), 2=call-based (v1) */
    planVersion: 1 | 2;
};

export const DASHBOARD_PLANS: PlanDef[] = [
    {
        key: "night_weekend",
        name: "Night & Weekend",
        headline: "After-hours and weekend coverage",
        priceMonthly: 59,
        planVersion: 2,
        billingUnit: "call",

        // Call-based (authoritative for new signups)
        includedCalls: 60,
        overageRateCallsCents: 110,
        overageRateCalls: 1.10,
        maxOverageCalls: 40,

        // Minute-based (kept for legacy/grandfathered display)
        includedMinutes: 150,
        overageRate: 0.45,
        systemCeilingMinutes: 100,

        coverageHours: "after_hours_only",
        priceIdEnv: "STRIPE_PRICE_ID_NIGHT_WEEKEND",
        overagePriceIdEnv: "STRIPE_OVERAGE_PRICE_ID_NIGHT_WEEKEND",
        features: [
            "Answers every after-hours and emergency call",
            "Books appointments and captures job details",
            "Urgent transfer to your phone with full context",
            "Call recordings + transcripts",
            "CRM included — every caller logged automatically",
        ],
        notes: "Active 6PM–8AM weekdays + all weekends",
    },
    {
        key: "lite",
        name: "Lite",
        headline: "24/7 coverage for handymen, painters, and roofers",
        priceMonthly: 129,
        planVersion: 2,
        billingUnit: "call",

        includedCalls: 125,
        overageRateCallsCents: 95,
        overageRateCalls: 0.95,
        maxOverageCalls: 50,

        includedMinutes: 300,
        overageRate: 0.38,
        systemCeilingMinutes: 150,

        coverageHours: "24_7",
        priceIdEnv: "STRIPE_PRICE_ID_LITE",
        overagePriceIdEnv: "STRIPE_OVERAGE_PRICE_ID_LITE",
        features: [
            "24/7 call answering — never miss a job",
            "Appointment booking with your calendar",
            "Urgent call transfer with full call context",
            "Call recordings + transcripts",
            "CRM included — full caller history",
            "Google Calendar + Zapier",
        ],
    },
    {
        key: "core",
        name: "Core",
        headline: "24/7 coverage for plumbers and HVAC contractors",
        priceMonthly: 229,
        planVersion: 2,
        billingUnit: "call",

        includedCalls: 250,
        overageRateCallsCents: 85,
        overageRateCalls: 0.85,
        maxOverageCalls: 75,

        includedMinutes: 600,
        overageRate: 0.28,
        systemCeilingMinutes: 200,

        coverageHours: "24_7",
        priceIdEnv: "STRIPE_PRICE_ID_CORE",
        overagePriceIdEnv: "STRIPE_OVERAGE_PRICE_ID_CORE",
        recommended: true,
        badgeText: "Best Value",
        features: [
            "Everything in Lite, plus:",
            "Branded voice options",
            "Smart call routing by job type and urgency",
            "Multi-language (English + Spanish)",
            "Custom escalation rules",
            "Priority support",
        ],
        notes: "Most HVAC and plumbing teams choose Core",
    },
    {
        key: "pro",
        name: "Pro",
        headline: "High-volume contractors and multi-truck operations",
        priceMonthly: 449,
        planVersion: 2,
        billingUnit: "call",

        includedCalls: 450,
        overageRateCallsCents: 75,
        overageRateCalls: 0.75,
        maxOverageCalls: 90,

        includedMinutes: 1200,
        overageRate: 0.22,
        systemCeilingMinutes: 300,

        coverageHours: "24_7",
        priceIdEnv: "STRIPE_PRICE_ID_PRO",
        overagePriceIdEnv: "STRIPE_OVERAGE_PRICE_ID_PRO",
        features: [
            "Everything in Core, plus:",
            "Custom brand voice",
            "Multi-location dashboard",
            "API + custom webhooks",
            "Dedicated success manager",
            "Priority phone support",
        ],
    },
];

export function getDashboardPlanByKey(key: string | null | undefined): PlanDef | undefined {
    if (!key) return DASHBOARD_PLANS[0];
    // Normalize legacy plan_type keys to new plan_key values
    const normalizedKey = normalizeLegacyPlanKey(key);
    return DASHBOARD_PLANS.find((p) => p.key === normalizedKey);
}

/** Map old plan_type → new plan_key for backwards compatibility */
export function normalizeLegacyPlanKey(key: string): PlanKey {
    switch (key.toLowerCase()) {
        case "starter": return "lite";
        case "professional": return "core";
        case "premium": return "pro";
        case "trial": return "night_weekend";
        default: return (DASHBOARD_PLANS.find(p => p.key === key)?.key) || "night_weekend";
    }
}

export function getNextPlan(currentKey: PlanKey): PlanDef | undefined {
    const currentIndex = DASHBOARD_PLANS.findIndex((p) => p.key === currentKey);
    return currentIndex < DASHBOARD_PLANS.length - 1
        ? DASHBOARD_PLANS[currentIndex + 1]
        : undefined;
}

export function getUpgradeOptions(currentPlanKey: PlanKey | string): PlanDef[] {
    const normalized = normalizeLegacyPlanKey(currentPlanKey);
    const currentIndex = DASHBOARD_PLANS.findIndex((p) => p.key === normalized);
    return DASHBOARD_PLANS.filter((_, i) => i > currentIndex);
}

/**
 * Select the best post-trial plan based on onboarding signals.
 * Returns a plan key and the reason for the selection.
 */
export function preSelectPostTrialPlan(signals: {
    trade?: string | null;
    teamSize?: string | null;
    coveragePreference?: string | null;
}): { planKey: PlanKey; reason: string } {
    const trade = (signals.trade || '').toLowerCase();
    const teamSize = signals.teamSize || '';
    const coverage = signals.coveragePreference || '';

    // After-hours only → Night & Weekend
    if (coverage === 'after_hours_only') {
        return { planKey: 'night_weekend', reason: 'after_hours_only' };
    }

    // HVAC, plumbing, or clearly multi-truck → Core
    const isHighVolumeTrade = ['hvac', 'plumbing', 'plumber', 'heating', 'cooling', 'air conditioning'].some(t => trade.includes(t));
    const isMultiTruck = ['6-10', '10+'].includes(teamSize);
    if (isHighVolumeTrade || isMultiTruck) {
        return { planKey: 'core', reason: isMultiTruck ? 'multi_truck' : 'trade_hvac_plumbing' };
    }

    // Very high volume / multi-location → Pro
    if (teamSize === '10+') {
        return { planKey: 'pro', reason: 'high_volume_multi_location' };
    }

    // Default → Lite
    return { planKey: 'lite', reason: 'default' };
}

/** Check if provisioning is complete */
export function isProvisioned(
    account: { provisioning_status?: string | null; vapi_phone_number?: string | null },
    phoneNumbers?: { phone_number?: string }[]
): boolean {
    if (account.provisioning_status === "completed") return true;
    if (account.vapi_phone_number) return true;
    if (phoneNumbers && phoneNumbers.length > 0 && phoneNumbers[0]?.phone_number) return true;
    return false;
}

/** Check if provisioning is in progress (should poll) */
export function isProvisioningInProgress(
    account: { provisioning_status?: string | null }
): boolean {
    const status = account.provisioning_status;
    return status === "pending" || status === "processing";
}

/** Check if provisioning failed */
export function isProvisioningFailed(
    account: { provisioning_status?: string | null }
): boolean {
    return account.provisioning_status === "failed";
}
