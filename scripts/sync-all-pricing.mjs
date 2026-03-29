#!/usr/bin/env node
/**
 * scripts/sync-all-pricing.mjs
 *
 * One-command pricing sync for RingSnap call-based billing (v2).
 *
 * What it does:
 *   1. Stripe  — creates / updates products + prices (idempotent)
 *   2. DB      — writes Stripe IDs back to the `plans` table in Supabase
 *   3. Secrets — pushes STRIPE_PRICE_ID_* + STRIPE_OVERAGE_PRICE_ID_* to
 *                Supabase Edge-Function secrets via the Management API
 *   4. Validate — checks that key frontend components reflect current pricing
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY              sk_live_... or sk_test_...
 *   SUPABASE_URL                   https://xxxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY      eyJ...
 *
 * Optional env vars (needed for step 3 — secrets push):
 *   SUPABASE_ACCESS_TOKEN          Personal access token from supabase.com/dashboard/account/tokens
 *   SUPABASE_PROJECT_REF           e.g. rmyvvbqnccpfeyowidrq
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_live_... \
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   SUPABASE_ACCESS_TOKEN=sbp_... \
 *   SUPABASE_PROJECT_REF=rmyvvbqnccpfeyowidrq \
 *   node scripts/sync-all-pricing.mjs
 *
 * Flags:
 *   --stripe-only     Skip DB sync, secrets, and validation
 *   --db-only         Skip Stripe and secrets (re-sync DB from JSON output)
 *   --validate-only   Only run the frontend validation check, no writes
 *   --no-secrets      Skip the secrets push step
 *   --dry-run         Print what would be done; make no changes
 */

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ─── Flags ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const STRIPE_ONLY   = args.includes("--stripe-only");
const DB_ONLY       = args.includes("--db-only");
const VALIDATE_ONLY = args.includes("--validate-only");
const NO_SECRETS    = args.includes("--no-secrets") || STRIPE_ONLY;
const DRY_RUN       = args.includes("--dry-run");

// ─── Canonical pricing config ─────────────────────────────────────────────────
//
// This is the single source of truth for pricing numbers.
// Keep in sync with src/lib/billing/dashboardPlans.ts.
//
const PLANS = [
  {
    plan_key:           "night_weekend",
    display_name:       "Night & Weekend",
    description:        "After-hours and weekend coverage to capture emergency revenue. Active 6PM–8AM weekdays + all weekends.",
    base_price_cents:   5900,    // $59.00/mo
    included_calls:     60,
    overage_rate_cents: 110,     // $1.10/call
    max_overage_calls:  40,
    trial_period_days:  3,
    coverage:           "after_hours_only",
  },
  {
    plan_key:           "lite",
    display_name:       "Lite",
    description:        "24/7 coverage for handymen, painters, and roofers.",
    base_price_cents:   12900,   // $129.00/mo
    included_calls:     125,
    overage_rate_cents: 95,      // $0.95/call
    max_overage_calls:  50,
    trial_period_days:  3,
    coverage:           "24_7",
  },
  {
    plan_key:           "core",
    display_name:       "Core",
    description:        "24/7 coverage for plumbers and HVAC contractors. Recommended for most teams.",
    base_price_cents:   22900,   // $229.00/mo
    included_calls:     250,
    overage_rate_cents: 85,      // $0.85/call
    max_overage_calls:  75,
    trial_period_days:  3,
    coverage:           "24_7",
  },
  {
    plan_key:           "pro",
    display_name:       "Pro",
    description:        "High-volume contractors and multi-truck operations.",
    base_price_cents:   44900,   // $449.00/mo
    included_calls:     450,
    overage_rate_cents: 75,      // $0.75/call
    max_overage_calls:  90,
    trial_period_days:  3,
    coverage:           "24_7",
  },
];

const IDS_FILE = join(__dirname, "stripe-plan-ids.json");

// ─── Env validation ───────────────────────────────────────────────────────────

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`ERROR: ${name} environment variable is required.`);
    process.exit(1);
  }
  return v;
}

