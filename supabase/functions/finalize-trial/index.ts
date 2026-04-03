/*
 * ═══════════════════════════════════════════════════════════════════════════
 * FUNCTION: finalize-trial (TWO-STEP SIGNUP FLOW)
 *
 * PURPOSE: Complete account creation after Step 2 of the two-step signup flow.
 *          This is called after the user completes the onboarding chat and
 *          provides payment information.
 *
 * CORE FLOW:
 *   1. Load lead record by lead_id (from Step 1)
 *   2. Validate all Step 2 data
 *   3. Create Stripe customer (idempotent)
 *   4. Attach payment method
 *   5. Create Stripe subscription (3-day trial)
 *   6. Create account atomically (user + account + profile + roles)
 *   7. Update lead status to 'converted'
 *   8. Enqueue async provisioning job
 *   9. Return success with credentials
 *
 * INPUT:
 *   {
 *     lead_id: "uuid",          // From Step 1
 *     phone: "+15551234567",    // E.164 format
 *     companyName: "Acme Plumbing",
 *     trade: "plumbing",
 *     website?: "https://...",
 *     zipCode?: "12345",
 *     businessHours: {...},     // JSON object
 *     assistantGender: "male" | "female",
 *     assistantTone: "formal" | "friendly" | "casual",
 *     primaryGoal: "book_appointments" | "capture_leads" | "answer_questions" | "take_orders",
 *     planType: "starter" | "professional" | "premium",
 *     paymentMethodId: "pm_xxx"
 *   }
 *
 * OUTPUT (Success):
 *   {
 *     success: true,
 *     account_id: "uuid",
 *     user_id: "uuid",
 *     email: "user@example.com",
 *     password: "auto-generated",
 *     provisioning_status: "pending"
 *   }
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "supabase";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { extractCorrelationId, logError, logInfo, logWarn } from "../_shared/logging.ts";
import { isValidPhoneNumber } from "../_shared/validators.ts";

const FUNCTION_NAME = "finalize-trial";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, idempotency-key",
};

/**
 * Finalize Trial Input Schema
 */
const finalizeTrialSchema = z.object({
  // Lead reference (from Step 1)
  lead_id: z.string().uuid("Invalid lead_id"),

  // Contact info collected in Step 2
  phone: z.string().min(1, "Phone required"),

  // Business info collected in Step 2
  companyName: z.string().trim().min(1, "Company name required").max(200),
  trade: z.string().min(1, "Trade required").max(100),
  website: z.string().url("Invalid website URL").optional().or(z.literal("")),
  zipCode: z.string().regex(/^\d{5}$/, "ZIP code must be 5 digits").optional().or(z.literal("")),

  // Business operations
  businessHours: z.record(z.any()).optional(),

  // AI configuration
  assistantGender: z.enum(["male", "female"]).default("female"),
  assistantTone: z.enum(["formal", "friendly", "casual"]).default("friendly"),
  primaryGoal: z
    .enum(["book_appointments", "capture_leads", "answer_questions", "take_orders"])
    .optional(),

  // Plan & payment — accepts new plan keys and legacy keys
  planType: z.enum(["night_weekend", "lite", "core", "pro", "starter", "professional", "premium"])
    .default("night_weekend"),
  paymentMethodId: z.string().min(1, "Payment method required"),
});

/**
 * Generate secure random password
 */
