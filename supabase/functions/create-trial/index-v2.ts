/*
 * ═══════════════════════════════════════════════════════════════════════════
 * FUNCTION: create-trial (Phase 2 - Unified Signup Engine)
 *
 * PURPOSE: Idempotent, observable, predictable signup flow for all channels
 *
 * CHANGES IN V2:
 *   - Replace 'source' with 'signup_channel' enum
 *   - Replace 'salesRepName' with 'sales_rep_id' UUID
 *   - Add idempotency check (email_exists)
 *   - Add Stripe rollback logic (compensating transactions)
 *   - Use create_account_transaction() stored procedure (atomic)
 *   - Add state transition logging
 *   - Enable Vapi via ENABLE_VAPI_PROVISIONING env var
 *
 * CORE FLOW (Idempotent, atomic):
 *   1. Input validation (Zod schema)
 *   2. Idempotency check (return existing if email exists)
 *   3. Anti-abuse checks (self-service only)
 *   4. Create/fetch Stripe customer (idempotent)
 *   5. Attach payment method (with rollback)
 *   6. Create Stripe subscription (with rollback)
 *   7. Create account in DB (atomic transaction)
 *   8. Send account setup email (async, non-blocking)
 *   9. Queue Vapi provisioning (async, non-blocking)
 *
 * ERROR HANDLING & ROLLBACK:
 *   - Stripe fails → Clean return, no orphans
 *   - PM attach fails → Rollback customer (or log orphan)
 *   - Subscription fails → Rollback customer + PM (or log orphan)
 *   - DB fails → Rollback Stripe resources (or log orphan)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { extractCorrelationId, logError, logInfo, logWarn } from "../_shared/logging.ts";
import { isDisposableEmail } from "../_shared/disposable-domains.ts";
import { isValidPhoneNumber } from "../_shared/validators.ts";

const FUNCTION_NAME = "create-trial-v2";
const ENABLE_VAPI_PROVISIONING = Deno.env.get("ENABLE_VAPI_PROVISIONING") === "true";
const VAPI_API_KEY = Deno.env.get("VAPI_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-correlation-id",
};

/**
 * Unified Trial Creation Schema (Phase 2)
 * BREAKING CHANGES:
 * - 'source' → 'signup_channel'
 * - 'salesRepName' → 'sales_rep_id'
 */
const createTrialSchema = z.object({
  // User info (required)
  name: z.string().trim().min(1, "Name required").max(100, "Name too long"),
  email: z.string().email("Invalid email").max(255, "Email too long"),
  phone: z.string().min(1, "Phone required"),

  // Business basics (required)
  companyName: z.string().trim().min(1, "Company name required").max(200, "Company name too long"),
  trade: z.string().min(1, "Trade required").max(100, "Trade too long"),

  // Business extended (optional)
  website: z.string().url("Invalid website URL").optional().or(z.literal("")),
  serviceArea: z.string().max(200, "Service area too long").optional(),
  zipCode: z.string().regex(/^\d{5}$/, "ZIP code must be 5 digits").optional().or(z.literal("")),

  // Business operations (optional)
  businessHours: z.string().max(500).optional(),
  emergencyPolicy: z.string().max(1000).optional(),

  // AI configuration
  assistantGender: z.enum(["male", "female"]).default("female"),
  primaryGoal: z
    .enum(["book_appointments", "capture_leads", "answer_questions", "take_orders"])
    .optional(),
  wantsAdvancedVoice: z.boolean().optional().default(false),

  // Plan & payment
  planType: z.enum(["starter", "professional", "premium"], {
    required_error: "Plan type required",
  }),
  paymentMethodId: z.string().min(1, "Payment method required"),

  // Channel tracking (NEW IN PHASE 2)
  signup_channel: z.enum(["self_service", "sales_guided", "enterprise"]).default("self_service"),
  sales_rep_id: z.string().uuid().optional().nullable(),  // UUID of logged-in sales rep

  // Optional metadata
  referralCode: z.string().length(8).optional().or(z.literal("")),
  deviceFingerprint: z.string().max(500).optional(),
  leadId: z.union([z.string().uuid(), z.null(), z.undefined()]).optional(),
});