// ─── Stripe helpers ───────────────────────────────────────────────────────────

async function findExistingProduct(stripe, plan_key) {
  const products = await stripe.products.list({ limit: 100, active: true });
  return (
    products.data.find(
      (p) =>
        p.metadata?.plan_key === plan_key &&
        p.metadata?.is_ringsnap_plan === "true"
    ) || null
  );
}

async function findActivePriceForProduct(stripe, productId, isMetered) {
  const prices = await stripe.prices.list({ product: productId, active: true, limit: 20 });
  if (isMetered) {
    return prices.data.find(
      (p) => p.recurring?.usage_type === "metered" && p.recurring?.interval === "month"
    ) || null;
  }
  return prices.data.find(
    (p) => p.recurring?.usage_type !== "metered" && p.recurring?.interval === "month"
  ) || null;
}

// ─── Phase 1: Stripe ──────────────────────────────────────────────────────────

async function syncStripe(stripe) {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║  Phase 1 — Stripe Products & Prices      ║");
  console.log("╚══════════════════════════════════════════╝\n");

  const result = {};

  for (const plan of PLANS) {
    console.log(`[${plan.plan_key}] Processing "${plan.display_name}"...`);

    if (DRY_RUN) {
      console.log(`  [dry-run] Would create/update product: RingSnap ${plan.display_name}`);
      console.log(`  [dry-run] Would create/confirm base price: $${plan.base_price_cents / 100}/mo`);
      console.log(`  [dry-run] Would create/confirm overage price: $${plan.overage_rate_cents / 100}/call (metered)`);
      result[plan.plan_key] = { product_id: "prod_dryrun", price_id: "price_dryrun_base", overage_price_id: "price_dryrun_overage" };
      console.log();
      continue;
    }

    // Product
    let product = await findExistingProduct(stripe, plan.plan_key);
    if (product) {
      console.log(`  ✓ Found existing product: ${product.id}`);
      await stripe.products.update(product.id, {
        metadata: {
          plan_key:           plan.plan_key,
          billing_unit:       "call",
          included_calls:     String(plan.included_calls),
          overage_rate_cents: String(plan.overage_rate_cents),
          is_ringsnap_plan:   "true",
        },
      });
      console.log(`  ✓ Product metadata confirmed (call-based)`);
    } else {
      product = await stripe.products.create({
        name: `RingSnap ${plan.display_name}`,
        description: plan.description,
        metadata: {
          plan_key:           plan.plan_key,
          billing_unit:       "call",
          included_calls:     String(plan.included_calls),
          overage_rate_cents: String(plan.overage_rate_cents),
          is_ringsnap_plan:   "true",
        },
      });
      console.log(`  ✓ Created product: ${product.id}`);
    }

    // Base price
    let basePrice = await findActivePriceForProduct(stripe, product.id, false);
    if (basePrice) {
      if (basePrice.unit_amount === plan.base_price_cents) {
        console.log(`  ✓ Base price correct: ${basePrice.id} ($${plan.base_price_cents / 100}/mo)`);
      } else {
        console.log(`  ⚠ Base price mismatch: $${basePrice.unit_amount / 100} → $${plan.base_price_cents / 100} — archiving`);
        await stripe.prices.update(basePrice.id, { active: false });
        basePrice = await stripe.prices.create({
          product: product.id,
          currency: "usd",
          unit_amount: plan.base_price_cents,
          recurring: { interval: "month", usage_type: "licensed" },
          metadata: { plan_key: plan.plan_key, price_type: "base", billing_unit: "call" },
        });
        console.log(`  ✓ Replacement base price: ${basePrice.id}`);
      }
    } else {
      basePrice = await stripe.prices.create({
        product: product.id,
        currency: "usd",
        unit_amount: plan.base_price_cents,
        recurring: { interval: "month", usage_type: "licensed" },
        metadata: { plan_key: plan.plan_key, price_type: "base", billing_unit: "call" },
      });
      console.log(`  ✓ Created base price: ${basePrice.id} ($${plan.base_price_cents / 100}/mo)`);
    }

    // Overage price (metered)
    let overagePrice = await findActivePriceForProduct(stripe, product.id, true);
    if (overagePrice) {
      if (overagePrice.unit_amount === plan.overage_rate_cents) {
        console.log(`  ✓ Overage price correct: ${overagePrice.id} ($${plan.overage_rate_cents / 100}/call)`);
      } else {
        console.log(`  ⚠ Overage price mismatch: $${overagePrice.unit_amount / 100} → $${plan.overage_rate_cents / 100} — archiving`);
        await stripe.prices.update(overagePrice.id, { active: false });
        overagePrice = await stripe.prices.create({
          product: product.id,
          currency: "usd",
          unit_amount: plan.overage_rate_cents,
          recurring: { interval: "month", usage_type: "metered", aggregate_usage: "sum" },
          metadata: { plan_key: plan.plan_key, price_type: "overage", billing_unit: "call" },
        });
        console.log(`  ✓ Replacement overage price: ${overagePrice.id}`);
      }
    } else {
      overagePrice = await stripe.prices.create({
        product: product.id,
        currency: "usd",
        unit_amount: plan.overage_rate_cents,
        recurring: { interval: "month", usage_type: "metered", aggregate_usage: "sum" },
        metadata: { plan_key: plan.plan_key, price_type: "overage", billing_unit: "call" },
      });
      console.log(`  ✓ Created overage price: ${overagePrice.id} ($${plan.overage_rate_cents / 100}/call)`);
    }

    result[plan.plan_key] = {
      product_id:       product.id,
      price_id:         basePrice.id,
      overage_price_id: overagePrice.id,
    };

    console.log();
  }

  if (!DRY_RUN) {
    writeFileSync(IDS_FILE, JSON.stringify(result, null, 2));
    console.log(`✅ Stripe IDs written to: ${IDS_FILE}`);
  }

  return result;
}

