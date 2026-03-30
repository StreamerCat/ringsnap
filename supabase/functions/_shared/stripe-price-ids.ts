/**
 * _shared/stripe-price-ids.ts
 *
 * Canonical Stripe price IDs for RingSnap call-based billing (v2).
 *
 * Resolution order:
 *   1. Environment variable (set via Supabase secrets — preferred)
 *   2. Hardcoded production fallback (from plans table, populated by sync-all-pricing.mjs)
 *
 * Plans: night_weekend | lite | core | pro
 * Legacy keys (starter / professional / premium) are normalized automatically.
 */

// ─── Hardcoded production fallbacks ──────────────────────────────────────────
// These match the `plans` table stripe_price_id / stripe_overage_price_id columns.
// Update here whenever sync-all-pricing.mjs creates new prices.

const LIVE_BASE_PRICE_IDS: Record<string, string> = {
  night_weekend: "price_1T6fHyIdevV48BnpkPU5FLeE",
  lite:          "price_1T6fHzIdevV48BnpaFZYlvbO",
  core:          "price_1T6fI0IdevV48BnphRV8dnvO",
  pro:           "price_1T6fI1IdevV48Bnpn84ebIuz",
};

const LIVE_OVERAGE_PRICE_IDS: Record<string, string> = {
  night_weekend: "price_1T6fHzIdevV48BnpjMJWgiPW",
  lite:          "price_1T6fI0IdevV48Bnp0qJsKFuz",
  core:          "price_1T6fI1IdevV48BnpHPSj8W03",
  pro:           "price_1T6fI1IdevV48BnpMyJnSHFO",
};

// ─── Env var names ────────────────────────────────────────────────────────────

const BASE_ENV: Record<string, string> = {
  night_weekend: "STRIPE_PRICE_ID_NIGHT_WEEKEND",
  lite:          "STRIPE_PRICE_ID_LITE",
  core:          "STRIPE_PRICE_ID_CORE",
  pro:           "STRIPE_PRICE_ID_PRO",
};

const OVERAGE_ENV: Record<string, string> = {
  night_weekend: "STRIPE_OVERAGE_PRICE_ID_NIGHT_WEEKEND",
  lite:          "STRIPE_OVERAGE_PRICE_ID_LITE",
  core:          "STRIPE_OVERAGE_PRICE_ID_CORE",
  pro:           "STRIPE_OVERAGE_PRICE_ID_PRO",
};

// ─── Legacy plan key normalization ───────────────────────────────────────────

const LEGACY_MAP: Record<string, string> = {
  starter:      "night_weekend",
  professional: "core",
  premium:      "pro",
};

function normalize(planKey: string): string {
  return LEGACY_MAP[planKey] ?? planKey;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

/**
 * Returns the Stripe base (recurring) price ID for a plan.
 * Tries env var first, then hardcoded production fallback.
 */
export function getStripePriceId(planKey: string): string {
  const key = normalize(planKey);
  const id = Deno.env.get(BASE_ENV[key] ?? "") || LIVE_BASE_PRICE_IDS[key];
  if (!id) throw new Error(`No Stripe base price ID for plan: ${planKey}`);
  return id;
}

/**
 * Returns the Stripe overage (metered) price ID for a plan.
 * Tries env var first, then hardcoded production fallback.
 */
export function getStripeOveragePriceId(planKey: string): string {
  const key = normalize(planKey);
  const id = Deno.env.get(OVERAGE_ENV[key] ?? "") || LIVE_OVERAGE_PRICE_IDS[key];
  if (!id) throw new Error(`No Stripe overage price ID for plan: ${planKey}`);
  return id;
}

/**
 * Builds a map of Stripe price ID → plan_key for all known base prices.
 * Used by stripe-webhook to identify plan from subscription.
 * Env vars take precedence; hardcoded fallbacks always included.
 */
export function buildPriceToKeyMap(): Record<string, string> {
  const map: Record<string, string> = {};

  for (const [key, liveId] of Object.entries(LIVE_BASE_PRICE_IDS)) {
    // Always include hardcoded fallback
    map[liveId] = key;
    // Env var override (env ID also maps to same key)
    const envId = Deno.env.get(BASE_ENV[key] ?? "");
    if (envId) map[envId] = key;
  }

  return map;
}

/**
 * All valid plan keys in tier order.
 */
export const PLAN_KEYS = ["night_weekend", "lite", "core", "pro"] as const;
export type PlanKey = typeof PLAN_KEYS[number];
