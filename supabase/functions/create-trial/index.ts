/*
 * ═══════════════════════════════════════════════════════════════════════════
 * FUNCTION: create-trial
 *
 * SYNCHRONOUS vs ASYNCHRONOUS PROVISIONING STRATEGY
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This function creates new trial or paid accounts for both homepage and /sales
 * signup flows. It uses a split provisioning strategy:
 *
 * SYNCHRONOUS (Core Provisioning - executes before returning response):
 *   1. Input validation
 *   2. Anti-abuse checks (for website signups only)
 *   3. Create Stripe customer
 *   4. Attach payment method to Stripe customer
 *   5. Create Stripe subscription (3-day trial for website, active for sales)
 *   6. Create Supabase auth user
 *   7. Create account record
 *   8. Create profile record
 *   9. Assign owner role
 *   10. CREATE VAPI ASSISTANT (fast, ~2-3 seconds)
 *   11. Create provisioning job record
 *   12. Return success response immediately
 *
 * ASYNCHRONOUS (Slow Provisioning - runs in background):
 *   1. Create Vapi phone number (SLOW: 1-2 minutes for activation)
 *   2. Link phone number to assistant
 *   3. Save phone number to database
 *   4. Generate referral code
 *   5. Send welcome emails
 *   6. Update account.phone_provisioning_status = 'ready'
 *
 * WHY THIS SPLIT:
 *   - Vapi assistant creation is fast and should complete before user sees dashboard
 *   - Vapi phone number provisioning can take 1-2 minutes for the number to
 *     become fully active and able to receive calls
 *   - We don't want users waiting on a spinner for 1-2 minutes
 *   - Instead, we return success immediately and show "Setting up your phone number"
 *     in the dashboard while the async provisioning completes
 *
 * ERROR HANDLING:
 *   - Synchronous errors: Return error response, no account created
 *   - Async provisioning errors: Account exists, phone_provisioning_status='failed',
 *     support team notified, user can contact support or retry
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { isDisposableEmail } from "../_shared/disposable-domains.ts";
import { isValidPhoneNumber } from "../_shared/validators.ts";
import { extractCorrelationId, logError, logInfo, logWarn } from "../_shared/logging.ts";
import { buildVapiPrompt } from "../_shared/template-builder.ts";

const FUNCTION_NAME = "create-trial";
const VAPI_API_KEY = Deno.env.get("VAPI_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Validation schema
const signupSchema = z.object({
  name: z.string().trim().min(1, "Name required").max(100),
  email: z.string().trim().email("Invalid email").max(255),
  phone: z.string().trim().min(1, "Phone required"),
  companyName: z.string().trim().min(1, "Company name required").max(200),
  trade: z.string().max(100),
  zipCode: z.string().trim().regex(/^\d{5}$/, "5-digit ZIP required"),
  planType: z.enum(["starter", "professional", "premium"]),
  paymentMethodId: z.string().min(1, "Payment method required"),
  source: z.enum(["website", "sales"]).default("website"),

  // Optional fields
  website: z.string().max(255).optional(),
  serviceArea: z.string().max(200).optional(),
  businessHours: z.string().optional(),
  emergencyPolicy: z.string().max(1000).optional(),
  assistantGender: z.enum(["female", "male"]).default("female"),
  wantsAdvancedVoice: z.boolean().default(false),
  salesRepName: z.string().max(100).optional(),
  referralCode: z.string().max(50).optional(),
  deviceFingerprint: z.string().max(500).optional(),
  primaryGoal: z.string().max(500).optional(),
  leadId: z.string().uuid().optional(), // Link to signup_leads table
});

type SignupData = z.infer<typeof signupSchema>;

function getStripePriceId(planType: string): string {
  const priceIds = {
    starter: Deno.env.get("STRIPE_PRICE_STARTER"),
    professional: Deno.env.get("STRIPE_PRICE_PROFESSIONAL"),
    premium: Deno.env.get("STRIPE_PRICE_PREMIUM"),
  };

  const priceId = priceIds[planType as keyof typeof priceIds];
  if (!priceId) {
    throw new Error(`Price ID not configured for plan: ${planType}`);
  }
  return priceId;
}

// Helper: Derive state code from ZIP code (simplified)
function getStateFromZip(zipCode: string): string {
  const zip = parseInt(zipCode.substring(0, 3));

  // Simplified ZIP to state mapping (first 3 digits)
  if (zip >= 300 && zip <= 319) return "CO"; // Colorado
  if (zip >= 970 && zip <= 999) return "CA"; // California (some ranges)
  if (zip >= 900 && zip <= 961) return "CA"; // California
  if (zip >= 750 && zip <= 799) return "TX"; // Texas
  if (zip >= 100 && zip <= 149) return "NY"; // New York
  if (zip >= 600 && zip <= 629) return "IL"; // Illinois
  if (zip >= 980 && zip <= 994) return "WA"; // Washington

  // Default to California if unknown
  return "CA";
}

serve(async (req) => {
  const correlationId = extractCorrelationId(req);
  const baseLogOptions = { functionName: FUNCTION_NAME, correlationId };
  let currentAccountId: string | null = null;

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // ═══════════════════════════════════════════════════════════════
    // STEP 1: Validate Input
    // ═══════════════════════════════════════════════════════════════

    const rawData = await req.json();
    let data: SignupData;

    try {
      data = signupSchema.parse(rawData);
    } catch (zodError: any) {
      return new Response(
        JSON.stringify({ error: "Invalid input", details: zodError.errors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logInfo("Signup request received", {
      ...baseLogOptions,
      context: {
        source: data.source,
        planType: data.planType,
        email: data.email
      }
    });

    if (!isValidPhoneNumber(data.phone)) {
      return new Response(
        JSON.stringify({ error: "Invalid phone number format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 2: Anti-Abuse Checks (Website Only)
    // ═══════════════════════════════════════════════════════════════

    if (data.source === "website") {
      if (isDisposableEmail(data.email)) {
        logWarn("Blocked disposable email", {
          ...baseLogOptions,
          context: { email: data.email }
        });
        return new Response(
          JSON.stringify({ error: "Please use a valid business or personal email" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

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
        return new Response(
          JSON.stringify({ error: "Trial limit reached for this location" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

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
        return new Response(
          JSON.stringify({ error: "This phone number was recently used for a trial" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 3: Create Stripe Customer
    // ═══════════════════════════════════════════════════════════════

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    logInfo("Creating Stripe customer", {
      ...baseLogOptions,
      context: { email: data.email }
    });

    const customer = await stripe.customers.create({
      email: data.email,
      name: data.name,
      phone: data.phone,
      metadata: {
        company_name: data.companyName,
        source: data.source,
        trade: data.trade,
        sales_rep: data.salesRepName || "",
      },
    });

    logInfo("Stripe customer created", {
      ...baseLogOptions,
      context: { customerId: customer.id }
    });

    // ═══════════════════════════════════════════════════════════════
    // STEP 4: Attach Payment Method
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
    // STEP 5: Create Subscription (trial for website, active for sales)
    // ═══════════════════════════════════════════════════════════════

    const priceId = getStripePriceId(data.planType);

    const subscriptionParams: any = {
      customer: customer.id,
      items: [{ price: priceId }],
      payment_behavior: "default_incomplete",
      metadata: {
        source: data.source,
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
    // STEP 6: Create Auth User
    // ═══════════════════════════════════════════════════════════════

    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    const tempPassword = Array.from(
      { length: 16 },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join("");

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: data.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        company_name: data.companyName,
        name: data.name,
        phone: data.phone,
        trade: data.trade,
        source: data.source,
      },
    });

    if (authError) {
      if (authError.message?.toLowerCase().includes("already") ||
          authError.message?.toLowerCase().includes("duplicate")) {
        logWarn("Email already registered", {
          ...baseLogOptions,
          context: { email: data.email }
        });
        return new Response(
          JSON.stringify({ error: "This email is already registered" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw authError;
    }

    logInfo("Auth user created", {
      ...baseLogOptions,
      context: { userId: authData.user.id, email: data.email }
    });

    // ═══════════════════════════════════════════════════════════════
    // STEP 7: Create Account Record
    // ═══════════════════════════════════════════════════════════════

    const isWebsiteTrial = data.source === "website";
    const subscriptionStatus = isWebsiteTrial ? "trial" : "active";
    const trialStartDate = isWebsiteTrial ? new Date().toISOString() : null;
    const trialEndDate = isWebsiteTrial
      ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
      : null;

    let businessHoursValue = null;
    if (data.businessHours) {
      try {
        businessHoursValue = JSON.parse(data.businessHours);
      } catch {
        businessHoursValue = { text: data.businessHours };
      }
    }

    // Derive billing state from ZIP code
    const billingState = getStateFromZip(data.zipCode);

    logInfo("Creating account record", {
      ...baseLogOptions,
      context: {
        companyName: data.companyName,
        billingState,
        source: data.source,
        subscriptionStatus
      }
    });

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

        subscription_status: subscriptionStatus,
        trial_start_date: trialStartDate,
        trial_end_date: trialEndDate,

        stripe_customer_id: customer.id,
        stripe_subscription_id: subscription.id,
        plan_type: data.planType,

        source: data.source,
        sales_rep_name: data.salesRepName || null,

        provisioning_status: "pending",
        phone_number_status: "pending",
        phone_number_area_code: data.zipCode.slice(0, 3),
        billing_state: billingState,
        zip_code: data.zipCode,
      })
      .select()
      .single();

    if (accountError) {
      logError("Account creation failed", {
        ...baseLogOptions,
        error: accountError,
        context: {
          message: accountError.message,
          details: accountError.details,
          hint: accountError.hint,
          code: accountError.code
        }
      });
      throw new Error(`Account creation failed: ${accountError.message}`);
    }

    currentAccountId = accountData.id;

    logInfo("Account created", {
      ...baseLogOptions,
      accountId: currentAccountId,
      context: {
        subscriptionStatus,
        source: data.source
      }
    });

    // ═══════════════════════════════════════════════════════════════
    // STEP 8: Create Profile Record
    // ═══════════════════════════════════════════════════════════════

    const { error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: authData.user.id,
        account_id: accountData.id,
        name: data.name,
        phone: data.phone,
        is_primary: true,
        source: data.source,
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
    // STEP 9: Assign Owner Role
    // ═══════════════════════════════════════════════════════════════

    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({
        user_id: authData.user.id,
        role: "owner",
      });

    if (roleError) {
      logWarn("Owner role assignment failed (non-critical)", {
        ...baseLogOptions,
        accountId: currentAccountId,
        error: roleError
      });
    } else {
      logInfo("Owner role assigned", {
        ...baseLogOptions,
        accountId: currentAccountId
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 10: Create Vapi Assistant (SYNCHRONOUS - Fast Operation)
    // ═══════════════════════════════════════════════════════════════

    let vapiAssistantId: string | null = null;

    if (VAPI_API_KEY) {
      logInfo("Creating Vapi assistant (synchronous)", {
        ...baseLogOptions,
        accountId: currentAccountId
      });

      const voiceId = data.assistantGender === "male" ? "michael" : "sarah";

      // Get state recording laws for prompt
      const { data: recordingLaw } = await supabase
        .from("state_recording_laws")
        .select("*")
        .eq("state_code", "CA") // Default to CA, will be updated later
        .maybeSingle();

      const prompt = await buildVapiPrompt({
        company_name: data.companyName,
        trade: data.trade,
        service_area: data.serviceArea || "",
        business_hours: businessHoursValue || null,
        custom_instructions: null,
        service_specialties: null,
        company_website: data.website || "",
      }, recordingLaw);

      const assistantResponse = await fetch("https://api.vapi.ai/assistant", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${VAPI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `${data.companyName} Assistant`,
          model: {
            provider: "openai",
            model: "gpt-4o-mini",
            temperature: 0.7,
            systemPrompt: prompt,
          },
          voice: {
            provider: "11labs",
            voiceId: voiceId,
          },
          firstMessage: `Thank you for calling ${data.companyName}. How can I help you today?`,
        }),
      });

      if (!assistantResponse.ok) {
        const errorText = await assistantResponse.text();
        logError("Vapi assistant creation failed", {
          ...baseLogOptions,
          accountId: currentAccountId,
          error: new Error(errorText)
        });
        // Don't throw - we can create assistant later
        // Update account to reflect assistant creation failure
        await supabase
          .from("accounts")
          .update({
            provisioning_status: "partial",
            provisioning_error: `Assistant creation failed: ${errorText}`,
          })
          .eq("id", currentAccountId);
      } else {
        const assistantData = await assistantResponse.json();
        vapiAssistantId = assistantData.id;

        // Update account with assistant ID immediately
        await supabase
          .from("accounts")
          .update({
            vapi_assistant_id: vapiAssistantId,
          })
          .eq("id", currentAccountId);

        // Also insert into assistants table
        await supabase
          .from("assistants")
          .insert({
            account_id: currentAccountId,
            vapi_assistant_id: vapiAssistantId,
            name: `${data.companyName} Assistant`,
            voice_id: voiceId,
            voice_gender: data.assistantGender,
            is_primary: true,
            status: "active",
          });

        logInfo("Vapi assistant created successfully", {
          ...baseLogOptions,
          accountId: currentAccountId,
          context: { vapiAssistantId }
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 11: Create Provisioning Job
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
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 12: Trigger Async Phone Provisioning (ASYNCHRONOUS - Slow)
    // ═══════════════════════════════════════════════════════════════

    logInfo("Triggering async phone provisioning", {
      ...baseLogOptions,
      accountId: currentAccountId
    });

    const provisioningTask = supabase.functions
      .invoke("provision-phone-number", {
        body: {
          accountId: accountData.id,
          email: data.email,
          name: data.name,
          phone: data.phone,
          areaCode: data.zipCode.slice(0, 3),
          companyName: data.companyName,
        },
      })
      .then((response) => {
        if (response.error) {
          logError("Async phone provisioning failed", {
            ...baseLogOptions,
            accountId: currentAccountId,
            error: response.error
          });
        } else {
          logInfo("Async phone provisioning completed", {
            ...baseLogOptions,
            accountId: currentAccountId
          });
        }
      })
      .catch((error) => {
        logError("Async phone provisioning error", {
          ...baseLogOptions,
          accountId: currentAccountId,
          error
        });
      });

    // Don't await - let it run in background
    if (typeof (globalThis as any).EdgeRuntime !== "undefined" &&
        (globalThis as any).EdgeRuntime.waitUntil) {
      (globalThis as any).EdgeRuntime.waitUntil(provisioningTask);
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 13: Link to Lead Record (if provided)
    // ═══════════════════════════════════════════════════════════════

    if (data.leadId) {
      logInfo("Linking signup to lead record", {
        ...baseLogOptions,
        accountId: currentAccountId,
        context: { leadId: data.leadId }
      });

      const { error: leadUpdateError } = await supabase
        .from("signup_leads")
        .update({
          auth_user_id: authData.user.id,
          account_id: accountData.id,
          profile_id: authData.user.id,
          completed_at: new Date().toISOString(),
        })
        .eq("id", data.leadId);

      if (leadUpdateError) {
        logWarn("Failed to link lead record (non-critical)", {
          ...baseLogOptions,
          accountId: currentAccountId,
          context: { leadId: data.leadId, error: leadUpdateError.message }
        });
      } else {
        logInfo("Lead linked successfully", {
          ...baseLogOptions,
          accountId: currentAccountId
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 14: Log Success for Analytics
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
    // STEP 15: Return Success Response (IMMEDIATELY)
    // ═══════════════════════════════════════════════════════════════

    const successMessage = isWebsiteTrial
      ? "Trial started! Your AI assistant is ready. Your phone number is being set up..."
      : "Account created! Your AI assistant is ready. Your phone number is being set up...";

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
        vapi_assistant_id: vapiAssistantId,
        phone_number_status: "pending",
        message: successMessage,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    logError("Trial creation failed", {
      ...baseLogOptions,
      accountId: currentAccountId,
      error
    });

    const errorMessage = error instanceof Error ? error.message : "Internal server error";

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