function generateSecurePassword(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  return Array.from({ length: 16 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

/**
 * Get Stripe price ID for plan type — supports new plan keys and legacy mapping
 */
function getStripePriceId(planType: string): string {
  // Map legacy plan keys to new plan keys
  const legacyMap: Record<string, string> = {
    starter: "night_weekend",
    professional: "core",
    premium: "pro",
  };
  const normalizedPlan = legacyMap[planType] || planType;

  // New plan env vars
  const newPriceIds: Record<string, string | undefined> = {
    night_weekend: Deno.env.get("STRIPE_PRICE_ID_NIGHT_WEEKEND"),
    lite: Deno.env.get("STRIPE_PRICE_ID_LITE"),
    core: Deno.env.get("STRIPE_PRICE_ID_CORE"),
    pro: Deno.env.get("STRIPE_PRICE_ID_PRO"),
  };

  const priceId = newPriceIds[normalizedPlan];
  if (!priceId) {
    throw new Error(`Stripe price ID not configured for plan: ${planType}`);
  }
  return priceId;
}

/**
 * Derive US state from ZIP code
 */
function getStateFromZip(zipCode: string): string {
  const zip = parseInt(zipCode.substring(0, 3));

  if (zip >= 300 && zip <= 319) return "GA";
  if (zip >= 320 && zip <= 349) return "FL";
  if (zip >= 350 && zip <= 369) return "AL";
  if (zip >= 370 && zip <= 385) return "TN";
  if (zip >= 386 && zip <= 397) return "MS";
  if (zip >= 398 && zip <= 399) return "GA";
  if (zip >= 400 && zip <= 427) return "KY";
  if (zip >= 430 && zip <= 458) return "OH";
  if (zip >= 460 && zip <= 479) return "IN";
  if (zip >= 480 && zip <= 499) return "MI";
  if (zip >= 500 && zip <= 528) return "IA";
  if (zip >= 530 && zip <= 549) return "WI";
  if (zip >= 550 && zip <= 567) return "MN";
  if (zip >= 570 && zip <= 577) return "SD";
  if (zip >= 580 && zip <= 588) return "ND";
  if (zip >= 590 && zip <= 599) return "MT";
  if (zip >= 600 && zip <= 629) return "IL";
  if (zip >= 630 && zip <= 658) return "MO";
  if (zip >= 660 && zip <= 679) return "KS";
  if (zip >= 680 && zip <= 693) return "NE";
  if (zip >= 700 && zip <= 714) return "LA";
  if (zip >= 716 && zip <= 729) return "AR";
  if (zip >= 730 && zip <= 749) return "OK";
  if (zip >= 750 && zip <= 799) return "TX";
  if (zip >= 800 && zip <= 816) return "CO";
  if (zip >= 820 && zip <= 831) return "WY";
  if (zip >= 832 && zip <= 838) return "ID";
  if (zip >= 840 && zip <= 847) return "UT";
  if (zip >= 850 && zip <= 865) return "AZ";
  if (zip >= 870 && zip <= 884) return "NM";
  if (zip >= 889 && zip <= 899) return "NV";
  if (zip >= 900 && zip <= 961) return "CA";
  if (zip >= 967 && zip <= 968) return "HI";
  if (zip >= 970 && zip <= 979) return "OR";
  if (zip >= 980 && zip <= 994) return "WA";
  if (zip >= 995 && zip <= 999) return "AK";

  return "CA"; // Default fallback
}

/**
 * Cleanup Stripe resources on failure
 */
async function cleanupStripeResources(
  stripe: Stripe,
  customerId: string | null,
  subscriptionId: string | null,
  logOptions: any
): Promise<void> {
  try {
    if (subscriptionId) {
      logWarn("Canceling Stripe subscription due to account creation failure", {
        ...logOptions,
        context: { subscriptionId },
      });
      await stripe.subscriptions.cancel(subscriptionId);
    }

    if (customerId) {
      logWarn("Deleting Stripe customer due to account creation failure", {
        ...logOptions,
        context: { customerId },
      });
      await stripe.customers.del(customerId);
    }
  } catch (cleanupError: any) {
    logError("Stripe cleanup failed (non-critical)", {
      ...logOptions,
      error: cleanupError,
      context: { customerId, subscriptionId },
    });
  }
}

serve(async (req) => {
  const request_id = crypto.randomUUID();
  const correlationId = extractCorrelationId(req);
  const baseLogOptions = {
    functionName: FUNCTION_NAME,
    correlationId,
    request_id,
  };

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let currentAccountId: string | null = null;
  let currentUserId: string | null = null;
  let stripeCustomerId: string | null = null;
  let stripeSubscriptionId: string | null = null;
  let phase = "start";

  try {
    logInfo("Starting finalize-trial", baseLogOptions);

    // ═══════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // ═══════════════════════════════════════════════════════════════
    // INPUT VALIDATION
    // ═══════════════════════════════════════════════════════════════

    phase = "validate_input";

    let rawData: any;
    try {
      rawData = await req.json();
    } catch (err: any) {
      return new Response(
        JSON.stringify({ success: false, message: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize empty strings to undefined for optional fields
    const normalizedData = { ...rawData };
    const optionalFields = ['website', 'zipCode', 'businessHours', 'primaryGoal'];
    for (const field of optionalFields) {
      if (normalizedData[field] === "" || normalizedData[field] === null) {
        normalizedData[field] = undefined;
      }
    }

    let data: z.infer<typeof finalizeTrialSchema>;
    try {
      data = finalizeTrialSchema.parse(normalizedData);
    } catch (zodError: any) {
      logWarn("Validation error in finalize-trial", {
        ...baseLogOptions,
        context: { errors: zodError.errors },
      });

      return new Response(
        JSON.stringify({
          success: false,
          message: "Invalid input data",
          errors: zodError.errors,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate phone format
    if (!isValidPhoneNumber(data.phone)) {
      return new Response(
        JSON.stringify({ success: false, message: "Invalid phone number format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logInfo("Finalizing trial", {
      ...baseLogOptions,
      context: {
        lead_id: data.lead_id,
        planType: data.planType,
        hasPaymentMethod: !!data.paymentMethodId,
      },
    });

    // ═══════════════════════════════════════════════════════════════
    // LOAD LEAD FROM DATABASE
    // ═══════════════════════════════════════════════════════════════

    phase = "load_lead";

    const { data: lead, error: leadError } = await supabase
      .from("signup_leads")
      .select("*")
      .eq("id", data.lead_id)
      .single();

    if (leadError || !lead) {
      logError("Lead not found", {
        ...baseLogOptions,
        context: { lead_id: data.lead_id, error: leadError },
      });

      return new Response(
        JSON.stringify({
          success: false,
          message: "Lead not found. Please start the signup process again.",
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if lead already converted
    if (lead.completed_at || lead.account_id) {
      logWarn("Lead already converted", {
        ...baseLogOptions,
        context: { lead_id: data.lead_id, account_id: lead.account_id },
      });

      return new Response(
        JSON.stringify({
          success: false,
          message: "This signup has already been completed. Please sign in.",
          existing_account_id: lead.account_id,
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const email = lead.email;
    const name = lead.full_name || "User";

    logInfo("Lead loaded", {
      ...baseLogOptions,
      context: { email, name, lead_id: data.lead_id },
    });

    // ═══════════════════════════════════════════════════════════════
    // STRIPE: Create Customer
    // ═══════════════════════════════════════════════════════════════

    phase = "stripe_customer";

    const idempotencyPrefix = `finalize-${data.lead_id}`;

    let customer: Stripe.Customer;
    try {
      customer = await stripe.customers.create({
        email: email,
        name: name,
        phone: data.phone,
        metadata: {
          company_name: data.companyName,
          trade: data.trade,
          source: "website",
          signup_flow: "two-step-v2",
          lead_id: data.lead_id,
        },
      }, {
        idempotencyKey: `${idempotencyPrefix}-customer`,
      });

      stripeCustomerId = customer.id;

      logInfo("Stripe customer created", {
        ...baseLogOptions,
        context: { customerId: customer.id },
      });
    } catch (err: any) {
      logError("Stripe customer creation failed", {
        ...baseLogOptions,
        error: err,
      });

      return new Response(
        JSON.stringify({
          success: false,
          message: "Failed to create customer. Please try again.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // STRIPE: Attach Payment Method
    // ═══════════════════════════════════════════════════════════════

    phase = "stripe_payment_method";

    try {
      await stripe.paymentMethods.attach(data.paymentMethodId, {
        customer: customer.id,
      });

      await stripe.customers.update(customer.id, {
        invoice_settings: {
          default_payment_method: data.paymentMethodId,
        },
      });

      logInfo("Payment method attached", {
        ...baseLogOptions,
        context: { customerId: customer.id },
      });
    } catch (err: any) {
      logError("Payment method attachment failed", {
        ...baseLogOptions,
        error: err,
      });

      await cleanupStripeResources(stripe, customer.id, null, baseLogOptions);

      return new Response(
        JSON.stringify({
          success: false,
          message: err.message || "Failed to process payment method. Please try a different card.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // STRIPE: Create Subscription
    // ═══════════════════════════════════════════════════════════════

    phase = "stripe_subscription";

    // Normalize legacy plan keys → new plan keys
    const legacyPlanMap: Record<string, string> = {
      starter: "night_weekend",
      professional: "core",
      premium: "pro",
    };
    const normalizedPlanKey = legacyPlanMap[data.planType] || data.planType;

    // Map new plan keys back to legacy values for the plan_type column.
    // plan_type is constrained to ('starter','professional','premium'); plan_key holds new names.
    const newToLegacyPlanMap: Record<string, string> = {
      night_weekend: "starter",
      lite: "starter",
      core: "professional",
      pro: "premium",
    };
    const legacyPlanType = newToLegacyPlanMap[normalizedPlanKey] || data.planType || "starter";

    let subscription: Stripe.Subscription;
    try {
      const priceId = getStripePriceId(data.planType);
      subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: priceId }],
        trial_period_days: 3,
        payment_behavior: "default_incomplete",
        metadata: {
          source: "website",
          signup_flow: "two-step-v2",
          plan_key: normalizedPlanKey,
          plan_type: normalizedPlanKey,
          lead_id: data.lead_id,
        },
      }, {
        idempotencyKey: `${idempotencyPrefix}-subscription`,
      });

      stripeSubscriptionId = subscription.id;

      logInfo("Stripe subscription created", {
        ...baseLogOptions,
        context: {
          subscriptionId: subscription.id,
          planType: data.planType,
          status: subscription.status,
        },
      });
    } catch (err: any) {
      logError("Stripe subscription creation failed", {
        ...baseLogOptions,
        error: err,
      });

      await cleanupStripeResources(stripe, customer.id, null, baseLogOptions);

      return new Response(
        JSON.stringify({
          success: false,
          message: "Failed to create subscription. Please try again.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // DATABASE: Atomic Account Creation
    // ═══════════════════════════════════════════════════════════════

    phase = "account_insert";

    const tempPassword = generateSecurePassword();
    const trialEndDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const billingState = data.zipCode ? getStateFromZip(data.zipCode) : "CA";

    const accountData = {
      name: name,
      phone: data.phone,
      company_name: data.companyName,
      trade: data.trade,
      plan_type: legacyPlanType,            // legacy column — always a legacy value to satisfy original constraint
      plan_key: normalizedPlanKey,
      phone_number_area_code: data.zipCode?.slice(0, 3) || null,
      zip_code: data.zipCode || null,
      business_hours: data.businessHours ? JSON.stringify(data.businessHours) : null,
      assistant_gender: data.assistantGender,
      assistant_tone: data.assistantTone,
      company_website: data.website || null,
      billing_state: billingState,
      destination_phone: data.phone, // Use their phone as destination initially
    };

    let accountResult: any;

    try {
      const { data: accountTxResult, error: accountTxError } = await supabase.rpc(
        "create_account_transaction",
        {
          p_email: email,
          p_password: tempPassword,
          p_stripe_customer_id: customer.id,
          p_stripe_subscription_id: subscription.id,
          p_signup_channel: "website",
          p_sales_rep_id: null,
          p_account_data: accountData,
          p_correlation_id: correlationId,
        }
      );

      if (accountTxError) {
        // Check for duplicate email
        if (
          accountTxError.message?.toLowerCase().includes("already") ||
          accountTxError.message?.toLowerCase().includes("duplicate")
        ) {
          logWarn("Email already registered", {
            ...baseLogOptions,
            context: { email },
          });

          await cleanupStripeResources(stripe, customer.id, subscription.id, baseLogOptions);

          return new Response(
            JSON.stringify({
              success: false,
              message: "This email is already registered. Please sign in instead.",
            }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        throw accountTxError;
      }

      accountResult = accountTxResult;
      currentAccountId = accountResult.account_id;
      currentUserId = accountResult.user_id;

      logInfo("Account created atomically", {
        ...baseLogOptions,
        accountId: currentAccountId,
      });
    } catch (accountError: any) {
      logError("Account creation failed - running compensation", {
        ...baseLogOptions,
        error: accountError,
      });

      await cleanupStripeResources(stripe, customer.id, subscription.id, baseLogOptions);

      return new Response(
        JSON.stringify({
          success: false,
          message: accountError.message || "Failed to create account. Please try again.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // UPDATE LEAD TO CONVERTED
    // ═══════════════════════════════════════════════════════════════

    phase = "lead_update";

    try {
      await supabase
        .from("signup_leads")
        .update({
          auth_user_id: currentUserId,
          account_id: currentAccountId,
          profile_id: currentUserId,
          completed_at: new Date().toISOString(),
          phone: data.phone,
          metadata: {
            ...lead.metadata,
            companyName: data.companyName,
            trade: data.trade,
            website: data.website,
            planType: data.planType,
            primaryGoal: data.primaryGoal,
            conversion_flow: "two-step-v2",
          },
        })
        .eq("id", data.lead_id);

      logInfo("Lead marked as converted", {
        ...baseLogOptions,
        context: { lead_id: data.lead_id, account_id: currentAccountId },
      });
    } catch (err: any) {
      // Non-critical - don't fail the whole operation
      logWarn("Lead update failed (non-critical)", {
        ...baseLogOptions,
        error: err,
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // ENQUEUE PROVISIONING JOB
    // ═══════════════════════════════════════════════════════════════

    phase = "enqueue_provisioning";

    const disableVapiProvisioning = Deno.env.get("DISABLE_VAPI_PROVISIONING") === "true";

    if (!disableVapiProvisioning) {
      const jobMetadata = {
        company_name: data.companyName,
        trade: data.trade,
        business_hours: data.businessHours || {},
        assistant_gender: data.assistantGender,
        assistant_tone: data.assistantTone,
        area_code: data.zipCode?.slice(0, 3) || "415",
        fallback_phone: data.phone,
        primary_goal: data.primaryGoal,
        correlation_id: correlationId,
      };

      try {
        await supabase.from("provisioning_jobs").insert({
          account_id: currentAccountId,
          user_id: currentUserId,
          job_type: "provision_phone",
          status: "queued",
          metadata: jobMetadata,
          correlation_id: correlationId,
        });

        logInfo("Provisioning job enqueued", {
          ...baseLogOptions,
          accountId: currentAccountId,
        });
      } catch (err: any) {
        // Non-critical - don't fail the whole operation
        logWarn("Provisioning job enqueue failed (non-critical)", {
          ...baseLogOptions,
          error: err,
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // SUCCESS RESPONSE
    // ═══════════════════════════════════════════════════════════════

    logInfo("Trial finalized successfully", {
      ...baseLogOptions,
      accountId: currentAccountId,
      context: {
        planType: data.planType,
        subscriptionId: subscription.id,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        account_id: currentAccountId,
        user_id: currentUserId,
        email: email,
        password: tempPassword,
        stripe_customer_id: customer.id,
        stripe_subscription_id: subscription.id,
        trial_end_date: trialEndDate,
        plan_type: data.planType,
        provisioning_status: "pending",
        message: "Account created! Your AI receptionist is being set up...",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    logError("Unexpected error in finalize-trial", {
      ...baseLogOptions,
      error,
      context: { phase },
    });

    // Attempt cleanup if we have Stripe resources
    if (stripeCustomerId || stripeSubscriptionId) {
      try {
        const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
          apiVersion: "2023-10-16",
          httpClient: Stripe.createFetchHttpClient(),
        });
        await cleanupStripeResources(stripe, stripeCustomerId, stripeSubscriptionId, baseLogOptions);
      } catch {
        // Ignore cleanup errors
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        message: error.message || "Internal server error",
        phase,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
