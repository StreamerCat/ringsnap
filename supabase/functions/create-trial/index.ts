import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { extractCorrelationId, logError, logInfo, logWarn } from "../_shared/logging.ts";
import { isDisposableEmail } from "../_shared/disposable-domains.ts";
import { isValidPhoneNumber } from "../_shared/validators.ts";

const FUNCTION_NAME = "create-trial";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
  zipCode: z.string().regex(/^\d{5}$/, "ZIP code must be 5 digits"),

  // Business operations (optional - sales flow uses these)
  businessHours: z.string().max(500).optional(),
  emergencyPolicy: z.string().max(1000).optional(),

  // AI configuration
  assistantGender: z.enum(["male", "female"]).default("female"),
  primaryGoal: z.enum(["book_appointments", "capture_leads", "answer_questions", "take_orders"]).optional(),
  wantsAdvancedVoice: z.boolean().optional().default(false),

  // Plan & payment
  planType: z.enum(["starter", "professional", "premium"], {
    required_error: "Plan type required"
  }),
  paymentMethodId: z.string().min(1, "Payment method required"),

  // Source tracking (CRITICAL - differentiates flows)
  source: z.enum(["website", "sales"]).default("website"),
  salesRepName: z.string().max(100).optional(),

  // Optional metadata
  referralCode: z.string().length(8).optional().or(z.literal("")),
  deviceFingerprint: z.string().max(500).optional(),
});

type CreateTrialInput = z.infer<typeof createTrialSchema>;

/**
 * Generate secure random password for user account
 */
