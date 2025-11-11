import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isDisposableEmail } from "../_shared/disposable-domains.ts";
import { isValidPhoneNumber, isValidZipCode } from "../_shared/validators.ts";
import { extractCorrelationId, logError, logInfo, logWarn } from "../_shared/logging.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const FUNCTION_NAME = "free-trial-signup";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  const correlationId = extractCorrelationId(req);
  const baseLogOptions = { functionName: FUNCTION_NAME, correlationId };
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const signupSchema = z.object({
      name: z.string().trim().min(1, "Name required").max(100, "Name too long"),
      email: z.string().email("Invalid email").max(255, "Email too long"),
      phone: z.string().min(1, "Phone required"),
      areaCode: z.string().trim().regex(/^\d{3}$/, "Area code must be exactly 3 digits"),
      companyName: z.string().max(200).optional(),
      companyWebsite: z.string().max(255).optional(),
      deviceFingerprint: z.string().max(500).optional(),
      trade: z.string().max(100).optional(),
      wantsAdvancedVoice: z.boolean().optional(),
      zipCode: z.string().optional(),
      assistantGender: z.enum(["female", "male"]).optional(),
      referralCode: z.string().max(50).optional(),
      source: z.string().max(100).optional(),
      planType: z.enum(["starter", "professional", "premium"]),
      paymentMethodId: z.string().min(1, "Payment method required"),
    });

    const rawData = await req.json();

    let validatedData;
    try {
      validatedData = signupSchema.parse(rawData);
    } catch (zodError: any) {
      return new Response(JSON.stringify({ error: "Invalid input data", details: zodError.errors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { name, email, phone, companyName, areaCode: rawAreaCode } = validatedData;
    const areaCode = rawAreaCode.trim();

    if (!isValidPhoneNumber(phone)) {
      return new Response(JSON.stringify({ error: "Invalid phone number format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (isDisposableEmail(email)) {
      logWarn("Blocked disposable email", {
        ...baseLogOptions,
        context: { email },
      });
      return new Response(JSON.stringify({ error: "Please use a valid business or personal email address" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientIP =
      req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("cf-connecting-ip") || "unknown";

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { count: ipAttempts } = await supabase
      .from("signup_attempts")
      .select("*", { count: "exact", head: true })
      .eq("ip_address", clientIP)
      .eq("success", true)
      .gte("created_at", thirtyDaysAgo.toISOString());

    if (ipAttempts && ipAttempts >= 3) {
      logWarn("IP rate limit exceeded for trial signup", {
        ...baseLogOptions,
        context: { clientIP, ipAttempts },
      });
      await supabase.from("signup_attempts").insert({
        email,
        phone,
        ip_address: clientIP,
        device_fingerprint: validatedData.deviceFingerprint,
        success: false,
        blocked_reason: "IP rate limit exceeded (3 trials per 30 days)",
      });
      return new Response(JSON.stringify({ error: "Trial limit reached for this location. Please contact support." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: recentPhoneUse } = await supabase
      .from("profiles")
      .select("created_at")
      .eq("phone", phone)
      .gte("created_at", thirtyDaysAgo.toISOString())
      .maybeSingle();

    if (recentPhoneUse) {
      logWarn("Phone number recently used for trial signup", {
        ...baseLogOptions,
        context: { phone },
      });
      await supabase.from("signup_attempts").insert({
        email,
        phone,
        ip_address: clientIP,
        device_fingerprint: validatedData.deviceFingerprint,
        success: false,
        blocked_reason: "Phone number used within 30 days",
      });
      return new Response(JSON.stringify({ error: "This phone number was recently used for a trial" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailDomain = email.split("@")[1].toLowerCase();
    const genericDomains = [
      "gmail.com",
      "yahoo.com",
      "hotmail.com",
      "outlook.com",
      "icloud.com",
      "aol.com",
      "protonmail.com",
      "mail.com",
    ];
    const isGeneric = genericDomains.includes(emailDomain);

    let finalCompanyName: string;
    if (isGeneric) {
      finalCompanyName = companyName || email.split("@")[0];
    } else {
      finalCompanyName = emailDomain;
    }

    const trialEndDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    const password = Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        company_name: finalCompanyName,
        name,
        phone,
        trade: validatedData.trade || "",
        company_website: validatedData.companyWebsite || "",
        wants_advanced_voice: validatedData.wantsAdvancedVoice || false,
        source: validatedData.source || "website",
      },
    });

    if (authError) {
      // Check if it's a duplicate email error
      if (authError.message?.toLowerCase().includes("already") || authError.message?.toLowerCase().includes("duplicate")) {
        logWarn("Email already registered", {
          ...baseLogOptions,
          context: { email },
        });
        return new Response(JSON.stringify({ error: "This email is already registered. Please sign in instead." }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      logError("Auth error during free trial signup", {
        ...baseLogOptions,
        error: authError,
        context: { email },
      });
      await supabase.from("signup_attempts").insert({
        email,
        phone,
        ip_address: clientIP,
        device_fingerprint: validatedData.deviceFingerprint,
        success: false,
        blocked_reason: authError.message,
      });
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logInfo("Trial user created successfully", {
      ...baseLogOptions,
      context: { userId: authData.user.id, email },
    });

    // Create account record (don't rely on trigger)
    logInfo("Creating account record", {
      ...baseLogOptions,
      context: { userId: authData.user.id },
    });

    const { data: accountData, error: accountInsertError } = await supabase
      .from("accounts")
      .insert({
        company_name: finalCompanyName,
        company_domain: isGeneric ? null : emailDomain,
        trade: validatedData.trade,
        company_website: validatedData.companyWebsite,
        wants_advanced_voice: validatedData.wantsAdvancedVoice || false,
        subscription_status: "trial",
        trial_start_date: new Date().toISOString(),
        trial_end_date: trialEndDate,
        phone_number_area_code: areaCode,
      })
      .select()
      .single();

    if (accountInsertError || !accountData) {
      logError("Account creation error", {
        ...baseLogOptions,
        error: accountInsertError,
        context: { userId: authData.user.id },
      });
      throw accountInsertError || new Error("Failed to create account");
    }

    const accountId = accountData.id;

    logInfo("Account created successfully", {
      ...baseLogOptions,
      context: { userId: authData.user.id, accountId },
    });

    // Create profile record (don't rely on trigger)
    logInfo("Creating profile record", {
      ...baseLogOptions,
      context: { userId: authData.user.id, accountId },
    });

    const { error: profileInsertError } = await supabase
      .from("profiles")
      .insert({
        id: authData.user.id,
        account_id: accountId,
        name: validatedData.name,
        phone: validatedData.phone,
        is_primary: true,
        source: validatedData.source || "website",
      });

    if (profileInsertError) {
      logError("Profile creation error", {
        ...baseLogOptions,
        error: profileInsertError,
        context: { userId: authData.user.id, accountId },
      });
      throw profileInsertError;
    }

    logInfo("Profile created successfully", {
      ...baseLogOptions,
      context: { userId: authData.user.id, accountId },
    });

    // Assign owner role to user
    logInfo("Assigning owner role to user", {
      ...baseLogOptions,
      context: { userId: authData.user.id },
    });

    const { error: roleInsertError } = await supabase
      .from("user_roles")
      .insert({
        user_id: authData.user.id,
        role: "owner",
      });

    if (roleInsertError) {
      logError("User role assignment error", {
        ...baseLogOptions,
        error: roleInsertError,
        context: { userId: authData.user.id },
      });
      // Don't throw - this is not critical for signup to succeed
    } else {
      logInfo("Owner role assigned successfully", {
        ...baseLogOptions,
        context: { userId: authData.user.id },
      });
    }

    logInfo("Initializing Stripe", {
      ...baseLogOptions,
      context: { userId: authData.user.id },
    });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    logInfo("Creating Stripe customer", {
      ...baseLogOptions,
      context: { userId: authData.user.id, email: validatedData.email },
    });

    const customer = await stripe.customers.create({
      email: validatedData.email,
      name: validatedData.name,
      phone: validatedData.phone,
      payment_method: validatedData.paymentMethodId,
      invoice_settings: {
        default_payment_method: validatedData.paymentMethodId,
      },
      metadata: {
        company_name: finalCompanyName,
        source: validatedData.source || "website",
        trade: validatedData.trade || "",
        user_id: authData.user.id,
      },
    });

    logInfo("Stripe customer created", {
      ...baseLogOptions,
      context: { userId: authData.user.id, customerId: customer.id },
    });

    const priceIds = {
      starter: Deno.env.get("STRIPE_PRICE_STARTER"),
      professional: Deno.env.get("STRIPE_PRICE_PROFESSIONAL"),
      premium: Deno.env.get("STRIPE_PRICE_PREMIUM"),
    };

    const selectedPriceId = priceIds[validatedData.planType];
    if (!selectedPriceId) {
      throw new Error(`Price ID not configured for plan: ${validatedData.planType}`);
    }

    logInfo("Creating Stripe subscription", {
      ...baseLogOptions,
      context: {
        userId: authData.user.id,
        customerId: customer.id,
        planType: validatedData.planType,
      },
    });

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: selectedPriceId }],
      trial_period_days: 3,
      payment_behavior: "default_incomplete",
      metadata: {
        user_id: authData.user.id,
        trial_signup: "true",
        source: validatedData.source || "website",
      },
    });

    logInfo("Stripe subscription created", {
      ...baseLogOptions,
      context: {
        userId: authData.user.id,
        subscriptionId: subscription.id,
        planType: validatedData.planType,
      },
    });

    logInfo("Updating account with Stripe subscription info", {
      ...baseLogOptions,
      context: { userId: authData.user.id, accountId, subscriptionId: subscription.id, trialEndDate },
    });

    const { data: updatedAccountData, error: accountUpdateError } = await supabase
      .from("accounts")
      .update({
        stripe_customer_id: customer.id,
        stripe_subscription_id: subscription.id,
        plan_type: validatedData.planType,
      })
      .eq("id", accountId)
      .select()
      .single();

    if (accountUpdateError || !updatedAccountData) {
      logError("Account update error", {
        ...baseLogOptions,
        error: accountUpdateError,
        context: { userId: authData.user.id, accountId },
      });
      throw accountUpdateError || new Error("Account not found for update");
    }

    logInfo("Account updated with Stripe info successfully", {
      ...baseLogOptions,
      context: { userId: authData.user.id, accountId },
    });

    logInfo("Starting VAPI provisioning in background", {
      ...baseLogOptions,
      context: { accountId },
    });

    const vapiProvisioningTask = supabase.functions
      .invoke("provision-resources", {
        body: {
          accountId: accountId,
          user_id: authData.user.id,
          email: validatedData.email,
          name: validatedData.name,
          phone: validatedData.phone,
          areaCode,
          company_name: finalCompanyName,
          company_website: validatedData.companyWebsite || "",
          trade: validatedData.trade,
          assistant_gender: validatedData.assistantGender || "female",
          wants_advanced_voice: validatedData.wantsAdvancedVoice || false,
        },
      })
      .then((provisionResponse) => {
        if (provisionResponse.error) {
          logError("VAPI provisioning failed (async)", {
            ...baseLogOptions,
            error: provisionResponse.error,
            context: { accountId },
          });
        } else {
          logInfo("VAPI resources provisioned successfully (async)", {
            ...baseLogOptions,
            context: { accountId },
          });
        }
      })
      .catch((provisionError) => {
        logError("VAPI provisioning error (async)", {
          ...baseLogOptions,
          error: provisionError,
          context: { accountId },
        });
      });

    if (typeof (globalThis as any).EdgeRuntime !== "undefined" && (globalThis as any).EdgeRuntime.waitUntil) {
      (globalThis as any).EdgeRuntime.waitUntil(vapiProvisioningTask);
    }

    await supabase.from("signup_attempts").insert({
      email,
      phone,
      ip_address: clientIP,
      device_fingerprint: validatedData.deviceFingerprint,
      success: true,
    });

    logInfo("Returning success response", {
      ...baseLogOptions,
      context: {
        userId: authData.user.id,
        accountId,
        subscriptionId: subscription.id,
      },
    });

    return new Response(
      JSON.stringify({
        ok: true,
        user_id: authData.user.id,
        account_id: accountId,
        email: email,
        password: password,
        stripe_customer_id: customer.id,
        subscription_id: subscription.id,
        trial_end_date: trialEndDate,
        plan_type: validatedData.planType,
        message: "Trial started! No charge for 3 days.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    logError("Free trial signup error", {
      ...baseLogOptions,
      error,
    });
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
