/*
 * ═══════════════════════════════════════════════════════════════════════════
 * FUNCTION: create-trial (REFACTORED FOR ASYNC PROVISIONING)
 *
 * PURPOSE: Create new trial or paid accounts with idempotency and async provisioning
 *
 * CORE FLOW (Idempotent & Atomic):
 *   1. Check idempotency key (return cached response if duplicate)
 *   2. Input validation
 *   3. Anti-abuse checks (website only)
 *   4. Create Stripe customer (with idempotency)
 *   5. Attach payment method
 *   6. Create Stripe subscription (with idempotency)
 *   7. Create account atomically (user + account + profile + roles)
 *   8. Link lead (if provided)
 *   9. Enqueue async provisioning job
 *   10. Return success with provisioning_status='pending'
 *
 * COMPENSATION LOGIC:
 *   - If account creation fails after Stripe setup:
 *     → Cancel Stripe subscription
 *     → Delete Stripe customer
 *     → Clean up partial data
 *
 * ASYNC PROVISIONING:
 *   - Vapi provisioning moved to separate provision-vapi worker
 *   - Worker polls provisioning_jobs table
 *   - Implements retry with exponential backoff
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

const FUNCTION_NAME = "create-trial";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, idempotency-key",
};

/**
 * Unified Trial Creation Schema
 * Supports both self-serve (website) and sales-guided flows
 */
