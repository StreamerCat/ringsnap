/*
 * ═══════════════════════════════════════════════════════════════════════════
 * FUNCTION: provision-account (HYBRID ONBOARDING FLOW)
 *
 * PURPOSE: Provision Stripe + Vapi resources for accounts that have completed
 *          the onboarding chat flow.
 *
 * CORE FLOW:
 *   1. Load account configuration from DB (instead of accepting large payload)
 *   2. Validate required fields
 *   3. Create/link Stripe customer (if not exists)
 *   4. Create Stripe subscription (trial)
 *   5. Enqueue Vapi provisioning job (async)
 *   6. Update onboarding_status
 *
 * INPUT:
 *   {
 *     account_id: "uuid",
 *     user_id: "uuid",
 *     source: "trial" | "sales"
 *   }
 *
 * OUTPUT (Success):
 *   {
 *     success: true,
 *     account_id: "uuid",
 *     stripe_customer_id: "cus_xxx",
 *     stripe_subscription_id: "sub_xxx",
 *     provisioning_status: "pending"
 *   }
 *
 * OUTPUT (Failure):
 *   {
 *     success: false,
 *     error: "error message",
 *     error_code: "validation_failed" | "stripe_failed" | "db_failed"
 *   }
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "supabase";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { getStripePriceId as _getStripePriceId } from "../_shared/stripe-price-ids.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { extractCorrelationId, logError, logInfo, logWarn } from "../_shared/logging.ts";

const FUNCTION_NAME = "provision-account";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const provisionAccountSchema = z.object({
  account_id: z.string().uuid("Invalid account_id"),
  user_id: z.string().uuid("Invalid user_id"),
  source: z.enum(["trial", "sales"]).default("trial"),
});

/**
 * Get Stripe price ID for plan key — delegates to shared module
 * (env var → hardcoded production fallback → throws)
 */
function getStripePriceId(planType: string = "night_weekend"): string {
  return _getStripePriceId(planType);
}

/**
 * Generate correlation ID for tracking
 */
