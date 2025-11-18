/*
 * ═══════════════════════════════════════════════════════════════════════════
 * FUNCTION: create-trial
 *
 * PURPOSE: Create new trial or paid accounts for both homepage and /sales signup flows
 *
 * CORE FLOW (Always completes):
 *   1. Input validation
 *   2. Anti-abuse checks (website only)
 *   3. Create Stripe customer
 *   4. Attach payment method
 *   5. Create Stripe subscription
 *   6. Create auth user
 *   7. Create account record
 *   8. Create profile record
 *   9. Assign owner role
 *   10. Link lead (if provided)
 *
 * VAPI PROVISIONING (Best effort, non-blocking):
 *   11. Create Vapi assistant
 *   12. Insert vapi_assistants record
 *   13. Provision Vapi phone number
 *   14. Insert phone_numbers record
 *   15. Update account with Vapi linkage
 *
 * ERROR HANDLING:
 *   - Core flow errors: Return 400/409/429/500 with clear message
 *   - Vapi errors: Log detailed info, set provisioning_status='failed', return success
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { extractCorrelationId, logError, logInfo, logWarn } from "../_shared/logging.ts";
import { isDisposableEmail } from "../_shared/disposable-domains.ts";
import { isValidPhoneNumber } from "../_shared/validators.ts";
import { buildVapiPrompt } from "../_shared/template-builder.ts";

const FUNCTION_NAME = "create-trial";
const VAPI_API_KEY = Deno.env.get("VAPI_API_KEY");
const VAPI_BASE_URL = "https://api.vapi.ai";

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
  leadId: z.string().uuid().optional(), // Link to signup_leads table
});

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
  const zip = parseInt(zipCode.substring(0, 3));

  // Simplified ZIP to state mapping
  if (zip >= 300 && zip <= 319) return "GA";
  if (zip >= 320 && zip <= 327) return "FL";
  if (zip >= 328 && zip <= 339) return "FL";
  if (zip >= 340 && zip <= 342) return "FL";
  if (zip >= 344 && zip <= 349) return "FL";
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

  try {
    console.log("[create-trial] Start", { correlationId });

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

    console.log("[create-trial] Clients initialized");

    // ═══════════════════════════════════════════════════════════════
    // INPUT VALIDATION
    // ═══════════════════════════════════════════════════════════════

    const rawData = await req.json();
    let data: z.infer<typeof createTrialSchema>;

    try {
      data = createTrialSchema.parse(rawData);
    } catch (zodError: any) {
      logWarn("Validation error in create-trial", {
        ...baseLogOptions,
        context: { errors: zodError.errors },
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

    console.log("[create-trial] Input validated", {
      email: data.email,
      source: data.source,
      planType: data.planType,
    });

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

    console.log("[create-trial] Phone and email validated");

    // ═══════════════════════════════════════════════════════════════
    // ANTI-ABUSE: Rate limiting (website signups only)
    // ═══════════════════════════════════════════════════════════════

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

      console.log("[create-trial] Rate limit checks passed");
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 1: Create Stripe Customer
    // ═══════════════════════════════════════════════════════════════

    console.log("[create-trial] Creating Stripe customer", { email: data.email });

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
    });

    stripeCustomerId = customer.id;

    console.log("[create-trial] After Stripe customer creation", {
      stripe_customer_id: customer.id,
    });

    logInfo("Stripe customer created", {
      ...baseLogOptions,
      context: {
        customerId: customer.id,
        source: data.source,
        email: data.email,
      },
    });

    // ═══════════════════════════════════════════════════════════════
    // STEP 2: Attach Payment Method
    // ═══════════════════════════════════════════════════════════════

    console.log("[create-trial] Attaching payment method", {
      paymentMethodId: data.paymentMethodId,
    });

    await stripe.paymentMethods.attach(data.paymentMethodId, {
      customer: customer.id,
    });

    await stripe.customers.update(customer.id, {
      invoice_settings: {
        default_payment_method: data.paymentMethodId,
      },
    });

    console.log("[create-trial] After payment method attachment");

    logInfo("Payment method attached", {
      ...baseLogOptions,
      context: { customerId: customer.id },
    });

    // ═══════════════════════════════════════════════════════════════
    // STEP 3: Create Subscription (3-day trial)
    // ═══════════════════════════════════════════════════════════════

    console.log("[create-trial] Creating Stripe subscription", {
      planType: data.planType,
    });

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
    });

    console.log("[create-trial] After Stripe subscription creation", {
      stripe_subscription_id: subscription.id,
      status: subscription.status,
    });

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
    // STEP 4: Create Auth User
    // ═══════════════════════════════════════════════════════════════

    console.log("[create-trial] Creating auth user", { email: data.email });

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
        source: data.source,
        sales_rep_name: data.salesRepName,
      },
    });

    if (authError) {
      // Check if duplicate email
      if (
        authError.message?.toLowerCase().includes("already") ||
        authError.message?.toLowerCase().includes("duplicate")
      ) {
        console.log("[create-trial] Email already registered", { email: data.email });
        logWarn("Email already registered", {
          ...baseLogOptions,
          context: { email: data.email },
        });

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

      console.log("[create-trial] Auth user creation failed", {
        error: authError.message,
      });
      logError("Auth user creation failed", {
        ...baseLogOptions,
        error: authError,
        context: { email: data.email },
      });
      throw authError;
    }

    currentUserId = authData.user.id;

    console.log("[create-trial] After auth user creation", {
      auth_user_id: authData.user.id,
    });

    logInfo("Auth user created", {
      ...baseLogOptions,
      context: { userId: authData.user.id, email: data.email },
    });

    // ═══════════════════════════════════════════════════════════════
    // STEP 5: Create Account Record
    // ═══════════════════════════════════════════════════════════════

    console.log("[create-trial] Creating account record", {
      companyName: data.companyName,
    });

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

        subscription_status: "trial",
        trial_start_date: new Date().toISOString(),
        trial_end_date: trialEndDate,

        stripe_customer_id: customer.id,
        stripe_subscription_id: subscription.id,
        plan_type: data.planType,

        source: data.source,
        sales_rep_name: data.salesRepName || null,

        provisioning_status: "pending",
        phone_number_status: "pending",
        phone_number_area_code: data.zipCode?.slice(0, 3) || null,
        billing_state: billingState,
        zip_code: data.zipCode || null,
      })
      .select()
      .single();

    if (accountError) {
      console.log("[create-trial] Account creation failed", {
        error: accountError.message,
        details: accountError.details,
        hint: accountError.hint,
        code: accountError.code,
      });

      logError("Account creation failed", {
        ...baseLogOptions,
        error: accountError,
        context: {
          userId: authData.user.id,
          message: accountError.message,
          details: accountError.details,
          hint: accountError.hint,
          code: accountError.code,
        },
      });
      throw new Error(`Account creation failed: ${accountError.message}`);
    }

    currentAccountId = accountData.id;

    console.log("[create-trial] After account insert", {
      account_id: accountData.id,
      subscription_status: accountData.subscription_status,
    });

    logInfo("Account created", {
      ...baseLogOptions,
      accountId: currentAccountId,
      context: { source: data.source },
    });

    // ═══════════════════════════════════════════════════════════════
    // STEP 6: Create Profile Record
    // ═══════════════════════════════════════════════════════════════

    console.log("[create-trial] Creating profile record", {
      profile_id: authData.user.id,
      account_id: accountData.id,
    });

    const { error: profileError } = await supabase.from("profiles").insert({
      id: authData.user.id,
      account_id: accountData.id,
      name: data.name,
      phone: data.phone,
      is_primary: true,
      source: data.source,
    });

    if (profileError) {
      console.log("[create-trial] Profile creation failed", {
        error: profileError.message,
      });
      logError("Profile creation failed", {
        ...baseLogOptions,
        accountId: currentAccountId,
        error: profileError,
      });
      throw profileError;
    }

    console.log("[create-trial] After profile insert", {
      profile_id: authData.user.id,
    });

    logInfo("Profile created", {
      ...baseLogOptions,
      accountId: currentAccountId,
    });

    // ═══════════════════════════════════════════════════════════════
    // STEP 7: Assign Owner Role
    // ═══════════════════════════════════════════════════════════════

    console.log("[create-trial] Assigning owner role");

    const { error: roleError } = await supabase.from("user_roles").insert({
      user_id: authData.user.id,
      role: "owner",
    });

    if (roleError) {
      console.log("[create-trial] Owner role assignment failed (non-critical)", {
        error: roleError.message,
      });
      logWarn("User role assignment failed (non-critical)", {
        ...baseLogOptions,
        accountId: currentAccountId,
        error: roleError,
      });
      // Don't throw - not critical
    } else {
      console.log("[create-trial] After owner role assignment");
      logInfo("Owner role assigned", {
        ...baseLogOptions,
        accountId: currentAccountId,
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 8: Link Lead (if provided)
    // ═══════════════════════════════════════════════════════════════

    if (data.leadId) {
      console.log("[create-trial] Linking lead", { lead_id: data.leadId });

      const { error: leadLinkError } = await supabase
        .from("signup_leads")
        .update({
          auth_user_id: authData.user.id,
          account_id: accountData.id,
          profile_id: authData.user.id,
          completed_at: new Date().toISOString(),
        })
        .eq("id", data.leadId);

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
        console.log("[create-trial] After lead linking");
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 9: Log Success for Analytics
    // ═══════════════════════════════════════════════════════════════

    if (data.source === "website") {
      const clientIP =
        req.headers.get("x-forwarded-for")?.split(",")[0] ||
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

    console.log("[create-trial] Core signup completed successfully");

    // ═══════════════════════════════════════════════════════════════
    // STEP 10: VAPI ASSISTANT PROVISIONING (BEST EFFORT)
    // ═══════════════════════════════════════════════════════════════

    let vapiAssistantId: string | null = null;
    let vapiAssistantDbId: string | null = null;
    let phoneNumberDbId: string | null = null;
    let phoneE164: string | null = null;
    let vapiProvisioningStatus = "pending";

    if (VAPI_API_KEY) {
      try {
        console.log("[create-trial] Before Vapi assistant create", {
          account_id: accountData.id,
          company_name: data.companyName,
        });

        // Build Vapi prompt
        const prompt = await buildVapiPrompt({
          company_name: data.companyName,
          trade: data.trade,
          service_area: data.serviceArea || "",
          business_hours: data.businessHours || "Monday-Friday 8am-5pm",
          emergency_policy: data.emergencyPolicy || "Available 24/7 for emergencies",
          company_website: data.website || "",
          custom_instructions: "",
        });

        const voiceId = data.assistantGender === "male" ? "michael" : "sarah";

        // Vapi assistant payload
        const assistantPayload = {
          name: `${data.companyName} Assistant`,
          model: {
            provider: "openai",
            model: "gpt-4",
            messages: [
              {
                role: "system",
                content: prompt,
              },
            ],
          },
          voice: {
            provider: "11labs",
            voiceId: voiceId,
          },
          firstMessage: `Thank you for calling ${data.companyName}! How can I help you today?`,
        };

        console.log("[create-trial] Vapi request", {
          url: `${VAPI_BASE_URL}/assistant`,
          method: "POST",
          company_name: data.companyName,
          voice: voiceId,
        });

        // Call Vapi API to create assistant
        const vapiResponse = await fetch(`${VAPI_BASE_URL}/assistant`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${VAPI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(assistantPayload),
        });

        console.log("[create-trial] Vapi response status", {
          status: vapiResponse.status,
          statusText: vapiResponse.statusText,
        });

        if (!vapiResponse.ok) {
          const errorText = await vapiResponse.text();
          console.log("[create-trial] Vapi error body", { errorBody: errorText });
          throw new Error(
            `Failed to create Vapi assistant: ${vapiResponse.status} ${vapiResponse.statusText}`
          );
        }

        const vapiAssistant = await vapiResponse.json();
        vapiAssistantId = vapiAssistant.id;

        console.log("[create-trial] After Vapi assistant create", {
          vapi_assistant_id: vapiAssistantId,
        });

        logInfo("Vapi assistant created", {
          ...baseLogOptions,
          accountId: currentAccountId,
          context: { vapiAssistantId },
        });

        // Insert vapi_assistants record
        console.log("[create-trial] Inserting vapi_assistants record");

        const { data: assistantRow, error: assistantDbError } = await supabase
          .from("vapi_assistants")
          .insert({
            account_id: accountData.id,
            vapi_assistant_id: vapiAssistantId,
            config: vapiAssistant,
          })
          .select("*")
          .single();

        if (assistantDbError) {
          console.log("[create-trial] Failed to insert vapi_assistants", {
            error: assistantDbError.message,
            details: assistantDbError.details,
            hint: assistantDbError.hint,
          });
          throw new Error(`Failed to insert vapi_assistants: ${assistantDbError.message}`);
        }

        vapiAssistantDbId = assistantRow.id;

        console.log("[create-trial] After vapi_assistants insert", {
          vapi_assistant_db_id: assistantRow.id,
        });

        // ═══════════════════════════════════════════════════════════════
        // STEP 11: VAPI PHONE NUMBER PROVISIONING (BEST EFFORT)
        // ═══════════════════════════════════════════════════════════════

        console.log("[create-trial] Before Vapi phone provisioning");

        const areaCode = data.zipCode?.slice(0, 3) || "415";

        const phonePayload = {
          assistantId: vapiAssistantId,
          fallbackDestination: {
            type: "number",
            number: data.phone,
          },
          areaCode: areaCode,
        };

        console.log("[create-trial] Vapi phone request", {
          url: `${VAPI_BASE_URL}/phone-number`,
          method: "POST",
          area_code: areaCode,
        });

        const phoneResponse = await fetch(`${VAPI_BASE_URL}/phone-number`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${VAPI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(phonePayload),
        });

        console.log("[create-trial] Vapi phone response status", {
          status: phoneResponse.status,
          statusText: phoneResponse.statusText,
        });

        if (!phoneResponse.ok) {
          const errorText = await phoneResponse.text();
          console.log("[create-trial] Vapi phone error body", {
            errorBody: errorText,
          });
          throw new Error(
            `Failed to provision Vapi phone: ${phoneResponse.status} ${phoneResponse.statusText}`
          );
        }

        const vapiPhone = await phoneResponse.json();
        phoneE164 = vapiPhone.number || vapiPhone.phone_e164;
        const vapiPhoneId = vapiPhone.id;

        console.log("[create-trial] After Vapi phone provisioning", {
          phone_e164: phoneE164,
          vapi_phone_id: vapiPhoneId,
        });

        logInfo("Vapi phone provisioned", {
          ...baseLogOptions,
          accountId: currentAccountId,
          context: { phoneE164, vapiPhoneId },
        });

        // Insert phone_numbers record with minimal schema-aligned payload
        console.log("[create-trial] Inserting phone_numbers record");

        const { data: phoneRow, error: phoneDbError } = await supabase
          .from("phone_numbers")
          .insert({
            account_id: accountData.id,
            phone_number: phoneE164,
            area_code: areaCode,
            vapi_phone_id: vapiPhoneId,
            vapi_id: vapiPhoneId,
            purpose: "primary",
            status: "active",
            is_primary: true,
            activated_at: new Date().toISOString(),
            raw: vapiPhone,
          })
          .select("*")
          .single();

        if (phoneDbError) {
          console.log("[create-trial] Failed to insert phone_numbers", {
            error: phoneDbError.message,
            details: phoneDbError.details,
            hint: phoneDbError.hint,
          });
          throw new Error(`Failed to insert phone_numbers: ${phoneDbError.message}`);
        }

        phoneNumberDbId = phoneRow.id;

        console.log("[create-trial] After phone_numbers insert", {
          phone_number_db_id: phoneRow.id,
        });

        // Update account with Vapi linkage
        console.log("[create-trial] Updating account with Vapi linkage");

        const { error: accountUpdateError } = await supabase
          .from("accounts")
          .update({
            vapi_assistant_id: vapiAssistantId,
            vapi_phone_number: phoneE164,
            phone_number_e164: phoneE164,
            vapi_phone_number_id: vapiPhoneId,
            phone_number_status: "active",
            phone_provisioned_at: new Date().toISOString(),
            provisioning_status: "completed",
          })
          .eq("id", accountData.id);

        if (accountUpdateError) {
          console.log("[create-trial] Account update failed (non-critical)", {
            error: accountUpdateError.message,
          });
        } else {
          console.log("[create-trial] After account update with Vapi fields");
          vapiProvisioningStatus = "completed";
        }
      } catch (vapiError: any) {
        // Vapi provisioning failed, but core signup succeeded
        console.error("[create-trial] Vapi provisioning failed", {
          error: vapiError.name,
          message: vapiError.message,
          stack: vapiError.stack,
        });

        logError("Vapi provisioning failed (non-critical)", {
          ...baseLogOptions,
          accountId: currentAccountId,
          error: vapiError,
        });

        // Update account to reflect provisioning failure
        await supabase
          .from("accounts")
          .update({
            provisioning_status: "failed",
            provisioning_error: vapiError.message?.substring(0, 500) || "Unknown error",
          })
          .eq("id", accountData.id);

        vapiProvisioningStatus = "failed";
      }
    } else {
      console.log("[create-trial] VAPI_API_KEY not configured, skipping Vapi provisioning");
      logWarn("VAPI_API_KEY not configured", {
        ...baseLogOptions,
        accountId: currentAccountId,
      });
      vapiProvisioningStatus = "failed";
    }

    console.log("[create-trial] Done", {
      account_id: accountData.id,
      provisioning_status: vapiProvisioningStatus,
    });

    logInfo("Trial created successfully", {
      ...baseLogOptions,
      accountId: currentAccountId,
      context: {
        source: data.source,
        planType: data.planType,
        subscriptionId: subscription.id,
        vapiProvisioningStatus,
      },
    });

    // ═══════════════════════════════════════════════════════════════
    // RETURN SUCCESS RESPONSE
    // ═══════════════════════════════════════════════════════════════

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
        provisioning_status: vapiProvisioningStatus,
        vapi_assistant_id: vapiAssistantId,
        phone_number: phoneE164,
        message:
          vapiProvisioningStatus === "completed"
            ? "Trial started! Your AI receptionist is ready."
            : vapiProvisioningStatus === "pending"
            ? "Trial started! Your AI receptionist is being set up..."
            : "Trial started! Note: AI provisioning needs attention.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    // Top-level error handler
    console.error("[create-trial] Fatal error", {
      name: error.name,
      message: error.message,
      stack: error.stack,
      account_id: currentAccountId,
      user_id: currentUserId,
      stripe_customer_id: stripeCustomerId,
    });

    logError("Trial creation failed", {
      ...baseLogOptions,
      accountId: currentAccountId,
      error,
    });

    const errorMessage = error instanceof Error ? error.message : "Internal server error";

    return new Response(
      JSON.stringify({
        error: "Internal error in create-trial",
        detail: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
