#!/usr/bin/env node
/**
 * scripts/stripe-setup-new-plans.js
 *
 * Idempotent Stripe setup for RingSnap call-based pricing (v2).
 *
 * Plans:
 *   night_weekend  $59/mo   60 calls included   $1.10/call overage
 *   lite           $129/mo  125 calls included  $0.95/call overage
 *   core           $229/mo  250 calls included  $0.85/call overage
 *   pro            $449/mo  450 calls included  $0.75/call overage
 *
 * Idempotency:
 *   - Products: found/created by metadata.plan_key + metadata.is_ringsnap_plan
 *   - Base prices: reused if active price already has the correct unit_amount;
 *     archived + replaced if amount differs (e.g. Pro $399 → $449).
 *   - Overage prices: same check (per-call amount).
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
    base_price_cents: 5900,   // $59.00/mo
    included_calls: 60,
    overage_rate_cents: 110,  // $1.10/call
    trial_period_days: 3,
  },
  {
    plan_key: "lite",
    display_name: "Lite",
    description: "24/7 coverage for handymen, painters, and roofers.",
    base_price_cents: 12900,  // $129.00/mo
    included_calls: 125,
    overage_rate_cents: 95,   // $0.95/call
    trial_period_days: 3,
  },
  {
    plan_key: "core",
    display_name: "Core",
    description:
      "24/7 coverage for plumbers and HVAC contractors. Recommended for most teams.",
    base_price_cents: 22900,  // $229.00/mo
    included_calls: 250,
    overage_rate_cents: 85,   // $0.85/call
    trial_period_days: 3,
  },
  {
    plan_key: "pro",
    display_name: "Pro",
    description: "High-volume contractors and multi-truck operations.",
    base_price_cents: 44900,  // $449.00/mo
    included_calls: 450,
    overage_rate_cents: 75,   // $0.75/call
    trial_period_days: 3,
  },
];

const OUTPUT_FILE = join(__dirname, "stripe-plan-ids.json");

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function findExistingProduct(plan_key) {
  const products = await stripe.products.list({ limit: 100, active: true });
  return (
    products.data.find(
      (p) =>
        p.metadata?.plan_key === plan_key &&
        p.metadata?.is_ringsnap_plan === "true"
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
          p.recurring?.usage_type === "metered" &&
          p.recurring?.interval === "month"
      ) || null
    );
  }
  return (
    prices.data.find(
      (p) =>
        p.recurring?.usage_type !== "metered" &&
        p.recurring?.interval === "month"
    ) || null
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== RingSnap Stripe Plan Setup (call-based v2) ===\n");

  const result = {};

  for (const plan of PLANS) {
    console.log(`\n[${plan.plan_key}] Processing "${plan.display_name}"...`);

    // 1. Find or create product
    let product = await findExistingProduct(plan.plan_key);
    if (product) {
      console.log(`  ✓ Found existing product: ${product.id}`);
      // Update metadata to reflect call-based billing
      await stripe.products.update(product.id, {
        metadata: {
          plan_key: plan.plan_key,
          billing_unit: "call",
          included_calls: String(plan.included_calls),
          overage_rate_cents: String(plan.overage_rate_cents),
          is_ringsnap_plan: "true",
        },
      });
      console.log(`  ✓ Updated product metadata to call-based`);
    } else {
      product = await stripe.products.create({
        name: `RingSnap ${plan.display_name}`,
        description: plan.description,
        metadata: {
          plan_key: plan.plan_key,
          billing_unit: "call",
          included_calls: String(plan.included_calls),
          overage_rate_cents: String(plan.overage_rate_cents),
          is_ringsnap_plan: "true",
        },
      });
      console.log(`  ✓ Created product: ${product.id}`);
    }

    // 2. Base recurring price — archive + recreate if amount differs
    let basePrice = await findActivePriceForProduct(product.id, false);
    if (basePrice) {
      if (basePrice.unit_amount === plan.base_price_cents) {
        console.log(
          `  ✓ Base price correct: ${basePrice.id} ($${plan.base_price_cents / 100}/mo)`
        );
      } else {
        console.log(
          `  ⚠ Base price mismatch: found $${basePrice.unit_amount / 100}, expected $${plan.base_price_cents / 100} — archiving old price`
        );
        await stripe.prices.update(basePrice.id, { active: false });
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
            billing_unit: "call",
          },
        });
        console.log(
          `  ✓ Created replacement base price: ${basePrice.id} ($${plan.base_price_cents / 100}/mo)`
        );
      }
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
          billing_unit: "call",
        },
      });
      console.log(
        `  ✓ Created base price: ${basePrice.id} ($${plan.base_price_cents / 100}/mo)`
      );
    }

    // 3. Metered overage price — archive + recreate if amount differs
    let overagePrice = await findActivePriceForProduct(product.id, true);
    if (overagePrice) {
      if (overagePrice.unit_amount === plan.overage_rate_cents) {
        console.log(
          `  ✓ Overage price correct: ${overagePrice.id} ($${plan.overage_rate_cents / 100}/call)`
        );
      } else {
        console.log(
          `  ⚠ Overage price mismatch: found $${overagePrice.unit_amount / 100}, expected $${plan.overage_rate_cents / 100} — archiving old price`
        );
        await stripe.prices.update(overagePrice.id, { active: false });
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
            billing_unit: "call",
          },
        });
        console.log(
          `  ✓ Created replacement overage price: ${overagePrice.id} ($${plan.overage_rate_cents / 100}/call)`
        );
      }
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
          billing_unit: "call",
        },
      });
      console.log(
        `  ✓ Created overage price: ${overagePrice.id} ($${plan.overage_rate_cents / 100}/call metered)`
      );
    }

    result[plan.plan_key] = {
      product_id: product.id,
      price_id: basePrice.id,
      overage_price_id: overagePrice.id,
    };
  }

  // 4. Archive old price IDs listed in env vars (legacy starters/professional/premium)
  const OLD_PRICE_ENV_VARS = [
    "STRIPE_OLD_PRICE_ID_STARTER",
    "STRIPE_OLD_PRICE_ID_PROFESSIONAL",
    "STRIPE_OLD_PRICE_ID_PREMIUM",
  ];
  console.log("\n[Archive] Checking for old legacy price IDs to archive...");
  for (const envVar of OLD_PRICE_ENV_VARS) {
    const oldPriceId = process.env[envVar];
    if (oldPriceId?.trim()) {
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
  console.log("  1. Add these to your Supabase project secrets (Settings → Edge Functions → Secrets):");
  for (const [key, ids] of Object.entries(result)) {
    const envKey = key.toUpperCase();
    console.log(`     STRIPE_PRICE_ID_${envKey}=${ids.price_id}`);
    console.log(`     STRIPE_OVERAGE_PRICE_ID_${envKey}=${ids.overage_price_id}`);
  }
  console.log("  2. Update your production .env with the same values.");
  console.log("  3. Redeploy edge functions to pick up the new price IDs.\n");
  console.log("  ⚠  NOTE: Pro plan base price increased from $399 to $449.");
  console.log("     Existing Pro subscribers on the old $399 price will remain");
  console.log("     on that price until manually migrated via Stripe dashboard.");
  console.log("     New Pro signups will use the $449 price.\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