/**
 * Normalize payload to handle null/empty values for optional fields
 */
function normalizePayload(rawPayload: any): any {
  const normalized = { ...rawPayload };

  const optionalFields = ['leadId', 'referralCode', 'deviceFingerprint', 'website', 'serviceArea', 'zipCode', 'businessHours', 'emergencyPolicy', 'primaryGoal', 'sales_rep_id'];

  for (const field of optionalFields) {
    if (normalized[field] === null || normalized[field] === "") {
      normalized[field] = undefined;
    }
  }

  return normalized;
}

/**
 * Generate secure random password for user account
 */
function generateSecurePassword(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  return Array.from({ length: 16 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

/**
 * Get Stripe price ID for plan type
 */
function getStripePriceId(planType: string): string {
  const priceIds = {
    starter: Deno.env.get("STRIPE_PRICE_STARTER"),
    professional: Deno.env.get("STRIPE_PRICE_PROFESSIONAL"),
    premium: Deno.env.get("STRIPE_PRICE_PREMIUM"),
  };

  const priceId = priceIds[planType as keyof typeof priceIds];
  if (!priceId) {
    throw new Error(`Stripe price ID not configured for plan: ${planType}`);
  }
  return priceId;
}

/**
 * Derive US state from ZIP code (simplified mapping)
 */
function getStateFromZip(zipCode: string): string {
  if (!zipCode || zipCode.length < 3) return "CA";

  const zip = parseInt(zipCode.substring(0, 3));

  // Simplified ZIP to state mapping
  if (zip >= 300 && zip <= 319) return "GA";
  if (zip >= 320 && zip <= 349) return "FL";
  if (zip >= 350 && zip <= 369) return "AL";
  if (zip >= 370 && zip <= 385) return "TN";
  if (zip >= 386 && zip <= 399) return "MS";
  if (zip >= 400 && zip <= 427) return "KY";
  if (zip >= 430 && zip <= 458) return "OH";
  if (zip >= 460 && zip <= 479) return "IN";
  if (zip >= 480 && zip <= 499) return "MI";
  if (zip >= 500 && zip <= 528) return "IA";
  if (zip >= 530 && zip <= 549) return "WI";
  if (zip >= 550 && zip <= 567) return "MN";
  if (zip >= 570 && zip <= 588) return "ND";
  if (zip >= 590 && zip <= 599) return "MT";
  if (zip >= 600 && zip <= 629) return "IL";
  if (zip >= 630 && zip <= 658) return "MO";
  if (zip >= 660 && zip <= 679) return "KS";
  if (zip >= 680 && zip <= 693) return "NE";
  if (zip >= 700 && zip <= 729) return "AR";
  if (zip >= 730 && zip <= 749) return "OK";
  if (zip >= 750 && zip <= 799) return "TX";
  if (zip >= 800 && zip <= 831) return "CO";
  if (zip >= 832 && zip <= 847) return "UT";
  if (zip >= 850 && zip <= 884) return "NM";
  if (zip >= 889 && zip <= 899) return "NV";
  if (zip >= 900 && zip <= 961) return "CA";
  if (zip >= 967 && zip <= 968) return "HI";
  if (zip >= 970 && zip <= 979) return "OR";
  if (zip >= 980 && zip <= 994) return "WA";
  if (zip >= 995 && zip <= 999) return "AK";

  return "CA"; // Default fallback
}

/**
 * NEW PHASE 2: Rollback Stripe resources (compensating transaction)
 */
async function rollbackStripeResources(
  stripe: Stripe,
  supabase: any,
  customerId: string,
  subscriptionId: string | null,
  correlationId: string,
  failureReason: string
): Promise<void> {
  const logOpts = { functionName: "rollback-stripe", correlationId };

  try {
    // Cancel subscription first (if exists)
    if (subscriptionId) {
      await stripe.subscriptions.cancel(subscriptionId);
      logInfo("Subscription cancelled during rollback", {
        ...logOpts,
        context: { subscriptionId }
      });
    }

    // Delete customer
    await stripe.customers.del(customerId);
    logInfo("Customer deleted during rollback", {
      ...logOpts,
      context: { customerId }
    });

  } catch (cleanupError) {
    logError("Rollback failed, logging orphaned resource", {
      ...logOpts,
      error: cleanupError,
      context: { customerId, subscriptionId }
    });

    // Log to orphaned_stripe_resources table for manual cleanup
    try {
      await supabase.rpc("log_orphaned_stripe_resource", {
        p_stripe_customer_id: customerId,
        p_stripe_subscription_id: subscriptionId,
        p_correlation_id: correlationId,
        p_error: cleanupError.message,
        p_failure_reason: failureReason,
        p_metadata: {}
      });
    } catch (logError) {
      // If logging fails, at least we tried
      console.error("Failed to log orphaned resource:", logError);
    }
  }
}

serve(async (req) => {
  const correlationId = extractCorrelationId(req);
  const baseLogOptions = {
    functionName: FUNCTION_NAME,
    correlationId,
  };

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let stripeCustomerId: string | null = null;
  let stripeSubscriptionId: string | null = null;
  let currentStep = "start";

  try {
    logInfo("Function invoked", {
      ...baseLogOptions,
      context: { method: req.method }
    });

    // ═══════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════

    currentStep = "initialization";

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

    logInfo("Clients initialized", baseLogOptions);

    // ═══════════════════════════════════════════════════════════════
    // INPUT VALIDATION
    // ═══════════════════════════════════════════════════════════════

    currentStep = "parse-body";
    const rawData = await req.json();

    logInfo("Request received", {
      ...baseLogOptions,
      context: {
        email: rawData.email,
        signup_channel: rawData.signup_channel,
        planType: rawData.planType,
      }
    });

    // Normalize and validate
    const normalizedData = normalizePayload(rawData);
    const validationResult = createTrialSchema.safeParse(normalizedData);

    if (!validationResult.success) {
      const errors = validationResult.error.format();
      logWarn("Validation failed", {
        ...baseLogOptions,
        context: { errors }
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Validation failed",
          details: errors,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = validationResult.data;
    currentStep = "validated";

    // ═══════════════════════════════════════════════════════════════
    // PHASE 2 NEW: IDEMPOTENCY CHECK
    // ═══════════════════════════════════════════════════════════════

    currentStep = "idempotency-check";

    logInfo("Checking if email already exists", {
      ...baseLogOptions,
      context: { email: data.email }
    });

    const { data: existingAccountData, error: existingError } = await supabase
      .rpc("get_account_by_email", { p_email: data.email });

    if (!existingError && existingAccountData && existingAccountData.length > 0) {
      const existing = existingAccountData[0];

      logInfo("Account already exists (idempotent response)", {
        ...baseLogOptions,
        context: {
          accountId: existing.account_id,
          userId: existing.user_id,
          provisioningStage: existing.provisioning_stage
        }
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: "Account already exists",
          account_id: existing.account_id,
          user_id: existing.user_id,
          email: data.email,
          provisioning_stage: existing.provisioning_stage,
          subscription_status: existing.subscription_status,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // PHONE & EMAIL VALIDATION
    // ═══════════════════════════════════════════════════════════════

    currentStep = "phone-email-validation";

    if (!isValidPhoneNumber(data.phone)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid phone number format. Please use US format (xxx) xxx-xxxx",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (await isDisposableEmail(data.email)) {
      logWarn("Disposable email blocked", {
        ...baseLogOptions,
        context: { email: data.email }
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Disposable email addresses are not allowed",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // ANTI-ABUSE (Self-Service Only)
    // ═══════════════════════════════════════════════════════════════

    if (data.signup_channel === "self_service") {
      currentStep = "anti-abuse-checks";

      // IP-based rate limiting
      const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";

      // Check IP rate limit (3 successful trials per 30 days)
      const { data: recentTrials, error: rateLimitError } = await supabase
        .from("signup_attempts")
        .select("*")
        .eq("ip_address", ipAddress)
        .eq("success", true)
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .limit(3);

      if (!rateLimitError && recentTrials && recentTrials.length >= 3) {
        logWarn("IP rate limit exceeded", {
          ...baseLogOptions,
          context: { ipAddress, trialCount: recentTrials.length }
        });

        // Log failed attempt
        await supabase.from("signup_attempts").insert({
          email: data.email,
          phone: data.phone,
          ip_address: ipAddress,
          device_fingerprint: data.deviceFingerprint,
          success: false,
          blocked_reason: "ip_rate_limit"
        });

        return new Response(
          JSON.stringify({
            success: false,
            error: "Trial limit reached for this location. Please contact support.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Check phone reuse (30-day window)
      const { data: recentPhoneUse, error: phoneCheckError } = await supabase
        .from("signup_attempts")
        .select("*")
        .eq("phone", data.phone)
        .eq("success", true)
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (!phoneCheckError && recentPhoneUse && recentPhoneUse.length > 0) {
        logWarn("Phone number reused within 30 days", {
          ...baseLogOptions,
          context: { phone: data.phone }
        });

        await supabase.from("signup_attempts").insert({
          email: data.email,
          phone: data.phone,
          ip_address: ipAddress,
          device_fingerprint: data.deviceFingerprint,
          success: false,
          blocked_reason: "phone_reuse"
        });

        return new Response(
          JSON.stringify({
            success: false,
            error: "This phone number was recently used for a trial. Please contact support.",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // PHASE 2: STRIPE CUSTOMER (Idempotent)
    // ═══════════════════════════════════════════════════════════════

    currentStep = "stripe-customer";

    let stripeCustomer: Stripe.Customer;

    // Check if Stripe customer already exists for this email
    const existingCustomers = await stripe.customers.search({
      query: `email:'${data.email}'`,
      limit: 1
    });

    if (existingCustomers.data.length > 0) {
      stripeCustomer = existingCustomers.data[0];
      stripeCustomerId = stripeCustomer.id;

      logInfo("Stripe customer already exists (idempotent)", {
        ...baseLogOptions,
        context: { customerId: stripeCustomer.id }
      });
    } else {
      // Create new Stripe customer
      stripeCustomer = await stripe.customers.create({
        email: data.email,
        name: data.name,
        phone: data.phone,
        metadata: {
          company_name: data.companyName,
          trade: data.trade,
          signup_channel: data.signup_channel,
          sales_rep_id: data.sales_rep_id || "",
          correlation_id: correlationId
        },
      });

      stripeCustomerId = stripeCustomer.id;

      logInfo("Stripe customer created", {
        ...baseLogOptions,
        context: { customerId: stripeCustomerId }
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // PHASE 2: ATTACH PAYMENT METHOD (With Rollback)
    // ═══════════════════════════════════════════════════════════════

    currentStep = "attach-payment-method";

    try {
      await stripe.paymentMethods.attach(data.paymentMethodId, {
        customer: stripeCustomerId,
      });

      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: {
          default_payment_method: data.paymentMethodId,
        },
      });

      logInfo("Payment method attached", {
        ...baseLogOptions,
        context: { customerId: stripeCustomerId }
      });

    } catch (pmError) {
      logError("Payment method attach failed", {
        ...baseLogOptions,
        error: pmError,
        context: { customerId: stripeCustomerId }
      });

      // Rollback: Delete Stripe customer
      await rollbackStripeResources(
        stripe,
        supabase,
        stripeCustomerId,
        null,
        correlationId,
        "payment_method_attach_failed"
      );

      return new Response(
        JSON.stringify({
          success: false,
          error: "Payment method setup failed. Please check your card and try again.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // PHASE 2: CREATE SUBSCRIPTION (With Rollback)
    // ═══════════════════════════════════════════════════════════════

    currentStep = "create-subscription";

    let subscription: Stripe.Subscription;

    try {
      subscription = await stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [{ price: getStripePriceId(data.planType) }],
        trial_period_days: 3,
        payment_behavior: "default_incomplete",
        metadata: {
          signup_channel: data.signup_channel,
          sales_rep_id: data.sales_rep_id || "",
          plan_type: data.planType,
          correlation_id: correlationId
        },
      });

      stripeSubscriptionId = subscription.id;

      logInfo("Stripe subscription created", {
        ...baseLogOptions,
        context: { subscriptionId: stripeSubscriptionId }
      });

    } catch (subError) {
      logError("Subscription creation failed", {
        ...baseLogOptions,
        error: subError,
        context: { customerId: stripeCustomerId }
      });

      // Rollback: Delete customer (subscription doesn't exist yet)
      await rollbackStripeResources(
        stripe,
        supabase,
        stripeCustomerId,
        null,
        correlationId,
        "subscription_creation_failed"
      );

      return new Response(
        JSON.stringify({
          success: false,
          error: "Subscription setup failed. Please check your payment method.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // PHASE 2: CREATE ACCOUNT (Atomic Transaction)
    // ═══════════════════════════════════════════════════════════════

    currentStep = "create-account-transaction";

    const tempPassword = generateSecurePassword();

    // Parse business hours if provided
    let businessHoursValue: any = null;
    if (data.businessHours) {
      try {
        businessHoursValue = JSON.parse(data.businessHours);
      } catch {
        businessHoursValue = { text: data.businessHours };
      }
    }

    // Build account data payload
    const accountDataPayload = {
      name: data.name,
      phone: data.phone,
      company_name: data.companyName,
      trade: data.trade,
      plan_type: data.planType,
      phone_number_area_code: data.zipCode ? data.zipCode.slice(0, 3) : null,
      zip_code: data.zipCode || null,
      business_hours: businessHoursValue ? JSON.stringify(businessHoursValue) : null,
      assistant_gender: data.assistantGender,
      wants_advanced_voice: data.wantsAdvancedVoice,
      company_website: data.website || null,
      service_area: data.serviceArea || null,
      emergency_policy: data.emergencyPolicy || null,
      billing_state: data.zipCode ? getStateFromZip(data.zipCode) : "CA"
    };

    let accountResult: any;

    try {
      const { data: txResult, error: txError } = await supabase.rpc("create_account_transaction", {
        p_email: data.email,
        p_password: tempPassword,
        p_stripe_customer_id: stripeCustomerId,
        p_stripe_subscription_id: stripeSubscriptionId,
        p_signup_channel: data.signup_channel,
        p_sales_rep_id: data.sales_rep_id || null,
        p_account_data: accountDataPayload,
        p_correlation_id: correlationId
      });

      if (txError) {
        throw txError;
      }

      accountResult = txResult;

      logInfo("Account transaction completed", {
        ...baseLogOptions,
        context: {
          accountId: accountResult.account_id,
          userId: accountResult.user_id,
          provisioningStage: accountResult.provisioning_stage
        }
      });

    } catch (dbError) {
      logError("Database transaction failed", {
        ...baseLogOptions,
        error: dbError,
        context: {
          customerId: stripeCustomerId,
          subscriptionId: stripeSubscriptionId
        }
      });

      // Rollback: Cancel Stripe subscription + customer
      await rollbackStripeResources(
        stripe,
        supabase,
        stripeCustomerId,
        stripeSubscriptionId,
        correlationId,
        "db_transaction_failed"
      );

      return new Response(
        JSON.stringify({
          success: false,
          error: "Account setup failed. No charges were made. Please try again.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // PHASE 2: SEND ACCOUNT SETUP EMAIL (Async, non-blocking)
    // ═══════════════════════════════════════════════════════════════

    currentStep = "send-email";

    // TODO Phase 3: Implement sendAccountSetupEmail()
    // For now, log that we would send email
    logInfo("Account setup email would be sent here (Phase 3)", {
      ...baseLogOptions,
      context: {
        email: data.email,
        accountId: accountResult.account_id
      }
    });

    // ═══════════════════════════════════════════════════════════════
    // PHASE 2: QUEUE VAPI PROVISIONING (Async, non-blocking)
    // ═══════════════════════════════════════════════════════════════

    currentStep = "queue-vapi-provisioning";

    let vapiProvisioningStatus = "disabled";

    if (ENABLE_VAPI_PROVISIONING && VAPI_API_KEY) {
      try {
        const { error: jobError } = await supabase.from("provisioning_jobs").insert({
          account_id: accountResult.account_id,
          user_id: accountResult.user_id,
          job_type: "full_provisioning",
          status: "queued",
          correlation_id: correlationId,
          metadata: {
            assistant_gender: data.assistantGender,
            company_name: data.companyName,
            phone: data.phone,
            area_code: data.zipCode ? data.zipCode.slice(0, 3) : null,
            primary_goal: data.primaryGoal || "answer_questions"
          }
        });

        if (jobError) {
          throw jobError;
        }

        // Log state transition
        await supabase.rpc("log_state_transition", {
          p_account_id: accountResult.account_id,
          p_from_stage: "stripe_linked",
          p_to_stage: "vapi_queued",
          p_triggered_by: FUNCTION_NAME,
          p_correlation_id: correlationId,
          p_metadata: {}
        });

        logInfo("Vapi provisioning job queued", {
          ...baseLogOptions,
          context: { accountId: accountResult.account_id }
        });

        vapiProvisioningStatus = "queued";

      } catch (queueError) {
        logError("Failed to queue Vapi provisioning (non-critical)", {
          ...baseLogOptions,
          error: queueError
        });
        vapiProvisioningStatus = "failed_to_queue";
      }
    } else {
      logInfo("Vapi provisioning disabled", baseLogOptions);
    }

    // ═══════════════════════════════════════════════════════════════
    // LOG ANALYTICS (Self-Service Only)
    // ═══════════════════════════════════════════════════════════════

    if (data.signup_channel === "self_service") {
      const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";

      await supabase.from("signup_attempts").insert({
        email: data.email,
        phone: data.phone,
        ip_address: ipAddress,
        device_fingerprint: data.deviceFingerprint,
        success: true,
        blocked_reason: null
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // LINK LEAD (If provided)
    // ═══════════════════════════════════════════════════════════════

    if (data.leadId) {
      try {
        await supabase
          .from("signup_leads")
          .update({
            auth_user_id: accountResult.user_id,
            account_id: accountResult.account_id,
            profile_id: accountResult.user_id,
            completed_at: new Date().toISOString()
          })
          .eq("id", data.leadId);

        logInfo("Lead linked to account", {
          ...baseLogOptions,
          context: { leadId: data.leadId, accountId: accountResult.account_id }
        });
      } catch (leadError) {
        logWarn("Failed to link lead (non-critical)", {
          ...baseLogOptions,
          error: leadError
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // SUCCESS RESPONSE
    // ═══════════════════════════════════════════════════════════════

    const successMessage = data.signup_channel === "sales_guided"
      ? `Account created successfully! Customer will receive setup email at ${data.email}.`
      : "Trial started! Check your email to complete account setup.";

    const response = {
      success: true,
      message: successMessage,

      // Primary identifiers
      account_id: accountResult.account_id,
      user_id: accountResult.user_id,
      email: data.email,

      // Password (only for sales-guided - Phase 3 will remove this)
      password: data.signup_channel === "sales_guided" ? tempPassword : null,

      // Stripe info
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,

      // Trial info
      trial_end_date: accountResult.trial_end_date,
      plan_type: data.planType,

      // Channel tracking
      signup_channel: data.signup_channel,

      // Provisioning status
      provisioning_stage: accountResult.provisioning_stage,
      provisioning_status: vapiProvisioningStatus,

      // Correlation
      correlation_id: correlationId,

      // Legacy fields for backward compatibility
      ok: true,
      accountId: accountResult.account_id,
      stripeCustomerId: stripeCustomerId,
      stripeSubscriptionId: stripeSubscriptionId,
    };

    logInfo("Signup completed successfully", {
      ...baseLogOptions,
      context: {
        accountId: accountResult.account_id,
        signupChannel: data.signup_channel,
        provisioningStatus: vapiProvisioningStatus
      }
    });

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    logError("Unhandled error in signup flow", {
      ...baseLogOptions,
      error,
      context: {
        currentStep,
        stripeCustomerId,
        stripeSubscriptionId
      }
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "An unexpected error occurred",
        step: currentStep,
        correlation_id: correlationId
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