// ─── Phase 2: Supabase DB ─────────────────────────────────────────────────────

async function syncDatabase(supabase, result) {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║  Phase 2 — Supabase plans table sync     ║");
  console.log("╚══════════════════════════════════════════╝\n");

  let allOk = true;
  for (const plan of PLANS) {
    const ids = result[plan.plan_key];
    if (!ids) {
      console.warn(`  ⚠ No Stripe IDs for ${plan.plan_key}, skipping DB update`);
      continue;
    }

    if (DRY_RUN) {
      console.log(`  [dry-run] Would update plans.${plan.plan_key}:`, ids);
      continue;
    }

    const { error } = await supabase
      .from("plans")
      .update({
        stripe_product_id:       ids.product_id,
        stripe_price_id:         ids.price_id,
        stripe_overage_price_id: ids.overage_price_id,
        // Re-affirm call-based fields in case of drift
        base_price_cents:        plan.base_price_cents,
        included_calls:          plan.included_calls,
        overage_rate_calls_cents: plan.overage_rate_cents,
        max_overage_calls:       plan.max_overage_calls,
        billing_unit:            "call",
        plan_version:            2,
      })
      .eq("plan_key", plan.plan_key);

    if (error) {
      console.error(`  ✗ Failed to update plans.${plan.plan_key}: ${error.message}`);
      allOk = false;
    } else {
      console.log(`  ✓ plans.${plan.plan_key} synced`);
    }
  }

  if (allOk && !DRY_RUN) {
    console.log("\n✅ Database sync complete");
  }
}

// ─── Phase 3: Edge-Function Secrets ──────────────────────────────────────────