function generateCorrelationId(): string {
  return `provision-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const correlationId = extractCorrelationId(req) || generateCorrelationId();
  const request_id = crypto.randomUUID();

  const baseLogOptions = {
    function: FUNCTION_NAME,
    correlationId,
  };

  let phase = "init";

  try {
    logInfo("Starting provision-account", { ...baseLogOptions });

    // ═══════════════════════════════════════════════════════════════
    // INPUT VALIDATION
    // ═══════════════════════════════════════════════════════════════

    phase = "validate_input";
    let rawData: any;
    try {
      rawData = await req.json();
    } catch (err: any) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let data: z.infer<typeof provisionAccountSchema>;
    try {
      data = provisionAccountSchema.parse(rawData);
    } catch (zodError: any) {
      logWarn("Validation error in provision-account", {
        ...baseLogOptions,
        context: { errors: zodError.errors },
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid input data",
          error_code: "validation_failed",
          details: zodError.errors,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logInfo("Provisioning account", {
      ...baseLogOptions,
      context: {
        account_id: data.account_id,
        user_id: data.user_id,
        source: data.source,
      },
    });

    // ═══════════════════════════════════════════════════════════════
    // INITIALIZE CLIENTS
    // ═══════════════════════════════════════════════════════════════

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing");
    }

    if (!stripeSecretKey) {
      throw new Error("Stripe configuration missing");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // ═══════════════════════════════════════════════════════════════
    // LOAD ACCOUNT DATA FROM DB
    // ═══════════════════════════════════════════════════════════════

    phase = "load_account";

    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("*")
      .eq("id", data.account_id)
      .single();

    if (accountError || !account) {
      logError("Account not found", {
        ...baseLogOptions,
        context: { account_id: data.account_id, error: accountError },
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Account not found",
          error_code: "db_failed",
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", data.user_id)
      .single();

    if (profileError || !profile) {
      logError("Profile not found", {
        ...baseLogOptions,
        context: { user_id: data.user_id, error: profileError },
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "User profile not found",
          error_code: "db_failed",
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load auth user for email
    const { data: { user: authUser }, error: authError } = await supabase.auth.admin.getUserById(
      data.user_id
    );

    if (authError || !authUser) {
      logError("Auth user not found", {
        ...baseLogOptions,
        context: { user_id: data.user_id, error: authError },
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Auth user not found",
          error_code: "db_failed",
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // VALIDATE REQUIRED FIELDS
    // ═══════════════════════════════════════════════════════════════

    phase = "validate_fields";

    const missingFields: string[] = [];

    if (!account.company_name) missingFields.push("company_name");
    if (!account.destination_phone) missingFields.push("destination_phone");

    if (missingFields.length > 0) {
      logWarn("Missing required fields", {
        ...baseLogOptions,
        context: { missing: missingFields },
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: `Missing required fields: ${missingFields.join(", ")}`,
          error_code: "validation_failed",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // STRIPE: Create/Link Customer
    // ═══════════════════════════════════════════════════════════════

    phase = "stripe_customer";

    let stripeCustomerId = account.stripe_customer_id;

    if (!stripeCustomerId) {
      // Create new Stripe customer
      try {
        const customer = await stripe.customers.create({
          email: authUser.email!,
          name: profile.name,
          phone: profile.phone,
          metadata: {
            account_id: account.id,
            company_name: account.company_name,
            source: data.source,
          },
        }, {
          idempotencyKey: `provision-${account.id}-customer`,
        });

        stripeCustomerId = customer.id;

        logInfo("Stripe customer created", {
          ...baseLogOptions,
          context: { customerId: customer.id },
        });

        // Save customer ID to account
        await supabase
          .from("accounts")
          .update({ stripe_customer_id: customer.id })
          .eq("id", account.id);

      } catch (err: any) {
        logError("Stripe customer creation failed", {
          ...baseLogOptions,
          context: { error: err.message },
        });

        // Update onboarding status to failed
        await supabase
          .from("profiles")
          .update({ onboarding_status: "provision_failed" })
          .eq("id", data.user_id);

        return new Response(
          JSON.stringify({
            success: false,
            error: "Failed to create Stripe customer",
            error_code: "stripe_failed",
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // STRIPE: Create Subscription
    // ═══════════════════════════════════════════════════════════════

    phase = "stripe_subscription";

    let stripeSubscriptionId = account.stripe_subscription_id;

    if (!stripeSubscriptionId) {
      // Create trial subscription using the account's plan_key (default: night_weekend)
      try {
        const accountPlanKey = account.plan_key || "night_weekend";
        const priceId = getStripePriceId(accountPlanKey);
        const subscription = await stripe.subscriptions.create({
          customer: stripeCustomerId,
          items: [{ price: priceId }],
          trial_period_days: 3,
          payment_behavior: "default_incomplete",
          metadata: {
            account_id: account.id,
            source: data.source,
            plan_key: accountPlanKey,
            plan_type: accountPlanKey,
          },
        }, {
          idempotencyKey: `provision-${account.id}-subscription`,
        });

        stripeSubscriptionId = subscription.id;

        logInfo("Stripe subscription created", {
          ...baseLogOptions,
          context: {
            subscriptionId: subscription.id,
            status: subscription.status,
            planKey: accountPlanKey,
          },
        });

        // Save subscription ID and plan_key to account
        await supabase
          .from("accounts")
          .update({
            stripe_subscription_id: subscription.id,
            plan_type: accountPlanKey,
            plan_key: accountPlanKey,
            subscription_status: "trial",
            trial_start_date: new Date().toISOString(),
            trial_end_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .eq("id", account.id);

      } catch (err: any) {
        logError("Stripe subscription creation failed", {
          ...baseLogOptions,
          context: { error: err.message },
        });

        // Update onboarding status to failed
        await supabase
          .from("profiles")
          .update({ onboarding_status: "provision_failed" })
          .eq("id", data.user_id);

        return new Response(
          JSON.stringify({
            success: false,
            error: "Failed to create Stripe subscription",
            error_code: "stripe_failed",
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // ENQUEUE VAPI PROVISIONING JOB
    // ═══════════════════════════════════════════════════════════════

    phase = "enqueue_vapi";

    try {
      // TODO: Determine area code from zip code or use default
      const areaCode = "415"; // Default for now

      const { error: jobError } = await supabase
        .from("provisioning_jobs")
        .insert({
          account_id: account.id,
          user_id: data.user_id,
          job_type: "create_assistant",
          status: "queued",
          metadata: {
            company_name: account.company_name,
            assistant_gender: account.assistant_gender || "female",
            assistant_tone: account.assistant_tone || "friendly",
            business_hours: account.business_hours || {},
            area_code: areaCode,
            correlation_id: correlationId,
          },
          correlation_id: correlationId,
        });

      if (jobError) {
        logError("Failed to enqueue provisioning job", {
          ...baseLogOptions,
          context: { error: jobError },
        });
      } else {
        logInfo("Provisioning job enqueued", {
          ...baseLogOptions,
          context: { account_id: account.id },
        });
      }

    } catch (err: any) {
      logError("Provisioning job enqueue error", {
        ...baseLogOptions,
        context: { error: err.message },
      });
      // Don't fail the whole operation for this
    }

    // ═══════════════════════════════════════════════════════════════
    // UPDATE ONBOARDING STATUS
    // ═══════════════════════════════════════════════════════════════

    phase = "update_status";

    await supabase
      .from("profiles")
      .update({ onboarding_status: "provisioning" })
      .eq("id", data.user_id);

    await supabase
      .from("accounts")
      .update({
        provisioning_status: "pending",
        provisioning_stage: "vapi_queued",
      })
      .eq("id", account.id);

    // ═══════════════════════════════════════════════════════════════
    // SUCCESS RESPONSE
    // ═══════════════════════════════════════════════════════════════

    logInfo("Provisioning initiated successfully", {
      ...baseLogOptions,
      context: {
        account_id: account.id,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        account_id: account.id,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        provisioning_status: "pending",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    logError(`Unexpected error in ${phase}`, {
      ...baseLogOptions,
      context: { error: error.message, stack: error.stack },
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Internal server error",
        error_code: "internal_error",
        phase,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
