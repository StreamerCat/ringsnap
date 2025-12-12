/**
 * Dashboard Plan Definitions
 * 
 * This file is used ONLY by the customer dashboard Upgrade modal and dashboard plan display.
 * Do NOT import this into homepage pricing components.
 * 
 * Plan keys: starter | professional | premium
 * These must match database plan_type values exactly.
 */

export type PlanKey = "starter" | "professional" | "premium";

export type PlanDef = {
    key: PlanKey;
    name: string;
    headline: string;
    priceMonthly: number;

    includedMinutes: number;
    aiReceptionists: number;
    overageRate: number;

    /** Environment variable name, NOT the actual price ID */
    priceIdEnv: string;

    features: string[];
    recommended?: boolean;
    notes?: string;
};

export const DASHBOARD_PLANS: PlanDef[] = [
    {
        key: "starter",
        name: "Starter",
        headline: "Solo Contractors & Small Crews",
        priceMonthly: 297,
        includedMinutes: 1500,
        aiReceptionists: 1,
        overageRate: 0.16,
        priceIdEnv: "STRIPE_PRICE_STARTER",
        features: [
            "Answer 95% of calls automatically",
            "Books appointments automatically",
            "Call recordings & transcripts",
            "Google Calendar + Zapier",
            "Basic analytics",
        ],
        notes: "Most customers use 1,000–1,400 min/month",
    },
    {
        key: "professional",
        name: "Professional",
        headline: "Growing Contractors with Multiple Crews",
        priceMonthly: 547,
        includedMinutes: 3500,
        aiReceptionists: 3,
        overageRate: 0.13,
        priceIdEnv: "STRIPE_PRICE_PROFESSIONAL",
        recommended: true,
        features: [
            "Everything in Starter",
            "Premium voice cloning",
            "Smart call routing to crew",
            "Multi-language (EN + ES)",
            "Advanced analytics",
            "Priority support",
        ],
        notes: "Most customers stay within plan limits",
    },
    {
        key: "premium",
        name: "Premium",
        headline: "Multi-Location Contractors & Franchises",
        priceMonthly: 947,
        includedMinutes: 7000,
        aiReceptionists: 5,
        overageRate: 0.11,
        priceIdEnv: "STRIPE_PRICE_PREMIUM",
        features: [
            "Everything in Professional",
            "Custom brand voice cloning",
            "Dedicated success manager",
            "API + custom webhooks",
            "Multi-location dashboard",
            "Priority phone support",
        ],
        notes: "Rarely needs additional minutes",
    },
];

/**
 * Get a plan by its key
 */
export function getDashboardPlanByKey(key: PlanKey): PlanDef | undefined {
    return DASHBOARD_PLANS.find((p) => p.key === key);
}

/**
 * Get all plans except the current one (for upgrade options)
 */
export function getUpgradeOptions(currentPlanKey: PlanKey): PlanDef[] {
    const currentIndex = DASHBOARD_PLANS.findIndex((p) => p.key === currentPlanKey);
    // Return plans at higher tiers than current
    return DASHBOARD_PLANS.filter((_, index) => index > currentIndex);
}

/**
 * Helper to check if provisioning is complete
 * Provisioning status values: pending | processing | completed | failed
 */
export function isProvisioned(
    account: { provisioning_status?: string | null; vapi_phone_number?: string | null },
    phoneNumbers?: { phone_number?: string }[]
): boolean {
    // Check account-level status
    if (account.provisioning_status === "completed") {
        return true;
    }

    // Also check if we have a phone number (fallback for edge cases)
    if (account.vapi_phone_number) {
        return true;
    }

    // Check phone_numbers array if provided
    if (phoneNumbers && phoneNumbers.length > 0 && phoneNumbers[0]?.phone_number) {
        return true;
    }

    return false;
}

/**
 * Check if provisioning is in progress (should poll)
 */
export function isProvisioningInProgress(
    account: { provisioning_status?: string | null }
): boolean {
    const status = account.provisioning_status;
    return status === "pending" || status === "processing";
}

/**
 * Check if provisioning failed
 */
export function isProvisioningFailed(
    account: { provisioning_status?: string | null }
): boolean {
    return account.provisioning_status === "failed";
}