async function pushSecrets(result) {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║  Phase 3 — Edge Function Secrets         ║");
  console.log("╚══════════════════════════════════════════╝\n");

  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  const projectRef  = process.env.SUPABASE_PROJECT_REF;

  if (!accessToken || !projectRef) {
    console.warn("  ⚠ SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF not set.");
    console.warn("  Skipping secrets push. Set these to enable automatic secret sync.");
    console.warn("\n  Manual fallback — add these secrets via Supabase dashboard or CLI:");
    printSecretsTable(result);
    return;
  }

  // Build secrets array for Management API
  const secrets = [];
  for (const [key, ids] of Object.entries(result)) {
    const envKey = key.toUpperCase();
    secrets.push({ name: `STRIPE_PRICE_ID_${envKey}`,         value: ids.price_id });
    secrets.push({ name: `STRIPE_OVERAGE_PRICE_ID_${envKey}`, value: ids.overage_price_id });
  }

  if (DRY_RUN) {
    console.log("  [dry-run] Would push secrets:");
    for (const s of secrets) {
      console.log(`    ${s.name}=${s.value}`);
    }
    return;
  }

  const url = `https://api.supabase.com/v1/projects/${projectRef}/secrets`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify(secrets),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`  ✗ Secrets push failed (HTTP ${res.status}): ${body}`);
    console.warn("\n  Manual fallback — add these secrets via Supabase dashboard or CLI:");
    printSecretsTable(result);
    return;
  }

  console.log(`  ✓ Pushed ${secrets.length} secrets to project ${projectRef}`);
  for (const s of secrets) {
    console.log(`    ${s.name}`);
  }
  console.log("\n✅ Secrets sync complete");
  console.log("  ⚠  Redeploy edge functions to pick up the new secrets:");
  console.log("     supabase functions deploy --project-ref " + projectRef);
}

function printSecretsTable(result) {
  for (const [key, ids] of Object.entries(result)) {
    const envKey = key.toUpperCase();
    console.log(`    STRIPE_PRICE_ID_${envKey}=${ids.price_id}`);
    console.log(`    STRIPE_OVERAGE_PRICE_ID_${envKey}=${ids.overage_price_id}`);
  }
}

// ─── Phase 4: Frontend Validation ────────────────────────────────────────────