function generateSecurePassword(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
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

serve(async (req) => {
  const correlationId = extractCorrelationId(req);
  const baseLogOptions = { functionName: FUNCTION_NAME, correlationId };

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let currentAccountId: string | null = null;

  try {
    // Initialize clients
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Parse and validate input
    const rawData = await req.json();
    let data: CreateTrialInput;

    try {
      data = createTrialSchema.parse(rawData);
    } catch (zodError: any) {
      logWarn("Validation error in create-trial", {
        ...baseLogOptions,
        context: { errors: zodError.errors }
      });
      return new Response(
        JSON.stringify({ error: "Invalid input data", details: zodError.errors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logInfo("Creating trial account", {
      ...baseLogOptions,
      context: {
        email: data.email,
        source: data.source,
        salesRep: data.salesRepName,
        planType: data.planType,
      }
    });

    // ═══════════════════════════════════════════════════════════════
    // VALIDATION: Phone number and email checks
    // ═══════════════════════════════════════════════════════════════

    if (!isValidPhoneNumber(data.phone)) {
      return new Response(
        JSON.stringify({ error: "Invalid phone number format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (isDisposableEmail(data.email)) {
      logWarn("Blocked disposable email", {
        ...baseLogOptions,
        context: { email: data.email }
      });
      return new Response(
        JSON.stringify({ error: "Please use a valid business or personal email address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // ANTI-ABUSE: Rate limiting (website signups only)
    // ═══════════════════════════════════════════════════════════════

    if (data.source === "website") {
      const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0] ||
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
        logWarn("IP rate limit exceeded", {
          ...baseLogOptions,
          context: { clientIP, ipAttempts }
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
          JSON.stringify({ error: "Trial limit reached for this location. Please contact support." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        logWarn("Phone number recently used", {
          ...baseLogOptions,
          context: { phone: data.phone }
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
          JSON.stringify({ error: "This phone number was recently used for a trial" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 1: Create Stripe Customer
    // ═══════════════════════════════════════════════════════════════

    const customer = await stripe.customers.create({
      email: data.email,
      name: data.name,
      phone: data.phone,
      metadata: {
        company_name: data.companyName,
        trade: data.trade,
        source: data.source, // CRITICAL: Track source in Stripe
        sales_rep: data.salesRepName || "",
      },
    });

    logInfo("Stripe customer created", {
      ...baseLogOptions,
      context: {
        customerId: customer.id,
        source: data.source,
        email: data.email,
      }
    });

    // ═══════════════════════════════════════════════════════════════
    // STEP 2: Attach Payment Method
    // ═══════════════════════════════════════════════════════════════

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
      context: { customerId: customer.id }
    });

    // ═══════════════════════════════════════════════════════════════
    // STEP 3: Create Subscription (trial for website, active for sales)
    // ═══════════════════════════════════════════════════════════════

    const priceId = getStripePriceId(data.planType);

    // Sales accounts: no trial, immediately active
    // Website accounts: 3-day trial
    const subscriptionParams: any = {
      customer: customer.id,
      items: [{ price: priceId }],
      payment_behavior: "default_incomplete",
      metadata: {
        source: data.source, // CRITICAL: Track source
        sales_rep: data.salesRepName || "",
        plan_type: data.planType,
      },
    };

    if (data.source === "website") {
      subscriptionParams.trial_period_days = 3;
    }

    const subscription = await stripe.subscriptions.create(subscriptionParams);

    logInfo("Stripe subscription created", {
      ...baseLogOptions,
      context: {
        subscriptionId: subscription.id,
        planType: data.planType,
        source: data.source,
        status: subscription.status,
      }
    });

    // ═══════════════════════════════════════════════════════════════
    // STEP 4: Create Auth User
    // ═══════════════════════════════════════════════════════════════

    const tempPassword = generateSecurePassword();

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: data.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        name: data.name,
        phone: data.phone,
        company_name: data.companyName,
        trade: data.trade,
        source: data.source, // CRITICAL: Track source
        sales_rep_name: data.salesRepName,
      },
    });

    if (authError) {
      // Check if duplicate email
      if (authError.message?.toLowerCase().includes("already") ||
          authError.message?.toLowerCase().includes("duplicate")) {
        logWarn("Email already registered", {
          ...baseLogOptions,
          context: { email: data.email }
        });
        return new Response(
          JSON.stringify({ error: "This email is already registered. Please sign in instead." }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      logError("Auth user creation failed", {
        ...baseLogOptions,
        error: authError,
        context: { email: data.email }
      });
      throw authError;
    }

    logInfo("Auth user created", {
      ...baseLogOptions,
      context: { userId: authData.user.id, email: data.email }
    });

    // ═══════════════════════════════════════════════════════════════
    // STEP 5: Create Account Record
    // ═══════════════════════════════════════════════════════════════

    // Determine subscription status and trial dates based on source
    const isWebsiteTrial = data.source === "website";
    const subscriptionStatus = isWebsiteTrial ? "trial" : "active";
    const trialStartDate = isWebsiteTrial ? new Date().toISOString() : null;
    const trialEndDate = isWebsiteTrial
      ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
      : null;

    // Parse business hours if provided as JSON string
    let businessHoursValue = null;
    if (data.businessHours) {
      try {
        businessHoursValue = JSON.parse(data.businessHours);
      } catch {
        businessHoursValue = { text: data.businessHours };
      }
    }

    const { data: accountData, error: accountError } = await supabase
      .from("accounts")
      .insert({
        company_name: data.companyName,
        company_website: data.website || null,
        trade: data.trade,
        service_area: data.serviceArea || null,
        business_hours: businessHoursValue,
        emergency_policy: data.emergencyPolicy || null,
        assistant_gender: data.assistantGender,
        wants_advanced_voice: data.wantsAdvancedVoice,
        primary_goal: data.primaryGoal || null,

        subscription_status: subscriptionStatus,
        trial_start_date: trialStartDate,
        trial_end_date: trialEndDate,

        stripe_customer_id: customer.id,
        stripe_subscription_id: subscription.id,
        plan_type: data.planType,

        source: data.source, // CRITICAL: Track source
        sales_rep_name: data.salesRepName || null,

        provisioning_status: "idle",
      })
      .select()
      .single();

    if (accountError) {
      logError("Account creation failed", {
        ...baseLogOptions,
        error: accountError,
        context: { userId: authData.user.id }
      });
      throw accountError;
    }

    currentAccountId = accountData.id;

    logInfo("Account created", {
      ...baseLogOptions,
      accountId: currentAccountId,
      context: { source: data.source }
    });

    // ═══════════════════════════════════════════════════════════════
    // STEP 6: Create Profile Record
    // ═══════════════════════════════════════════════════════════════

    const { error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: authData.user.id,
        account_id: accountData.id,
        name: data.name,
        phone: data.phone,
        is_primary: true,
        source: data.source, // CRITICAL: Track source
      });

    if (profileError) {
      logError("Profile creation failed", {
        ...baseLogOptions,
        accountId: currentAccountId,
        error: profileError
      });
      throw profileError;
    }

    logInfo("Profile created", {
      ...baseLogOptions,
      accountId: currentAccountId
    });

    // ═══════════════════════════════════════════════════════════════
    // STEP 7: Assign Owner Role
    // ═══════════════════════════════════════════════════════════════

    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({
        user_id: authData.user.id,
        role: "owner",
      });

    if (roleError) {
      logWarn("User role assignment failed (non-critical)", {
        ...baseLogOptions,
        accountId: currentAccountId,
        error: roleError
      });
      // Don't throw - not critical
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 8: Create Provisioning Job
    // ═══════════════════════════════════════════════════════════════

    const { error: jobError } = await supabase
      .from("provisioning_jobs")
      .insert({
        account_id: accountData.id,
        user_id: authData.user.id,
        status: "queued",
        job_type: "provision_phone",
        attempts: 0,
      });

    if (jobError) {
      logError("Provisioning job creation failed", {
        ...baseLogOptions,
        accountId: currentAccountId,
        error: jobError
      });
      // Don't throw - provisioning can be retried manually
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 9: Trigger Async Provisioning
    // ═══════════════════════════════════════════════════════════════

    logInfo("Triggering async provisioning", {
      ...baseLogOptions,
      accountId: currentAccountId
    });

    const provisioningTask = supabase.functions.invoke("provision-resources", {
      body: {
        accountId: accountData.id,
        email: data.email,
        name: data.name,
        phone: data.phone,
        zipCode: data.zipCode,
        areaCode: data.zipCode.slice(0, 3),
        companyName: data.companyName,
        website: data.website,
        trade: data.trade,
        assistantGender: data.assistantGender,
      },
    });

    // Don't await - let it run in background
    if (typeof (globalThis as any).EdgeRuntime !== "undefined" &&
        (globalThis as any).EdgeRuntime.waitUntil) {
      (globalThis as any).EdgeRuntime.waitUntil(provisioningTask);
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 10: Log Success for Analytics
    // ═══════════════════════════════════════════════════════════════

    if (data.source === "website") {
      const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0] ||
                       req.headers.get("cf-connecting-ip") ||
                       "unknown";

      await supabase.from("signup_attempts").insert({
        email: data.email,
        phone: data.phone,
        ip_address: clientIP,
        device_fingerprint: data.deviceFingerprint,
        success: true,
      });
    }

    logInfo("Trial created successfully", {
      ...baseLogOptions,
      accountId: currentAccountId,
      context: {
        source: data.source,
        planType: data.planType,
        subscriptionId: subscription.id,
      }
    });

    // ═══════════════════════════════════════════════════════════════
    // STEP 11: Return Success Response
    // ═══════════════════════════════════════════════════════════════

    // Customize message based on source
    const successMessage = isWebsiteTrial
      ? "Trial started! Your AI receptionist is being created..."
      : "Account created! Your AI assistant and phone number are being set up...";

    return new Response(
      JSON.stringify({
        ok: true,
        user_id: authData.user.id,
        account_id: accountData.id,
        email: data.email,
        password: tempPassword,
        stripe_customer_id: customer.id,
        subscription_id: subscription.id,
        trial_end_date: trialEndDate,
        plan_type: data.planType,
        source: data.source,
        subscription_status: subscriptionStatus,
        provisioning_status: "provisioning",
        message: successMessage,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    logError("Trial creation failed", {
      ...baseLogOptions,
      accountId: currentAccountId,
      error,
    });

    const errorMessage = error instanceof Error ? error.message : "Internal server error";

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