const createTrialSchema = z.object({
  // User info (required for both flows)
  name: z.string().trim().min(1, "Name required").max(100, "Name too long"),
  email: z.string().email("Invalid email").max(255, "Email too long"),
  phone: z.string().min(1, "Phone required"),

  // Business basics (required for both flows)
  companyName: z.string().trim().min(1, "Company name required").max(200, "Company name too long"),
  trade: z.string().min(1, "Trade required").max(100, "Trade too long"),

  // Business extended (optional - self-serve provides more detail)
  website: z.string().url("Invalid website URL").optional().or(z.literal("")),
  serviceArea: z.string().max(200, "Service area too long").optional(),
  zipCode: z.string().regex(/^\d{5}$/, "ZIP code must be 5 digits").optional().or(z.literal("")),

  // Business operations (optional - sales flow uses these)
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

  // Source tracking (CRITICAL - differentiates flows)
  source: z.enum(["website", "sales"]).default("website"),
  salesRepName: z.string().max(100).optional(),

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
  const optionalFields = [
    'leadId', 'referralCode', 'deviceFingerprint', 'website', 'serviceArea',
    'zipCode', 'businessHours', 'emergencyPolicy', 'primaryGoal', 'salesRepName'
  ];

  for (const field of optionalFields) {
    if (normalized[field] === null || normalized[field] === "") {
      normalized[field] = undefined;
    }
  }

  return normalized;
}

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
 * Hash request body for duplicate detection
 */
async function hashRequest(body: any): Promise<string> {
  const normalized = JSON.stringify(body, Object.keys(body).sort());
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Cleanup Stripe resources on failure (compensation logic)
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
  const correlationId = extractCorrelationId(req);
  const baseLogOptions = {
    functionName: FUNCTION_NAME,
    correlationId,
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
    console.log(`[${FUNCTION_NAME}] phase: ${phase}`);

    // ═══════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════

    phase = "initialization";
    console.log(`[${FUNCTION_NAME}] phase: ${phase}`);

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

    phase = "clients-initialized";
    console.log(`[${FUNCTION_NAME}] phase: ${phase}`);

    // ═══════════════════════════════════════════════════════════════
    // IDEMPOTENCY CHECK
    // ═══════════════════════════════════════════════════════════════

    phase = "idempotency-check";
    console.log(`[${FUNCTION_NAME}] phase: ${phase}`);

    const idempotencyKey = req.headers.get("idempotency-key") || req.headers.get("Idempotency-Key");

    if (idempotencyKey) {
      logInfo("Checking idempotency key", {
        ...baseLogOptions,
        context: { idempotencyKey },
      });

      const { data: existingResult, error: idempotencyError } = await supabase
        .from("idempotency_results")
        .select("status_code, response_body, response_headers")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();

      if (idempotencyError) {
        logWarn("Idempotency check failed (continuing)", {
          ...baseLogOptions,
          error: idempotencyError,
        });
      } else if (existingResult) {
        logInfo("Returning cached response for duplicate request", {
          ...baseLogOptions,
          context: { idempotencyKey, statusCode: existingResult.status_code },
        });

        return new Response(
          JSON.stringify(existingResult.response_body),
          {
            status: existingResult.status_code,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
              "X-Idempotency-Replay": "true",
            },
          }
        );
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // INPUT VALIDATION
    // ═══════════════════════════════════════════════════════════════

    phase = "body-parsed";
    console.log(`[${FUNCTION_NAME}] phase: ${phase}`);
    const rawData = await req.json();

    logInfo("Raw request body received", {
      ...baseLogOptions,
      context: {
        email: rawData.email,
        source: rawData.source,
        planType: rawData.planType,
        leadId: rawData.leadId,
        hasPaymentMethod: !!rawData.paymentMethodId,
      },
    });

    const normalizedData = normalizePayload(rawData);
    let data: z.infer<typeof createTrialSchema>;

    try {
      data = createTrialSchema.parse(normalizedData);
    } catch (zodError: any) {
      logWarn("Validation error in create-trial", {
        ...baseLogOptions,
        context: { errors: zodError.errors, rawLeadId: rawData.leadId },
      });

      return new Response(
        JSON.stringify({
          error: "Invalid input data",
          details: zodError.errors,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    phase = "input-validated";
    console.log(`[${FUNCTION_NAME}] phase: ${phase}`);

    logInfo("Creating trial account", {
      ...baseLogOptions,
      context: {
        email: data.email,
        source: data.source,
        salesRep: data.salesRepName,
        planType: data.planType,
      },
    });

    // ═══════════════════════════════════════════════════════════════
    // VALIDATION: Phone and email checks
    // ═══════════════════════════════════════════════════════════════

    phase = "validate-phone-email";
    console.log(`[${FUNCTION_NAME}] phase: ${phase}`);
    if (!isValidPhoneNumber(data.phone)) {
      console.log("[create-trial] Invalid phone number", { phone: data.phone });
      return new Response(
        JSON.stringify({ error: "Invalid phone number format" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (isDisposableEmail(data.email)) {
      console.log("[create-trial] Blocked disposable email", { email: data.email });
      logWarn("Blocked disposable email", {
        ...baseLogOptions,
        context: { email: data.email },
      });

      return new Response(
        JSON.stringify({
          error: "Please use a valid business or personal email address",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    phase = "phone-email-validated";
    console.log(`[${FUNCTION_NAME}] phase: ${phase}`);

    // ═══════════════════════════════════════════════════════════════
    // ANTI-ABUSE: Rate limiting (website signups only)
    // ═══════════════════════════════════════════════════════════════

    phase = "rate-limit-checks";
    console.log(`[${FUNCTION_NAME}] phase: ${phase}`);
    if (data.source === "website") {
      const clientIP =
        req.headers.get("x-forwarded-for")?.split(",")[0] ||
        req.headers.get("cf-connecting-ip") ||
        "unknown";

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { count: ipAttempts } = await supabase
        .from("signup_attempts")
        .select("*", { count: "exact", head: true })
        .eq("ip_address", clientIP)
        .eq("success", true)
        .gte("created_at", thirtyDaysAgo.toISOString());

      if (ipAttempts && ipAttempts >= 3) {
        console.log("[create-trial] IP rate limit exceeded", { clientIP, ipAttempts });
        logWarn("IP rate limit exceeded", {
          ...baseLogOptions,
          context: { clientIP, ipAttempts },
        });

        await supabase.from("signup_attempts").insert({
          email: data.email,
          phone: data.phone,
          ip_address: clientIP,
          device_fingerprint: data.deviceFingerprint,
          success: false,
          blocked_reason: "IP rate limit exceeded (3 trials per 30 days)",
        });

        return new Response(
          JSON.stringify({
            error: "Trial limit reached for this location. Please contact support.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Check phone number reuse
      const { data: recentPhoneUse } = await supabase
        .from("profiles")
        .select("created_at")
        .eq("phone", data.phone)
        .gte("created_at", thirtyDaysAgo.toISOString())
        .maybeSingle();

      if (recentPhoneUse) {
        console.log("[create-trial] Phone number recently used", { phone: data.phone });
        logWarn("Phone number recently used", {
          ...baseLogOptions,
          context: { phone: data.phone },
        });

        await supabase.from("signup_attempts").insert({
          email: data.email,
          phone: data.phone,
          ip_address: clientIP,
          device_fingerprint: data.deviceFingerprint,
          success: false,
          blocked_reason: "Phone number used within 30 days",
        });

        return new Response(
          JSON.stringify({
            error: "This phone number was recently used for a trial",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      phase = "rate-limit-passed";
      console.log(`[${FUNCTION_NAME}] phase: ${phase}`);
    }

    // ═══════════════════════════════════════════════════════════════
    // STRIPE: Create Customer (with idempotency)
    // ═══════════════════════════════════════════════════════════════

    phase = "stripe-customer-creating";
    console.log(`[${FUNCTION_NAME}] phase: ${phase}`);

    const stripeIdempotencyPrefix = idempotencyKey || `auto-${correlationId}`;

    const customer = await stripe.customers.create({
      email: data.email,
      name: data.name,
      phone: data.phone,
      metadata: {
        company_name: data.companyName,
        trade: data.trade,
        source: data.source,
        sales_rep: data.salesRepName || "",
      },
    }, {
      idempotencyKey: `${stripeIdempotencyPrefix}-customer`,
    });

    stripeCustomerId = customer.id;

    phase = "stripe-customer-created";
    console.log(`[${FUNCTION_NAME}] phase: ${phase}`);

    logInfo("Stripe customer created", {
      ...baseLogOptions,
      context: {
        customerId: customer.id,
        source: data.source,
        email: data.email,
      },
    });

    // ═══════════════════════════════════════════════════════════════
    // STRIPE: Attach Payment Method
    // ═══════════════════════════════════════════════════════════════

    phase = "payment-method-attaching";
    console.log(`[${FUNCTION_NAME}] phase: ${phase}`);

    await stripe.paymentMethods.attach(data.paymentMethodId, {
      customer: customer.id,
    });

    await stripe.customers.update(customer.id, {
      invoice_settings: {
        default_payment_method: data.paymentMethodId,
      },
    });

    phase = "payment-method-attached";
    console.log(`[${FUNCTION_NAME}] phase: ${phase}`);

    logInfo("Payment method attached", {
      ...baseLogOptions,
      context: { customerId: customer.id },
    });

    // ═══════════════════════════════════════════════════════════════
    // STRIPE: Create Subscription (with idempotency)
    // ═══════════════════════════════════════════════════════════════

    phase = "stripe-subscription-creating";
    console.log(`[${FUNCTION_NAME}] phase: ${phase}`);

    const priceId = getStripePriceId(data.planType);
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      trial_period_days: 3,
      payment_behavior: "default_incomplete",
      metadata: {
        source: data.source,
        sales_rep: data.salesRepName || "",
        plan_type: data.planType,
      },
    }, {
      idempotencyKey: `${stripeIdempotencyPrefix}-subscription`,
    });

    stripeSubscriptionId = subscription.id;

    phase = "stripe-subscription-created";
    console.log(`[${FUNCTION_NAME}] phase: ${phase}`);

    logInfo("Stripe subscription created", {
      ...baseLogOptions,
      context: {
        subscriptionId: subscription.id,
        planType: data.planType,
        source: data.source,
        status: subscription.status,
      },
    });

    // ═══════════════════════════════════════════════════════════════
    // DATABASE: Atomic Account Creation
    // ═══════════════════════════════════════════════════════════════

    phase = "account-creating";
    console.log(`[${FUNCTION_NAME}] phase: ${phase}`);

    const tempPassword = generateSecurePassword();
    const trialEndDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const billingState = data.zipCode ? getStateFromZip(data.zipCode) : "CA";

    let businessHoursValue = null;
    if (data.businessHours) {
      try {
        businessHoursValue = JSON.parse(data.businessHours);
      } catch {
        businessHoursValue = { text: data.businessHours };
      }
    }

    const accountData = {
      name: data.name,
      phone: data.phone,
      company_name: data.companyName,
      trade: data.trade,
      plan_type: data.planType,
      phone_number_area_code: data.zipCode?.slice(0, 3) || null,
      zip_code: data.zipCode || null,
      business_hours: businessHoursValue ? JSON.stringify(businessHoursValue) : null,
      assistant_gender: data.assistantGender,
      wants_advanced_voice: data.wantsAdvancedVoice,
      company_website: data.website || null,
      service_area: data.serviceArea || null,
      emergency_policy: data.emergencyPolicy || null,
      billing_state: billingState,
    };

    // Normalize plan_type to match SQL constraint (starter|professional|premium)
    const rawPlan = (accountData.plan_type || "starter")
      .toString()
      .trim()
      .toLowerCase();

    accountData.plan_type =
      rawPlan === "pro" ? "professional" :
      rawPlan === "professional" ? "professional" :
      rawPlan === "premium" ? "premium" :
      "starter";

    // Normalize assistant_gender to match SQL constraint (male|female)
    const rawGender = (accountData.assistant_gender || "female")
      .toString()
      .trim()
      .toLowerCase();

    accountData.assistant_gender =
      rawGender === "male" ? "male" : "female";

    // Log normalized values before RPC
    console.log(`[${FUNCTION_NAME}] normalized plan_type =`, accountData.plan_type);
    console.log(`[${FUNCTION_NAME}] normalized assistant_gender =`, accountData.assistant_gender);
    console.log(`[${FUNCTION_NAME}] final accountData keys =`, Object.keys(accountData));

    let accountResult: any;

    // DETAILED LOGGING: Before account creation
    console.error("DB_CALL", {
      step: "create_account_transaction",
      operation: "BEFORE_CALL",
      payload: {
        p_email: data.email,
        p_stripe_customer_id: customer.id,
        p_stripe_subscription_id: subscription.id,
        p_signup_channel: data.source,
        p_sales_rep_id: null,
        p_account_data: accountData,
        p_correlation_id: correlationId,
      },
    });

    try {
      // Use atomic account creation function
      const { data: accountTxResult, error: accountTxError } = await supabase.rpc(
        "create_account_transaction",
        {
          p_email: data.email,
          p_password: tempPassword,
          p_stripe_customer_id: customer.id,
          p_stripe_subscription_id: subscription.id,
          p_signup_channel: data.source,
          p_sales_rep_id: null, // TODO: Link sales rep if available
          p_account_data: accountData,
          p_correlation_id: correlationId,
        }
      );

      // DETAILED LOGGING: After account creation
      console.error("DB_RESULT", {
        step: "create_account_transaction",
        operation: "AFTER_CALL",
        hasError: !!accountTxError,
        hasData: !!accountTxResult,
        error: accountTxError ? {
          message: accountTxError.message,
          details: accountTxError.details,
          hint: accountTxError.hint,
          code: accountTxError.code,
          fullError: accountTxError,
        } : null,
        result: accountTxResult,
      });

      if (accountTxError) {
        // Check if duplicate email
        if (
          accountTxError.message?.toLowerCase().includes("already") ||
          accountTxError.message?.toLowerCase().includes("duplicate")
        ) {
          console.log("[create-trial] Email already registered", { email: data.email });
          logWarn("Email already registered", {
            ...baseLogOptions,
            context: { email: data.email },
          });

          // Cleanup Stripe resources
          await cleanupStripeResources(stripe, customer.id, subscription.id, baseLogOptions);

          return new Response(
            JSON.stringify({
              error: "This email is already registered. Please sign in instead.",
            }),
            {
              status: 409,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        throw accountTxError;
      }

      accountResult = accountTxResult;
      currentAccountId = accountResult.account_id;
      currentUserId = accountResult.user_id;

      phase = "account-created";
      console.log(`[${FUNCTION_NAME}] phase: ${phase}`);

      logInfo("Account created atomically", {
        ...baseLogOptions,
        accountId: currentAccountId,
        context: { source: data.source },
      });
    } catch (accountError: any) {
      phase = "account-creation-failed";
      console.log(`[${FUNCTION_NAME}] phase: ${phase}`);

      logError("Account creation failed - running compensation", {
        ...baseLogOptions,
        error: accountError,
      });

      // COMPENSATION: Cleanup Stripe resources
      await cleanupStripeResources(stripe, customer.id, subscription.id, baseLogOptions);

      throw new Error(`Account creation failed: ${accountError.message}`);
    }

    // ═══════════════════════════════════════════════════════════════
    // LINK LEAD (if provided)
    // ═══════════════════════════════════════════════════════════════

    phase = "link-lead";
    console.log(`[${FUNCTION_NAME}] phase: ${phase}`);
    if (data.leadId) {

      // DETAILED LOGGING: Before lead update
      console.error("DB_CALL", {
        step: "link_lead",
        operation: "BEFORE_UPDATE",
        table: "signup_leads",
        payload: {
          auth_user_id: currentUserId,
          account_id: currentAccountId,
          profile_id: currentUserId,
          completed_at: new Date().toISOString(),
          leadId: data.leadId,
        },
      });

      const { error: leadLinkError } = await supabase
        .from("signup_leads")
        .update({
          auth_user_id: currentUserId,
          account_id: currentAccountId,
          profile_id: currentUserId,
          completed_at: new Date().toISOString(),
        })
        .eq("id", data.leadId);

      // DETAILED LOGGING: After lead update
      console.error("DB_RESULT", {
        step: "link_lead",
        operation: "AFTER_UPDATE",
        table: "signup_leads",
        hasError: !!leadLinkError,
        error: leadLinkError ? {
          message: leadLinkError.message,
          details: leadLinkError.details,
          hint: leadLinkError.hint,
          code: leadLinkError.code,
          fullError: leadLinkError,
        } : null,
      });

      if (leadLinkError) {
        console.log("[create-trial] Lead linking failed (non-critical)", {
          error: leadLinkError.message,
        });
        logWarn("Lead linking failed (non-critical)", {
          ...baseLogOptions,
          accountId: currentAccountId,
          error: leadLinkError,
        });
      } else {
        phase = "lead-linked";
        console.log(`[${FUNCTION_NAME}] phase: ${phase}`);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // LOG SIGNUP SUCCESS
    // ═══════════════════════════════════════════════════════════════

    phase = "log-signup-attempt";
    console.log(`[${FUNCTION_NAME}] phase: ${phase}`);
    if (data.source === "website") {
      const clientIP =
        req.headers.get("x-forwarded-for")?.split(",")[0] ||
        req.headers.get("cf-connecting-ip") ||
        "unknown";

      // DETAILED LOGGING: Before signup_attempts insert
      console.error("DB_CALL", {
        step: "log_signup_success",
        operation: "BEFORE_INSERT",
        table: "signup_attempts",
        payload: {
          email: data.email,
          phone: data.phone,
          ip_address: clientIP,
          device_fingerprint: data.deviceFingerprint,
          success: true,
        },
      });

      const { error: signupAttemptError } = await supabase.from("signup_attempts").insert({
        email: data.email,
        phone: data.phone,
        ip_address: clientIP,
        device_fingerprint: data.deviceFingerprint,
        success: true,
      });

      // DETAILED LOGGING: After signup_attempts insert
      console.error("DB_RESULT", {
        step: "log_signup_success",
        operation: "AFTER_INSERT",
        table: "signup_attempts",
        hasError: !!signupAttemptError,
        error: signupAttemptError ? {
          message: signupAttemptError.message,
          details: signupAttemptError.details,
          hint: signupAttemptError.hint,
          code: signupAttemptError.code,
          fullError: signupAttemptError,
        } : null,
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // ENQUEUE ASYNC PROVISIONING JOB
    // ═══════════════════════════════════════════════════════════════

    phase = "enqueue-provisioning";
    console.log(`[${FUNCTION_NAME}] phase: ${phase}`);

    const jobMetadata = {
      company_name: data.companyName,
      trade: data.trade,
      service_area: data.serviceArea || "",
      business_hours: data.businessHours || "Monday-Friday 8am-5pm",
      emergency_policy: data.emergencyPolicy || "Available 24/7 for emergencies",
      company_website: data.website || "",
      assistant_gender: data.assistantGender,
      wants_advanced_voice: data.wantsAdvancedVoice,
      area_code: data.zipCode?.slice(0, 3) || "415",
      fallback_phone: data.phone,
      primary_goal: data.primaryGoal,
    };

    // DETAILED LOGGING: Before provisioning_jobs insert
    console.error("DB_CALL", {
      step: "enqueue_provisioning",
      operation: "BEFORE_INSERT",
      table: "provisioning_jobs",
      payload: {
        account_id: currentAccountId,
        user_id: currentUserId,
        job_type: "provision_phone",
        status: "queued",
        metadata: jobMetadata,
        correlation_id: correlationId,
      },
    });

    const { error: jobError } = await supabase.from("provisioning_jobs").insert({
      account_id: currentAccountId,
      user_id: currentUserId,
      job_type: "provision_phone",
      status: "queued",
      metadata: jobMetadata,
      correlation_id: correlationId,
    });

    // DETAILED LOGGING: After provisioning_jobs insert
    console.error("DB_RESULT", {
      step: "enqueue_provisioning",
      operation: "AFTER_INSERT",
      table: "provisioning_jobs",
      hasError: !!jobError,
      error: jobError ? {
        message: jobError.message,
        details: jobError.details,
        hint: jobError.hint,
        code: jobError.code,
        fullError: jobError,
      } : null,
    });

    if (jobError) {
      logError("Failed to enqueue provisioning job (non-critical)", {
        ...baseLogOptions,
        accountId: currentAccountId,
        error: jobError,
      });
    } else {
      phase = "provisioning-enqueued";
      console.log(`[${FUNCTION_NAME}] phase: ${phase}`);
      logInfo("Provisioning job enqueued", {
        ...baseLogOptions,
        accountId: currentAccountId,
      });
    }

    phase = "completed";
    console.log(`[${FUNCTION_NAME}] phase: ${phase}`);

    logInfo("Trial created successfully", {
      ...baseLogOptions,
      accountId: currentAccountId,
      context: {
        source: data.source,
        planType: data.planType,
        subscriptionId: subscription.id,
        provisioningStatus: "pending",
      },
    });

    // ═══════════════════════════════════════════════════════════════
    // BUILD SUCCESS RESPONSE
    // ═══════════════════════════════════════════════════════════════

    const successResponse = {
      success: true,
      accountId: currentAccountId,
      stripeCustomerId: customer.id,
      stripeSubscriptionId: subscription.id,
      // Backward compatibility fields
      ok: true,
      user_id: currentUserId,
      account_id: currentAccountId,
      email: data.email,
      password: tempPassword,
      stripe_customer_id: customer.id,
      subscription_id: subscription.id,
      trial_end_date: trialEndDate,
      plan_type: data.planType,
      source: data.source,
      provisioning_status: "pending",
      vapi_assistant_id: null,
      phone_number: null,
      message: "Trial started! Your AI receptionist is being set up...",
    };

    // ═══════════════════════════════════════════════════════════════
    // CACHE RESPONSE FOR IDEMPOTENCY
    // ═══════════════════════════════════════════════════════════════

    if (idempotencyKey) {
      const requestHash = await hashRequest(rawData);
      const clientIP =
        req.headers.get("x-forwarded-for")?.split(",")[0] ||
        req.headers.get("cf-connecting-ip") ||
        "unknown";

      await supabase.from("idempotency_results").insert({
        idempotency_key: idempotencyKey,
        request_hash: requestHash,
        request_path: "/create-trial",
        status_code: 200,
        response_body: successResponse,
        response_headers: { "Content-Type": "application/json" },
        account_id: currentAccountId,
        user_id: currentUserId,
        stripe_customer_id: customer.id,
        stripe_subscription_id: subscription.id,
        correlation_id: correlationId,
        source_ip: clientIP,
        user_agent: req.headers.get("user-agent") || null,
      });
    }

    console.log("[create-trial] Completed successfully", { accountId: currentAccountId });

    return new Response(
      JSON.stringify(successResponse),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    // Top-level error handler
    console.error(`[${FUNCTION_NAME}] fatal error`, {
      phase,
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      account_id: currentAccountId,
      user_id: currentUserId,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
    });

    logError("Trial creation failed", {
      ...baseLogOptions,
      accountId: currentAccountId,
      error,
      context: { phase },
    });

    const errorMessage = error instanceof Error ? error.message : "Internal server error";

    return new Response(
      JSON.stringify({
        error: String(error?.message ?? errorMessage),
        phase,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