async function validateFrontend() {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║  Phase 4 — Frontend Component Validation ║");
  console.log("╚══════════════════════════════════════════╝\n");

  // Build expected values from canonical PLANS config
  const expected = PLANS.map((p) => ({
    key:           p.plan_key,
    price:         p.base_price_cents / 100,
    includedCalls: p.included_calls,
    overage:       p.overage_rate_cents / 100,
  }));

  const files = [
    {
      label: "src/lib/billing/dashboardPlans.ts (canonical TS source)",
      path: join(ROOT, "src/lib/billing/dashboardPlans.ts"),
      checks: PLANS.map((p) => [
        `priceMonthly: ${p.base_price_cents / 100}`,
        `includedCalls: ${p.included_calls}`,
        `overageRateCallsCents: ${p.overage_rate_cents}`,
      ]).flat(),
    },
    {
      label: "src/components/ContractorPricing.tsx (marketing pricing page)",
      path: join(ROOT, "src/components/ContractorPricing.tsx"),
      checks: expected.map((p) => [
        `price: ${p.price}`,
        `includedCalls: ${p.includedCalls}`,
        `overageRatePerCall: ${p.overage}`,
      ]).flat(),
    },
    {
      label: "src/components/signup/shared/PlanSelectionStep.tsx (trial signup)",
      path: join(ROOT, "src/components/signup/shared/PlanSelectionStep.tsx"),
      checks: expected.map((p) => [
        `price: ${p.price}`,
        `includedCalls: ${p.includedCalls}`,
      ]).flat(),
    },
    {
      label: "src/pages/Pricing.tsx (SEO pricing page)",
      path: join(ROOT, "src/pages/Pricing.tsx"),
      checks: expected.map((p) => `"price": "${p.price}"`),
    },
  ];

  let allPassed = true;

  for (const { label, path, checks } of files) {
    if (!existsSync(path)) {
      console.warn(`  ⚠ ${label}\n     File not found: ${path}`);
      continue;
    }

    const content = readFileSync(path, "utf8");
    const missing = checks.filter((c) => !content.includes(c));

    if (missing.length === 0) {
      console.log(`  ✓ ${label}`);
    } else {
      console.warn(`  ✗ ${label}`);
      for (const m of missing) {
        console.warn(`      Missing: ${m}`);
      }
      allPassed = false;
    }
  }

  // Known legacy: PlanSelector.tsx uses starter/professional/premium keys
  // intentionally (normalized server-side). Note this but don't fail.
  console.log(`\n  ⓘ  src/components/onboarding/shared/PlanSelector.tsx`);
  console.log(`     Uses legacy plan keys (starter/professional/premium) by design.`);
  console.log(`     Server-side normalizeLegacyPlanKey() maps them to call-based keys.`);
  console.log(`     This component does NOT show the Pro plan — sales flow only.`);

  if (allPassed) {
    console.log("\n✅ All frontend components validated");
  } else {
    console.warn("\n⚠  Some frontend components have pricing drift — review above");
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║  RingSnap Pricing Sync — call-based v2   ║");
  console.log("╚══════════════════════════════════════════╝");

  if (DRY_RUN) console.log("\n🔍 DRY RUN — no changes will be made\n");
  if (STRIPE_ONLY)   console.log("Mode: Stripe only");
  if (DB_ONLY)       console.log("Mode: DB only");
  if (VALIDATE_ONLY) console.log("Mode: Validate only");

  // Validate only — no credentials needed
  if (VALIDATE_ONLY) {
    await validateFrontend();
    return;
  }

  // Load Stripe IDs from file for --db-only mode
  let result = {};
  if (DB_ONLY) {
    if (!existsSync(IDS_FILE)) {
      console.error(`ERROR: ${IDS_FILE} not found. Run without --db-only first.`);
      process.exit(1);
    }
    result = JSON.parse(readFileSync(IDS_FILE, "utf8"));
    console.log(`\nLoaded Stripe IDs from ${IDS_FILE}`);
  }

  // Set up clients
  let stripe = null;
  let supabase = null;

  if (!DB_ONLY) {
    const STRIPE_SECRET_KEY = DRY_RUN
      ? (process.env.STRIPE_SECRET_KEY || "sk_test_dryrun")
      : requireEnv("STRIPE_SECRET_KEY");
    stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });
  }

  if (!STRIPE_ONLY) {
    if (!DRY_RUN) {
      const SUPABASE_URL              = requireEnv("SUPABASE_URL");
      const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
      supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    }
  }

  // Phase 1: Stripe
  if (!DB_ONLY) {
    result = await syncStripe(stripe);
  }

  // Phase 2: DB
  if (!STRIPE_ONLY && supabase && Object.keys(result).length > 0) {
    await syncDatabase(supabase, result);
  }

  // Phase 3: Secrets
  if (!NO_SECRETS && Object.keys(result).length > 0) {
    await pushSecrets(result);
  }

  // Phase 4: Frontend validation
  await validateFrontend();

  // Summary
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║  Summary                                  ║");
  console.log("╚══════════════════════════════════════════╝\n");

  for (const [key, ids] of Object.entries(result)) {
    const plan = PLANS.find((p) => p.plan_key === key);
    const price = plan ? `$${plan.base_price_cents / 100}/mo` : "";
    console.log(`  ${key.padEnd(16)} ${price.padEnd(12)} product: ${ids.product_id}`);
    console.log(`  ${"".padEnd(16)} ${"".padEnd(12)} base:    ${ids.price_id}`);
    console.log(`  ${"".padEnd(16)} ${"".padEnd(12)} overage: ${ids.overage_price_id}\n`);
  }

  if (!NO_SECRETS && !DRY_RUN && Object.keys(result).length > 0) {
    console.log("  Next steps:");
    console.log("    1. Redeploy edge functions to pick up new price-ID secrets:");
    const ref = process.env.SUPABASE_PROJECT_REF || "<project-ref>";
    console.log(`       supabase functions deploy --project-ref ${ref}`);
    console.log("    2. Verify live checkout works with the new prices.");
  }

  console.log("\n✅ Sync complete\n");
}

main().catch((err) => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
