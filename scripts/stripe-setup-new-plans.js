#!/usr/bin/env node
/**
 * scripts/stripe-setup-new-plans.js
 *
 * Idempotent Stripe setup for RingSnap new pricing structure.
 *
 * Plans:
 *   night_weekend  $59/mo   150 min included  $0.45/min overage
 *   lite           $129/mo  300 min included  $0.38/min overage
 *   core           $229/mo  600 min included  $0.28/min overage
 *   pro            $399/mo  1200 min included $0.22/min overage
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_live_... node scripts/stripe-setup-new-plans.js
 *
 * Output:
 *   scripts/stripe-plan-ids.json
 */

import Stripe from "stripe";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Config ───────────────────────────────────────────────────────────────────
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  console.error("ERROR: STRIPE_SECRET_KEY environment variable is required.");
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });

const PLANS = [
  {
    plan_key: "night_weekend",
    display_name: "Night & Weekend",
    description:
      "After-hours and weekend coverage to capture emergency revenue. Active 6PM–8AM weekdays + all weekends.",
    base_price_cents: 5900, // $59.00
    included_minutes: 150,
    overage_rate_cents: 45, // $0.45/min
    trial_period_days: 3,
  },
  {
    plan_key: "lite",
    display_name: "Lite",
    description:
      "24/7 coverage for handymen, painters, and roofers.",
    base_price_cents: 12900, // $129.00
    included_minutes: 300,
    overage_rate_cents: 38, // $0.38/min
    trial_period_days: 3,
  },
  {
    plan_key: "core",
    display_name: "Core",
    description:
      "24/7 coverage for plumbers and HVAC contractors. Recommended for most teams.",
    base_price_cents: 22900, // $229.00
    included_minutes: 600,
    overage_rate_cents: 28, // $0.28/min
    trial_period_days: 3,
  },
  {
    plan_key: "pro",
    display_name: "Pro",
    description:
      "High-volume contractors and multi-truck operations.",
    base_price_cents: 39900, // $399.00
    included_minutes: 1200,
    overage_rate_cents: 22, // $0.22/min
    trial_period_days: 3,
  },
];

const OUTPUT_FILE = join(__dirname, "stripe-plan-ids.json");

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function findExistingProduct(plan_key) {
  // Search for products with matching plan_key metadata
  const products = await stripe.products.list({ limit: 100, active: true });
  return (
    products.data.find(
      (p) =>
        p.metadata &&
        p.metadata.plan_key === plan_key &&
        p.metadata.is_ringsnap_plan === "true"
    ) || null
  );
}

async function findActivePriceForProduct(productId, isMetered) {
  const prices = await stripe.prices.list({
    product: productId,
    active: true,
    limit: 20,
  });
  if (isMetered) {
    return (
      prices.data.find(
        (p) =>
          p.recurring &&
          p.recurring.usage_type === "metered" &&
          p.recurring.interval === "month"
      ) || null
    );
  }
  // Base recurring price (licensed, not metered)
  return (
    prices.data.find(
      (p) =>
        p.recurring &&
        p.recurring.usage_type !== "metered" &&
        p.recurring.interval === "month"
    ) || null
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== RingSnap Stripe Plan Setup ===\n");

  const result = {};

  for (const plan of PLANS) {
    console.log(`\n[${plan.plan_key}] Processing "${plan.display_name}"...`);

    // 1. Check for existing product (idempotent)
    let product = await findExistingProduct(plan.plan_key);
    if (product) {
      console.log(`  ✓ Found existing product: ${product.id}`);
    } else {
      product = await stripe.products.create({
        name: `RingSnap ${plan.display_name}`,
        description: plan.description,
        metadata: {
          plan_key: plan.plan_key,
          included_minutes: String(plan.included_minutes),
          overage_rate_cents: String(plan.overage_rate_cents),
          is_ringsnap_plan: "true",
        },
      });
      console.log(`  ✓ Created product: ${product.id}`);
    }

    // 2. Base recurring price
    let basePrice = await findActivePriceForProduct(product.id, false);
    if (basePrice) {
      console.log(`  ✓ Found existing base price: ${basePrice.id} ($${basePrice.unit_amount / 100}/mo)`);
    } else {
      basePrice = await stripe.prices.create({
        product: product.id,
        currency: "usd",
        unit_amount: plan.base_price_cents,
        recurring: {
          interval: "month",
          usage_type: "licensed",
          trial_period_days: plan.trial_period_days,
        },
        metadata: {
          plan_key: plan.plan_key,
          price_type: "base",
        },
      });
      console.log(`  ✓ Created base price: ${basePrice.id} ($${plan.base_price_cents / 100}/mo)`);
    }

    // 3. Metered overage price
    let overagePrice = await findActivePriceForProduct(product.id, true);
    if (overagePrice) {
      console.log(`  ✓ Found existing overage price: ${overagePrice.id} ($${overagePrice.unit_amount / 100}/min)`);
    } else {
      overagePrice = await stripe.prices.create({
        product: product.id,
        currency: "usd",
        unit_amount: plan.overage_rate_cents,
        recurring: {
          interval: "month",
          usage_type: "metered",
          aggregate_usage: "sum",
        },
        metadata: {
          plan_key: plan.plan_key,
          price_type: "overage",
        },
      });
      console.log(
        `  ✓ Created overage price: ${overagePrice.id} ($${plan.overage_rate_cents / 100}/min metered)`
      );
    }

    result[plan.plan_key] = {
      product_id: product.id,
      price_id: basePrice.id,
      overage_price_id: overagePrice.id,
    };
  }

  // 4. Archive old price IDs listed in env vars
  const OLD_PRICE_ENV_VARS = [
    "STRIPE_OLD_PRICE_ID_STARTER",
    "STRIPE_OLD_PRICE_ID_PROFESSIONAL",
    "STRIPE_OLD_PRICE_ID_PREMIUM",
  ];
  console.log("\n[Archive] Checking for old price IDs to archive...");
  for (const envVar of OLD_PRICE_ENV_VARS) {
    const oldPriceId = process.env[envVar];
    if (oldPriceId && oldPriceId.trim()) {
      try {
        await stripe.prices.update(oldPriceId.trim(), { active: false });
        console.log(`  ✓ Archived old price: ${oldPriceId} (from ${envVar})`);
      } catch (err) {
        console.warn(`  ⚠ Could not archive ${oldPriceId}: ${err.message}`);
      }
    } else {
      console.log(`  - ${envVar} not set, skipping`);
    }
  }

  // 5. Write output JSON
  writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
  console.log(`\n✅ Done! IDs written to: ${OUTPUT_FILE}\n`);
  console.log(JSON.stringify(result, null, 2));

  console.log("\n📋 Next steps:");
  console.log("  1. Copy the price IDs above to your .env / Supabase secrets:");
  for (const [key, ids] of Object.entries(result)) {
    const envKey = key.toUpperCase();
    console.log(`     STRIPE_PRICE_ID_${envKey}=${ids.price_id}`);
    console.log(`     STRIPE_OVERAGE_PRICE_ID_${envKey}=${ids.overage_price_id}`);
  }
  console.log("  2. Run the Supabase migration to update the plans table.");
  console.log("  3. Deploy updated edge functions.\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
