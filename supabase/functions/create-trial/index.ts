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

// import { serve } from "https://deno.land/std@0.168.0/http/server.ts"; // Removed: Causes event loop issues in new runtime
import { createClient } from "supabase";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno&deno-std=0.168.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import {
  extractCorrelationId,
  logError,
  logInfo,
  logWarn,
  maskEmailForLogs,
  maskPhoneForLogs,
  stepEnd,
  stepError,
  stepStart,
} from "../_shared/logging.ts";
import { isDisposableEmail } from "../_shared/disposable-domains.ts";
import { isValidPhoneNumber } from "../_shared/validators.ts";
import { getRequiredEnv, assertEnv } from "../_shared/env-validation.ts";
import { initSentry, captureError, setContext } from "../_shared/sentry.ts";
import {
  sendSignupFailureNotifications,
  sendSignupNotifications,
} from "../_shared/signup-notifications.ts";
import { posthog } from "../_shared/posthog.ts";

/** PostHog server-side capture — best-effort, never throws. */
async function capturePostHogEvent(
  event: string,
  distinctId: string,
  props: Record<string, unknown>
): Promise<void> {
  const key = Deno.env.get('POSTHOG_API_KEY');
  if (!key) return;
  try {
    await fetch('https://us.i.posthog.com/capture/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        event,
        distinct_id: distinctId,
        properties: { ...props, $lib: 'edge-function' },
        timestamp: new Date().toISOString(),
      }),
    });
  } catch { /* best-effort */ }
}

/** PostHog server-side exception capture — best-effort, never throws. */
async function capturePostHogException(
  err: unknown,
  tags: Record<string, unknown>,
  distinctId: string
): Promise<void> {
  const e = err instanceof Error ? err : new Error(String(err));
  try {
    await posthog?.captureException(e, distinctId, {
      error_message: e.message,
      ...tags,
    });
  } catch { /* best-effort */ }
}

async function flushPostHogClient(): Promise<void> {
  if (!posthog) return;
  try {
    await posthog.flush();
  } catch {
    // best-effort
  }
}

function captureCreateTrialException(
  err: unknown,
  step: string,
  distinctId: string,
  context: Record<string, unknown> = {}
): void {
  capturePostHogException(err, {
    error_source: "create_trial",
    step,
    error_message: err instanceof Error ? err.message : String(err),
    ...context,
  }, distinctId);
}

const FUNCTION_NAME = "create-trial";

// ═══════════════════════════════════════════════════════════════════════════
// FEATURE FLAG: Structured Error Responses
// Set to "true" to enable user-friendly error messages
// Set to "false" or omit to preserve legacy behavior (for easy rollback)
// ═══════════════════════════════════════════════════════════════════════════
const ENABLE_STRUCTURED_TRIAL_ERRORS =
  Deno.env.get("ENABLE_STRUCTURED_TRIAL_ERRORS") === "true";

// ═══════════════════════════════════════════════════════════════════════════
// STRUCTURED ERROR TYPES (Additive - does not replace existing types)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Structured error response for trial creation
 * Includes both new fields (errorCode, userMessage) and legacy fields (error, message)
 * for backward compatibility
 */
interface TrialCreationErrorResponse {
  success: false;
  errorCode: string;
  userMessage: string;
  debugMessage?: string;
  correlationId: string;
  phase?: string;
  retryable: boolean;
  suggestedAction?: string;
  // Legacy fields preserved for backward compatibility
  error?: string;
  message?: string;
  request_id?: string;
}

type ErrorCode =
  | 'CARD_DECLINED'
  | 'CARD_NOT_SUPPORTED'
  | 'CARD_EXPIRED'
  | 'INSUFFICIENT_FUNDS'
  | 'INCORRECT_CVC'
  | 'PAYMENT_AUTH_REQUIRED'
  | 'PAYMENT_PROCESSOR_ERROR'
  | 'INTERNAL_ERROR';


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, idempotency-key, sentry-trace, baggage",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, PATCH, DELETE",
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
  // Accept new plan keys AND legacy keys (all new signups default to night_weekend)
  planType: z.enum(["night_weekend", "lite", "core", "pro", "starter", "professional", "premium"])
    .default("night_weekend"),
  paymentMethodId: z.string().min(1, "Payment method required"),

  // Source tracking (CRITICAL - differentiates flows)
  source: z.enum(["website", "sales"]).default("website"),
  salesRepName: z.string().max(100).optional(),

  // Optional metadata
  referralCode: z.string().length(8).optional().or(z.literal("")),
  deviceFingerprint: z.string().max(500).optional(),
  leadId: z.union([z.string().uuid(), z.null(), z.undefined()]).optional(),

  // Test Mode Bypass Override
  bypassStripe: z.boolean().optional(),

  // Onboarding signals for post-trial plan pre-selection
  teamSize: z.string().max(50).optional(),
  coveragePreference: z.enum(["after_hours_only", "24_7"]).optional(),
  selectedPostTrialPlan: z.enum(["night_weekend", "lite", "core", "pro"]).optional(),
});

/**
 * Normalize payload to handle null/empty values for optional fields
 */
function normalizePayload(rawPayload: any): any {
  const normalized = { ...rawPayload };
  const optionalFields = [
    'leadId', 'referralCode', 'deviceFingerprint', 'website', 'serviceArea',
    'zipCode', 'businessHours', 'emergencyPolicy', 'primaryGoal', 'salesRepName',
    'teamSize', 'coveragePreference', 'selectedPostTrialPlan',
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
 * Create an admin alert for critical failures that need manual intervention
 */
async function createAdminAlert(
  supabase: any,
  alertType: string,
  details: Record<string, any>,
  accountId?: string | null
): Promise<void> {
  try {
    await supabase.from("call_pattern_alerts").insert({
      account_id: accountId || null,
      alert_type: `edge_function_${alertType}`,
      alert_details: {
        function_name: FUNCTION_NAME,
        timestamp: new Date().toISOString(),
        ...details,
      },
      resolved: false,
    });
    console.log(`[${FUNCTION_NAME}] Admin alert created: ${alertType}`);
  } catch (err: any) {
    // Don't fail the main flow if alert creation fails
    logError("Failed to create admin alert", {
      functionName: FUNCTION_NAME,
      correlationId: typeof details?.request_id === "string" ? details.request_id : crypto.randomUUID(),
      accountId: accountId ?? null,
      error: err,
      context: {
        alertType,
        phase: "admin_alert",
      },
    });
    captureCreateTrialException(err, "admin_alert_create", accountId ?? "anonymous", {
      alert_type: alertType,
      account_id: accountId ?? null,
    });
  }
}

/**
 * Track analytics event (Best Effort)
 */
async function trackEvent(
  supabase: any,
  accountId: string | null,
  userId: string | null,
  eventType: string,
  metadata: any = {},
  correlationId?: string
): Promise<void> {
  // Allow tracking events without account_id (e.g. signup_started)
  try {
    await supabase.from("analytics_events").insert({
      account_id: accountId, // Can be null now
      user_id: userId,
      event_type: eventType,
      metadata: metadata,
    });
  } catch (err) {
    logError("Failed to track analytics event", {
      functionName: FUNCTION_NAME,
      correlationId: correlationId ?? crypto.randomUUID(),
      accountId: accountId ?? null,
      error: err,
      context: {
        eventType,
        phase: "analytics_tracking",
        userId: userId ?? null,
      },
    });
    captureCreateTrialException(err, "analytics_tracking", userId ?? accountId ?? "anonymous", {
      account_id: accountId,
      user_id: userId,
      event_type: eventType,
    });
  }
}

/**
 * Check if a user already exists by email and return their info
 */
async function getExistingUserByEmail(
  supabase: any,
  email: string,
  correlationId?: string
): Promise<{ id: string; hasAccount: boolean; accountId?: string } | null> {
  try {
    // First, try to find the user in auth.users via admin API
    const { data: users, error } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    });

    // Since listUsers doesn't filter by email, we need a different approach
    // Check profiles table which has email
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, account_id")
      .eq("email", email)
      .maybeSingle();

    if (profileError || !profile) {
      return null;
    }

    return {
      id: profile.id,
      hasAccount: !!profile.account_id,
      accountId: profile.account_id,
    };
  } catch (err) {
    logError("Error checking existing user", {
      functionName: FUNCTION_NAME,
      correlationId: correlationId ?? crypto.randomUUID(),
      error: err,
      context: {
        phase: "existing_user_check",
        email: maskEmailForLogs(email),
      },
    });
    captureCreateTrialException(err, "existing_user_check", email, {
      user_email: email,
    });
    return null;
  }
}

/**
 * Get Stripe price ID for plan type
 */
function getStripePriceId(planType: string): string {
  const stripeKey = (Deno.env.get("STRIPE_SECRET_KEY") || "").trim();
  // Check for live key or if the key contains "_live_" (to be extra safe)
  const isLive = stripeKey.startsWith("sk_live_") || stripeKey.startsWith("rk_live_") || stripeKey.includes("_live_");

  logInfo('getStripePriceId resolving plan', { functionName: FUNCTION_NAME, context: { isLive, plan: planType } });

  // Normalize legacy plan keys to new plan keys
  const legacyToNew: Record<string, string> = {
    starter: "night_weekend",
    professional: "core",
    premium: "pro",
  };
  const normalizedPlan = legacyToNew[planType] || planType;

  // New plan price IDs from environment variables (populated via stripe-setup-new-plans.js)
  const newPlanPriceIds: Record<string, string | undefined> = {
    night_weekend: Deno.env.get("STRIPE_PRICE_ID_NIGHT_WEEKEND"),
    lite: Deno.env.get("STRIPE_PRICE_ID_LITE"),
    core: Deno.env.get("STRIPE_PRICE_ID_CORE"),
    pro: Deno.env.get("STRIPE_PRICE_ID_PRO"),
  };

  const newPriceId = newPlanPriceIds[normalizedPlan];
  if (newPriceId) {
    console.log(`[getStripePriceId] Using new plan price ID for ${normalizedPlan}: ${newPriceId}`);
    return newPriceId;
  }

  // Fallback to legacy hardcoded live IDs (in case new IDs not yet configured)
  if (isLive) {
    const livePriceIds: Record<string, string> = {
      starter: "price_1SMav5IdevV48BnpEEIRKvk5",
      professional: "price_1SMaw9IdevV48BnpJkUs1UY0",
      premium: "price_1SMawyIdevV48BnpM9r2mk2g",
    };
    const liveId = livePriceIds[planType];
    if (liveId) {
      console.log(`[getStripePriceId] Using legacy HARDCODED LIVE price ID: ${liveId}`);
      return liveId;
    }
  }

  // Fallback to legacy environment variables
  console.log("[getStripePriceId] Falling back to legacy ENV VAR price IDs");
  const legacyPriceIds: Record<string, string | undefined> = {
    starter: Deno.env.get("STRIPE_PRICE_STARTER_OLD"),
    professional: Deno.env.get("STRIPE_PRICE_PROFESSIONAL_OLD"),
    premium: Deno.env.get("STRIPE_PRICE_PREMIUM_OLD"),
  };

  const priceId = legacyPriceIds[planType];
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
    captureCreateTrialException(cleanupError, "stripe_cleanup", logOptions?.userId ?? "anonymous", {
      customer_id: customerId,
      subscription_id: subscriptionId,
    });
  }
}

/**
 * Map Stripe error to user-friendly error response
 * ONLY used when ENABLE_STRUCTURED_TRIAL_ERRORS is true
 * Preserves legacy fields for backward compatibility
 */
function mapStripeErrorToUserError(
  stripeError: any,
  phase: string,
  correlationId: string,
  requestId?: string
): TrialCreationErrorResponse {
  const message = stripeError.message?.toLowerCase() || '';

  // Card not supported
  if (message.includes('does not support this type of purchase')) {
    return {
      success: false,
      errorCode: 'CARD_NOT_SUPPORTED',
      userMessage: 'This card was declined by your bank. Please try a different card or contact your bank.',
      debugMessage: stripeError.message,
      correlationId,
      phase,
      retryable: true,
      suggestedAction: 'Try a different payment method',
      // Legacy fields
      error: stripeError.message,
      message: stripeError.message,
      request_id: requestId
    };
  }

  // Generic card declined
  if (message.includes('card_declined') || message.includes('card was declined') || message.includes('declined')) {
    return {
      success: false,
      errorCode: 'CARD_DECLINED',
      userMessage: 'Your card was declined. Please try a different card.',
      debugMessage: stripeError.message,
      correlationId,
      phase,
      retryable: true,
      suggestedAction: 'Try a different payment method',
      error: stripeError.message,
      message: stripeError.message,
      request_id: requestId
    };
  }

  // Insufficient funds
  if (message.includes('insufficient') || message.includes('funds')) {
    return {
      success: false,
      errorCode: 'INSUFFICIENT_FUNDS',
      userMessage: 'Your card was declined due to insufficient funds. Please try a different card.',
      debugMessage: stripeError.message,
      correlationId,
      phase,
      retryable: true,
      suggestedAction: 'Try a different payment method',
      error: stripeError.message,
      message: stripeError.message,
      request_id: requestId
    };
  }

  // Expired card
  if (message.includes('expired')) {
    return {
      success: false,
      errorCode: 'CARD_EXPIRED',
      userMessage: 'Your card has expired. Please use a valid card.',
      debugMessage: stripeError.message,
      correlationId,
      phase,
      retryable: true,
      suggestedAction: 'Update your payment method',
      error: stripeError.message,
      message: stripeError.message,
      request_id: requestId
    };
  }

  // Incorrect CVC
  if (message.includes('cvc') || message.includes('security code') || message.includes('incorrect_cvc')) {
    return {
      success: false,
      errorCode: 'INCORRECT_CVC',
      userMessage: 'The security code (CVC) was incorrect. Please check and try again.',
      debugMessage: stripeError.message,
      correlationId,
      phase,
      retryable: true,
      suggestedAction: 'Verify your card security code',
      error: stripeError.message,
      message: stripeError.message,
      request_id: requestId
    };
  }

  // Authentication required
  if (message.includes('authentication') || message.includes('3d secure')) {
    return {
      success: false,
      errorCode: 'PAYMENT_AUTH_REQUIRED',
      userMessage: 'Your card requires additional verification. Please try a different card.',
      debugMessage: stripeError.message,
      correlationId,
      phase,
      retryable: true,
      suggestedAction: 'Try a different payment method',
      error: stripeError.message,
      message: stripeError.message,
      request_id: requestId
    };
  }

  // Fallback for payment errors
  return {
    success: false,
    errorCode: 'PAYMENT_PROCESSOR_ERROR',
    userMessage: 'We could not process your payment. Please try again or use a different card.',
    debugMessage: stripeError.message,
    correlationId,
    phase,
    retryable: true,
    suggestedAction: 'Try again or contact support',
    error: stripeError.message,
    message: stripeError.message,
    request_id: requestId
  };
};


/**
 * Retry helper for transient failures
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  options: { retries: number; delay: number; operationName: string }
): Promise<T> {
  let lastError: any;

  for (let i = 0; i < options.retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      console.warn(`[${options.operationName}] Attempt ${i + 1} failed: ${err.message}`);
      captureCreateTrialException(err, "with_retry_attempt", "anonymous", {
        operation_name: options.operationName,
        attempt: i + 1,
      });

      // Don't retry if it looks like a permanent validation error (e.g. 400s)
      if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
        throw err;
      }

      if (i < options.retries - 1) {
        await new Promise(resolve => setTimeout(resolve, options.delay * Math.pow(2, i)));
      }
    }
  }

  throw lastError;
}

/**
 * Pre-select a post-trial plan from onboarding signals.
 * Mirrors the frontend logic in src/lib/billing/dashboardPlans.ts.
 */
function preSelectPostTrialPlan(signals: {
  trade?: string | null;
  teamSize?: string | null;
  coveragePreference?: string | null;
  explicit?: string | null;
}): { planKey: string; reason: string } {
  if (signals.explicit) {
    return { planKey: signals.explicit, reason: "explicit_selection" };
  }
  if (signals.coveragePreference === "after_hours_only") {
    return { planKey: "night_weekend", reason: "coverage_after_hours_only" };
  }
  const trade = (signals.trade || "").toLowerCase();
  const teamSize = (signals.teamSize || "").toLowerCase();
  // Use exact matching to avoid "6-10".includes("10") routing mid-sized teams to Pro.
  // Valid teamSize values: 'solo' | '2-5' | '6-10' | '10+'
  if (teamSize === "10+") {
    return { planKey: "pro", reason: "team_size_large" };
  }
  if (trade.includes("hvac") || trade.includes("plumb") || trade.includes("multi") || teamSize === "6-10") {
    return { planKey: "core", reason: teamSize === "6-10" ? "multi_truck" : "trade_high_volume" };
  }
  return { planKey: "lite", reason: "default" };
}

Deno.serve(async (req: Request) => {
  try {
  const request_id = crypto.randomUUID();
  const correlationId = extractCorrelationId(req);
  const baseLogOptions = {
    functionName: FUNCTION_NAME,
    correlationId,
    request_id,
  };

  const baseStepContext = () => ({
    functionName: FUNCTION_NAME,
    traceId: request_id,
    accountId: currentAccountId,
    userId: currentUserId,
  });

  logInfo("create-trial invocation started", {
    ...baseLogOptions,
    context: { version: "2025-12-10-LOGGING-FIX-V3" },
  });

  // Initialize Sentry for error tracking
  initSentry(FUNCTION_NAME, { correlationId });

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate required environment variables
  try {
    const requiredVars = getRequiredEnv(['SUPABASE', 'STRIPE', 'VAPI']);
    requiredVars.push(
      'STRIPE_PRICE_ID_NIGHT_WEEKEND',
      'STRIPE_PRICE_ID_LITE',
      'STRIPE_PRICE_ID_CORE',
      'STRIPE_PRICE_ID_PRO',
    );
    assertEnv(requiredVars, FUNCTION_NAME);
  } catch (envError: any) {
    captureCreateTrialException(envError, "env_validation", "anonymous");
    return new Response(
      JSON.stringify({
        success: false,
        error: "Service configuration error. Please contact support.",
        details: envError.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  let currentAccountId: string | null = null;
  let currentUserId: string | null = null; // Restore missing var
  // Initialize customer/subscription as basic objects to satisfy TS before assignment
  let customer: any = null;
  let subscription: any = null;
  let stripeCustomerId: string | null = null;
  let stripeSubscriptionId: string | null = null;
  let attemptedSignupData: {
    email?: string;
    name?: string;
    companyName?: string;
    phone?: string;
    trade?: string;
    planType?: string;
    source?: string;
  } = {};
  let phase = "start";
  // Declare supabase in outer scope so catch block can access it for error tracking
  let supabase: any = null;

  try {
    console.log(`[${FUNCTION_NAME}] request_id=${request_id} phase=${phase}`);
    // ... Initialization ...
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Missing Supabase environment variables");
    }

    supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
    // Only init stripe if key exists to avoid crash, though assertEnv checks it later
    const stripe = stripeKey ? new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    }) : null;

    // ... Idempotency ...
    const idempotencyKey = req.headers.get("idempotency-key") || req.headers.get("Idempotency-Key");

    if (idempotencyKey) {
      logInfo("Checking idempotency key", {
        ...baseLogOptions,
        context: { idempotencyKey },
      });

      try {
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
      } catch (err: any) {
        stepError("idempotency_check", baseStepContext(), err, { phase: "idempotency_check" });
        logWarn("Idempotency check error (continuing)", { ...baseLogOptions, error: err });
        captureCreateTrialException(err, "idempotency_check", currentUserId ?? attemptedSignupData.email ?? "anonymous");
      }
    }

    // ... Input Validation ...
    phase = "validate_input";
    let rawData: any;
    try {
      rawData = await req.json();
    } catch (err: any) {
      logWarn("Invalid JSON in request body", { ...baseLogOptions, error: err, context: { phase } });
      captureCreateTrialException(err, "validate_input_json_parse", attemptedSignupData.email ?? "anonymous");
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: corsHeaders });
    }

    // ... Schema Parse ...
    const normalizedData = normalizePayload(rawData);
    let data: z.infer<typeof createTrialSchema>;

    try {
      data = createTrialSchema.parse(normalizedData);
    } catch (zodError: any) {
      logWarn("Validation error in create-trial", {
        ...baseLogOptions,
        context: { errors: zodError.errors, rawLeadId: rawData.leadId },
      });
      captureCreateTrialException(zodError, "validate_input_schema", attemptedSignupData.email ?? "anonymous", {
        validation_errors: zodError?.errors,
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

    attemptedSignupData = {
      email: data.email,
      name: data.name,
      companyName: data.companyName,
      phone: data.phone,
      trade: data.trade,
      planType: data.planType,
      source: data.source,
    };

    logInfo("Creating trial account", {
      ...baseLogOptions,
      context: {
        email: data.email,
        source: data.source,
        salesRep: data.salesRepName,
        planType: data.planType,
      },
    });

    // We can't track 'signup_started' in DB yet because we don't have an account_id.
    // We will track it once the account is created.

    // ═══════════════════════════════════════════════════════════════
    // VALIDATION: Phone and email checks
    // ═══════════════════════════════════════════════════════════════

    if (!isValidPhoneNumber(data.phone)) {
      console.log("[create-trial] Invalid phone number", { phone: data.phone });
      captureCreateTrialException(new Error("Invalid phone number format"), "validation_phone", data.email ?? "anonymous", {
        phone_number: data.phone,
      });
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
      captureCreateTrialException(new Error("Disposable email blocked"), "validation_email", data.email ?? "anonymous", {
        user_email: data.email,
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

    // ═══════════════════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════════
    // DETERMINE MODE (Live vs Test)
    // Test mode triggers: zip code 99999, explicit bypassStripe flag, or magic payment method
    // ═══════════════════════════════════════════════════════════════
    const pmId = data.paymentMethodId || "";

    // Test mode: Zip 99999 triggers full test flow (no real Stripe, Twilio test creds)
    const isTestMode = data.zipCode === "99999";

    // Bypass mode: Skip Stripe (used by test mode or explicit bypass)
    const isBypassMode = isTestMode || data.bypassStripe === true || pmId.trim() === "pm_bypass_test" || pmId.trim() === "pm_bypass_check_deploy";

    // Log mode clearly for debugging
    logInfo(`Trial creation mode: ${isTestMode ? "TEST" : "LIVE"}`, {
      ...baseLogOptions,
      context: { zipCode: data.zipCode, isTestMode, isBypassMode },
    });
    console.log(`[${FUNCTION_NAME}] MODE=${isTestMode ? "TEST" : "LIVE"} zipCode=${data.zipCode} isBypassMode=${isBypassMode}`);


    // ═══════════════════════════════════════════════════════════════
    // ANTI-ABUSE: Rate limiting (website signups only)
    // ═══════════════════════════════════════════════════════════════

    phase = "anti_abuse";
    console.log(`[${FUNCTION_NAME}] request_id=${request_id} phase=${phase}`);

    // Skip rate limits if using Bypass Mode
    if (data.source === "website" && !isBypassMode) {
      const clientIP =
        req.headers.get("x-forwarded-for")?.split(",")[0] ||
        req.headers.get("cf-connecting-ip") ||
        "unknown";

      try {
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
          captureCreateTrialException(new Error("IP rate limit exceeded"), "validation_ip_rate_limit", data.email ?? "anonymous", {
            user_email: data.email,
            phone_number: data.phone,
            source: data.source,
          });

          return new Response(
            JSON.stringify({
              error: `Trial limit reached. Debug: source=${data.source}, bypass=${isBypassMode}`,
            }),
            {
              status: 429,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      } catch (err: any) {
        stepError("ip_rate_limit_check", baseStepContext(), err, { phase });
        logWarn("IP rate limit check error (continuing)", { ...baseLogOptions, error: err });
        captureCreateTrialException(err, "validation_ip_rate_limit_check", data.email ?? "anonymous", {
          user_email: data.email,
          phone_number: data.phone,
        });
      }

      // Check phone number reuse
      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

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
          captureCreateTrialException(new Error("Phone recently used for trial"), "validation_phone_reuse", data.email ?? "anonymous", {
            user_email: data.email,
            phone_number: data.phone,
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
      } catch (err: any) {
        stepError("phone_reuse_check", baseStepContext(), err, { phase });
        logWarn("Phone reuse check error (continuing)", { ...baseLogOptions, error: err });
        captureCreateTrialException(err, "validation_phone_reuse_check", data.email ?? "anonymous", {
          user_email: data.email,
          phone_number: data.phone,
        });
      }
    }

    // STRIPE LOGIC
    console.log(`[${FUNCTION_NAME}] Payment Logic Check`, {
      receivedPmId: pmId,
      hasExplicitFlag: data.bypassStripe,
      isBypassMode
    });

    if (isBypassMode) {
      logInfo("BYPASS MODE: Skipping Stripe API calls", baseLogOptions);
      customer = { id: `cus_bypass_${Date.now()}` };
      subscription = { id: `sub_bypass_${Date.now()}`, status: 'active' };
      stripeCustomerId = customer.id;
      stripeSubscriptionId = subscription.id;
    } else {
      // Real Stripe Flow
      if (!stripe) throw new Error("Stripe not initialized");

      const stripeIdempotencyPrefix = idempotencyKey || `auto-${correlationId}`;

      // Customer
      phase = "stripe_customer";
      try {
        customer = await stripe.customers.create({
          email: data.email,
          name: data.name,
          phone: data.phone,
          metadata: {
            company_name: data.companyName,
            trade: data.trade,
            source: data.source
          }
        }, { idempotencyKey: `${stripeIdempotencyPrefix}-customer` });
        stripeCustomerId = customer.id;
        logInfo("Stripe customer created", {
          ...baseLogOptions,
          context: {
            customerId: customer.id,
            source: data.source,
            email: data.email,
          },
        });
      } catch (e: any) {
        captureCreateTrialException(e, "stripe_customer_create", data.email ?? "anonymous", {
          user_email: data.email,
          phone_number: data.phone,
          plan_type: data.planType,
        });
        throw new Error(`Stripe Customer Create Failed: ${e.message}`);
      }

      // Payment Method
      phase = "stripe_payment_method";
      try {
        await stripe.paymentMethods.attach(data.paymentMethodId, { customer: customer.id });
        await stripe.customers.update(customer.id, {
          invoice_settings: { default_payment_method: data.paymentMethodId }
        });
        logInfo("Payment method attached", {
          ...baseLogOptions,
          context: { customerId: customer.id },
        });
      } catch (e: any) {
        // ALWAYS log full technical details (unchanged)
        logError("Stripe payment method attach failed", {
          ...baseLogOptions,
          accountId: currentAccountId,
          error: e,
          context: {
            phase,
            customerId: customer.id,
            paymentMethodId: data.paymentMethodId
          }
        });
        captureCreateTrialException(e, "stripe_payment_method_attach", data.email ?? "anonymous", {
          user_email: data.email,
          phone_number: data.phone,
          plan_type: data.planType,
        });

        // Always return a response directly for payment errors so the frontend can read
        // result.error/result.message. Throwing causes a 500 where the SDK returns
        // data:null, making the actual Stripe error inaccessible to the frontend.
        const errorResponse = mapStripeErrorToUserError(e, phase, correlationId, request_id);
        const status = ENABLE_STRUCTURED_TRIAL_ERRORS ? 400 : 200;
        return new Response(JSON.stringify(errorResponse), {
          status,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Subscription
      phase = "stripe_subscription";
      try {
        const priceId = getStripePriceId(data.planType);
        subscription = await stripe.subscriptions.create({
          customer: customer.id,
          items: [{ price: priceId }],
          trial_period_days: 3,
          payment_behavior: "default_incomplete",
          metadata: { source: data.source, plan_type: data.planType }
        }, { idempotencyKey: `${stripeIdempotencyPrefix}-subscription` });
        stripeSubscriptionId = subscription.id;
        logInfo("Stripe subscription created", {
          ...baseLogOptions,
          context: {
            subscriptionId: subscription.id,
            planType: data.planType,
            source: data.source,
            status: subscription.status,
          },
        });
      } catch (e: any) {
        // ALWAYS log full technical details (unchanged)
        logError("Stripe subscription creation failed", {
          ...baseLogOptions,
          accountId: currentAccountId,
          error: e,
          context: { phase, customerId: customer.id }
        });
        captureCreateTrialException(e, "stripe_subscription_create", data.email ?? "anonymous", {
          user_email: data.email,
          phone_number: data.phone,
          plan_type: data.planType,
        });

        // Always return a response directly for payment errors so the frontend can read
        // result.error/result.message. Throwing causes a 500 where the SDK returns
        // data:null, making the actual Stripe error inaccessible to the frontend.
        const errorResponse = mapStripeErrorToUserError(e, phase, correlationId, request_id);
        const status = ENABLE_STRUCTURED_TRIAL_ERRORS ? 400 : 200;
        return new Response(JSON.stringify(errorResponse), {
          status,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // DATABASE INSERT
    phase = "account_insert";
    console.log(`[${FUNCTION_NAME}] request_id=${request_id} phase=${phase}`);

    const tempPassword = generateSecurePassword();
    const trialEndDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const billingState = data.zipCode ? getStateFromZip(data.zipCode) : "CA";

    let businessHoursValue = null;
    if (data.businessHours) {
      try {
        businessHoursValue = JSON.parse(data.businessHours);
      } catch (err: any) {
        captureCreateTrialException(err, "business_hours_parse", data.email ?? "anonymous", {
          user_email: data.email,
        });
        businessHoursValue = { text: data.businessHours };
      }
    }

    // Normalize plan to new plan_key values; all new signups start on night_weekend
    const legacyPlanMap: Record<string, string> = {
      starter: "night_weekend",
      professional: "core",
      premium: "pro",
    };
    const normalizedPlanKey = legacyPlanMap[data.planType] || data.planType || "night_weekend";

    // Map new plan keys back to legacy plan_type values.
    // plan_type is a legacy column constrained to ('starter','professional','premium').
    // plan_key is the authoritative column for new plan names.
    const newToLegacyPlanMap: Record<string, string> = {
      night_weekend: "starter",
      lite: "starter",
      core: "professional",
      pro: "premium",
    };
    const legacyPlanType = newToLegacyPlanMap[normalizedPlanKey] || data.planType || "starter";

    // Determine post-trial plan from onboarding signals or explicit selection
    const { planKey: selectedPostTrialPlan, reason: preselectReason } = preSelectPostTrialPlan({
      trade: data.trade,
      teamSize: data.teamSize,
      coveragePreference: data.coveragePreference,
      explicit: data.selectedPostTrialPlan,
    });

    const accountData: Record<string, unknown> = {
      company_name: data.companyName,
      trade: data.trade,
      plan_type: legacyPlanType,            // legacy column — always a legacy value to satisfy original constraint
      plan_key: normalizedPlanKey,          // new column
      trial_active: true,                   // marks trial period active
      trial_minutes_used: 0,
      trial_minutes_limit: 50,
      // Call-based billing fields (new trial model)
      billing_call_based: true,
      trial_live_calls_used: 0,
      trial_live_calls_limit: 15,
      verification_calls_used: 0,
      verification_calls_limit: 3,
      selected_post_trial_plan: selectedPostTrialPlan,
      post_trial_plan_preselect_reason: preselectReason,
      onboarding_trade: data.trade,
      onboarding_team_size: data.teamSize || null,
      onboarding_coverage_preference: data.coveragePreference || null,
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

    // ═══════════════════════════════════════════════════════════════
    // MANUAL TRANSACTION: Create User -> Account -> Profile
    // ═══════════════════════════════════════════════════════════════

    // 1. Check if user already exists
    const existingUser = await getExistingUserByEmail(supabase, data.email, correlationId);

    if (existingUser) {
      if (existingUser.hasAccount) {
        // User already has an account - they should log in instead
        logWarn("User already has an account", {
          ...baseLogOptions,
          context: { email: data.email, existingAccountId: existingUser.accountId },
        });
        captureCreateTrialException(new Error("Account already exists for email"), "validation_account_exists", data.email ?? "anonymous", {
          user_email: data.email,
        });

        return new Response(
          JSON.stringify({
            error: "An account with this email already exists. Please log in instead.",
            code: "ACCOUNT_EXISTS",
            redirect: "/login",
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // User exists but has no account - we'll create an account for them
      logInfo("Existing user found without account, creating account", {
        ...baseLogOptions,
        context: { email: data.email, userId: existingUser.id },
      });
      currentUserId = existingUser.id;
    } else {
      // 1b. Create new Auth User
      const { data: userData, error: userError } = await supabase.auth.admin.createUser({
        email: data.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          name: data.name,
          full_name: data.name,
          phone: data.phone,
          company_name: data.companyName,
          trade: data.trade,
          source: data.source,
        }
      });

      if (userError) {
        // Check if this is specifically "user already exists" error
        if (userError.message?.includes("already been registered") ||
          userError.message?.includes("already exists")) {
          // Try to look them up in profiles as a fallback
          const { data: fallbackProfile } = await supabase
            .from("profiles")
            .select("id, account_id")
            .eq("email", data.email)
            .maybeSingle();

          if (fallbackProfile?.account_id) {
            // They have an account - redirect to login
            captureCreateTrialException(new Error("Account already exists for email"), "validation_account_exists", data.email ?? "anonymous", {
              user_email: data.email,
            });
            return new Response(
              JSON.stringify({
                error: "An account with this email already exists. Please log in instead.",
                code: "ACCOUNT_EXISTS",
                redirect: "/login",
              }),
              { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          if (fallbackProfile?.id) {
            // They exist but no account - use their ID
            currentUserId = fallbackProfile.id;
            logInfo("Recovered existing user ID from profile", {
              ...baseLogOptions,
              context: { email: data.email, userId: currentUserId },
            });
	          } else {
	            // Can't recover - create admin alert and return error
	            await createAdminAlert(supabase, "user_creation_failed", {
	              email: data.email,
	              error: userError.message,
	              phase: "user_creation",
	              request_id,
	            });
              captureCreateTrialException(userError, "supabase_create_user", data.email ?? "anonymous", {
                user_email: data.email,
              });
	            throw new Error(`Auth User Creation Failed: ${userError.message}`);
	          }
	        } else {
	          // Different error - throw it
	          await createAdminAlert(supabase, "user_creation_failed", {
	            email: data.email,
	            error: userError.message,
	            phase: "user_creation",
	            request_id,
	          });
            captureCreateTrialException(userError, "supabase_create_user", data.email ?? "anonymous", {
              user_email: data.email,
            });
	          throw new Error(`Auth User Creation Failed: ${userError.message}`);
	        }
      } else {
        currentUserId = userData.user.id;
      }
    }

    // 2. Create Account
    // NOTE: is_test_account field removed from initial insert to prevent errors if column doesn't exist
    // Will be updated after insert if test mode is active
    const { data: accountResult, error: accountError } = await supabase
      .from("accounts")
      .insert({
        subscription_status: 'trial',
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        ...accountData
      })
      .select("id")
      .single();

    if (accountError) {
      captureCreateTrialException(accountError, "supabase_insert_account", currentUserId ?? data.email ?? "anonymous", {
        user_email: data.email,
        plan_type: data.planType,
      });
      // Rollback user if possible, or just throw (manual rollback complex here)
      throw new Error(`Account Insertion Failed: ${accountError.message}`);
    }
    currentAccountId = accountResult.id;

    // 3. Create/Link Profile
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({
        id: currentUserId,
        account_id: currentAccountId,
        email: data.email,
        name: data.name,
        phone: data.phone,
        is_primary: true,
        role: 'customer',
        // onboarding_status removed to fix schema mismatch (column missing in prod)
      });

    if (profileError) {
      captureCreateTrialException(profileError, "supabase_upsert_profile", currentUserId ?? data.email ?? "anonymous", {
        user_email: data.email,
        account_id: currentAccountId,
      });
      throw new Error(`Profile Upsert Failed: ${profileError.message}`);
    }

    // 4. Assign owner role in account_members table (Corrected from user_roles)
    const { error: memberError } = await supabase
      .from("account_members")
      .insert({
        user_id: currentUserId,
        account_id: currentAccountId,
        role: "owner"
      });

    if (memberError) {
      // Log but don't fail - link is critical but we have profile backup
      stepError("link_account_member", baseStepContext(), memberError, {
        accountId: currentAccountId,
      });
      logWarn("Failed to create account_member link", {
        ...baseLogOptions,
        error: memberError,
        accountId: currentAccountId
      });
      captureCreateTrialException(memberError, "supabase_insert_account_member", currentUserId ?? data.email ?? "anonymous", {
        user_email: data.email,
        account_id: currentAccountId,
      });
    }

    // 5. Link Account to User Metadata
    // Merge with existing metadata so we don't clobber keys set during createUser
    // (full_name, phone, etc.) or any auth-level flags set externally.
    const { data: authUserLookup, error: authUserLookupError } = await supabase.auth.admin.getUserById(currentUserId);
    if (authUserLookupError) {
      logWarn("Could not fetch existing user_metadata before update — proceeding with empty base", {
        ...baseLogOptions,
        error: authUserLookupError,
      });
      captureCreateTrialException(authUserLookupError, "supabase_get_auth_user", currentUserId ?? data.email ?? "anonymous", {
        user_email: data.email,
        account_id: currentAccountId,
      });
    }
    const existingUserMetadata =
      authUserLookup?.user?.user_metadata && typeof authUserLookup.user.user_metadata === "object"
        ? authUserLookup.user.user_metadata
        : {};

    await supabase.auth.admin.updateUserById(currentUserId, {
      user_metadata: {
        ...existingUserMetadata,
        name: data.name,
        full_name: data.name,
        phone: data.phone,
        company_name: data.companyName,
        trade: data.trade,
        source: data.source,
        account_id: currentAccountId,
        account_created_at: new Date().toISOString(),
      }
    });

    // Unified result object for downstream logging
    const accountTxResult = {
      account_id: currentAccountId,
      user_id: currentUserId
    };

    // accountTxError is already handled above (throws Error)
    const accountTxError = null;

    stepEnd("create_account_transaction", baseStepContext(), {
      operation: "after_call",
      hasError: false,
      hasData: true,
      result: accountTxResult,
    }, Date.now());

    // (Removed old error handling block as it is now redundant)

    currentAccountId = accountTxResult.account_id;
    currentUserId = accountTxResult.user_id;

    logInfo("Account created atomically", {
      ...baseLogOptions,
      accountId: currentAccountId,
      context: {
        source: data.source
      },
    });

    // ═══════════════════════════════════════════════════════════════
    // CALL-BASED TRIAL: Verification allowlist + trial_usage_summary
    // ═══════════════════════════════════════════════════════════════

    phase = "trial_call_setup";
    console.log(`[${FUNCTION_NAME}] request_id=${request_id} phase=${phase}`);

    // Seed verification allowlist with the owner's phone number so their calls
    // from this number are classified as non-billable verification calls.
    try {
      const { error: allowlistError } = await supabase
        .from("verification_call_allowlist")
        .insert({
          account_id: currentAccountId,
          phone_number: data.phone,
          label: "owner",
          added_by: currentUserId,
        });
      if (allowlistError) {
        logWarn("Failed to seed verification allowlist (non-critical)", {
          ...baseLogOptions,
          accountId: currentAccountId,
          error: allowlistError,
        });
        captureCreateTrialException(allowlistError, "verification_allowlist_seed", currentUserId ?? data.email ?? "anonymous", {
          account_id: currentAccountId,
        });
      }
    } catch (err: any) {
      logWarn("Verification allowlist seed error (non-critical)", { ...baseLogOptions, error: err });
      captureCreateTrialException(err, "verification_allowlist_seed", currentUserId ?? data.email ?? "anonymous", {
        account_id: currentAccountId,
      });
    }

    // Create trial_usage_summary row to track trial metrics
    try {
      const trialStartDate = new Date().toISOString();
      const { error: summaryError } = await supabase
        .from("trial_usage_summary")
        .insert({
          account_id: currentAccountId,
          trial_start: trialStartDate,
          trial_end: trialEndDate,
          selected_post_trial_plan: selectedPostTrialPlan,
          live_trial_calls_limit: 15,
          verification_calls_limit: 3,
          live_trial_calls_used: 0,
          verification_calls_used: 0,
        });
      if (summaryError) {
        logWarn("Failed to create trial_usage_summary (non-critical)", {
          ...baseLogOptions,
          accountId: currentAccountId,
          error: summaryError,
        });
        captureCreateTrialException(summaryError, "trial_usage_summary_insert", currentUserId ?? data.email ?? "anonymous", {
          account_id: currentAccountId,
        });
      }
    } catch (err: any) {
      logWarn("trial_usage_summary insert error (non-critical)", { ...baseLogOptions, error: err });
      captureCreateTrialException(err, "trial_usage_summary_insert", currentUserId ?? data.email ?? "anonymous", {
        account_id: currentAccountId,
      });
    }

    // PostHog: trial_started + trial_plan_preselected (best-effort, fire-and-forget)
    capturePostHogEvent("trial_started", currentUserId ?? data.email ?? "anonymous", {
      plan_type: normalizedPlanKey,
      source: data.source ?? "website",
      account_id: currentAccountId,
      billing_call_based: true,
      trial_live_calls_limit: 15,
      selected_post_trial_plan: selectedPostTrialPlan,
      $lib: "edge-function",
    });
    capturePostHogEvent("trial_plan_preselected", currentUserId ?? data.email ?? "anonymous", {
      selected_plan: selectedPostTrialPlan,
      preselect_reason: preselectReason,
      account_id: currentAccountId,
      trade: data.trade,
      team_size: data.teamSize ?? null,
      coverage_preference: data.coveragePreference ?? null,
      explicit_selection: !!data.selectedPostTrialPlan,
      $lib: "edge-function",
    });

    // ═══════════════════════════════════════════════════════════════
    // LINK LEAD (if provided)
    // ═══════════════════════════════════════════════════════════════

    phase = "lead_link";
    console.log(`[${FUNCTION_NAME}] request_id=${request_id} phase=${phase}`);

    if (data.leadId) {
      const leadLinkStart = Date.now();

      stepStart("link_lead", baseStepContext(), {
        operation: "before_update",
        table: "signup_leads",
        auth_user_id: currentUserId,
        account_id: currentAccountId,
        profile_id: currentUserId,
        leadId: data.leadId,
      });

      try {
        const { error: leadLinkError } = await supabase
          .from("signup_leads")
          .update({
            auth_user_id: currentUserId,
            account_id: currentAccountId,
            profile_id: currentUserId,
            completed_at: new Date().toISOString(),
          })
          .eq("id", data.leadId);

        stepEnd("link_lead", baseStepContext(), {
          operation: "after_update",
          table: "signup_leads",
          hasError: !!leadLinkError,
          errorCode: leadLinkError?.code ?? null,
        }, leadLinkStart);

        if (leadLinkError) {
          console.log("[create-trial] Lead linking failed (non-critical)", {
            error: leadLinkError.message,
          });
          logWarn("Lead linking failed (non-critical)", {
            ...baseLogOptions,
            accountId: currentAccountId,
            error: leadLinkError,
          });
          captureCreateTrialException(leadLinkError, "supabase_update_lead_link", currentUserId ?? data.email ?? "anonymous", {
            user_email: data.email,
            account_id: currentAccountId,
            lead_id: data.leadId,
          });
        }
      } catch (err: any) {
        stepError("lead_link", baseStepContext(), err, { phase: "lead_link" });
        logWarn("Lead linking error (non-critical)", { ...baseLogOptions, error: err });
        captureCreateTrialException(err, "supabase_update_lead_link", currentUserId ?? data.email ?? "anonymous", {
          user_email: data.email,
          account_id: currentAccountId,
          lead_id: data.leadId,
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // LOG SIGNUP SUCCESS
    // ═══════════════════════════════════════════════════════════════

    if (data.source === "website") {
      const clientIP =
        req.headers.get("x-forwarded-for")?.split(",")[0] ||
        req.headers.get("cf-connecting-ip") ||
        "unknown";

      const signupAttemptStart = Date.now();
      stepStart("log_signup_success", baseStepContext(), {
        operation: "before_insert",
        table: "signup_attempts",
        email: maskEmailForLogs(data.email),
        phone: maskPhoneForLogs(data.phone),
        ip_address: clientIP,
        has_device_fingerprint: !!data.deviceFingerprint,
        success: true,
      });

      try {
        const { error: signupAttemptError } = await supabase.from("signup_attempts").insert({
          email: data.email,
          phone: data.phone,
          ip_address: clientIP,
          device_fingerprint: data.deviceFingerprint,
          success: true,
        });

        stepEnd("log_signup_success", baseStepContext(), {
          table: "signup_attempts",
          hasError: !!signupAttemptError,
          errorCode: signupAttemptError?.code ?? null,
        }, signupAttemptStart);
      } catch (err: any) {
        stepError("log_signup_success", baseStepContext(), err, {
          phase: "log_signup_success",
        });
        logWarn("Signup attempt logging error (non-critical)", { ...baseLogOptions, error: err });
        captureCreateTrialException(err, "supabase_insert_signup_attempt", currentUserId ?? data.email ?? "anonymous", {
          user_email: data.email,
          account_id: currentAccountId,
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // ENQUEUE ASYNC PROVISIONING JOB
    // ═══════════════════════════════════════════════════════════════

    phase = "vapi_provision_start";
    console.log(`[${FUNCTION_NAME}] request_id=${request_id} phase=${phase}`);

    // Check for VAPI kill switch
    const disableVapiProvisioning = Deno.env.get("DISABLE_VAPI_PROVISIONING") === "true";
    let jobError: any = null;

    if (disableVapiProvisioning) {
      console.log(`[${FUNCTION_NAME}] request_id=${request_id} phase=vapi_skipped (DISABLE_VAPI_PROVISIONING=true)`);
      logInfo("VAPI provisioning disabled by env var", {
        ...baseLogOptions,
        accountId: currentAccountId,
      });
    } else if (isTestMode) {
      // ═══════════════════════════════════════════════════════════════
      // TEST MODE: Shared Demo Bundle - NO Twilio/Vapi API calls
      // Uses pre-provisioned real resources and mirrors LIVE DB structure
      // ═══════════════════════════════════════════════════════════════
      console.log(`[${FUNCTION_NAME}] request_id=${request_id} phase=test_mode_demo_bundle`);

      // Load demo bundle environment variables
      const demoTwilioNumber = Deno.env.get("RINGSNAP_DEMO_TWILIO_NUMBER");
      const demoTwilioPhoneSid = Deno.env.get("RINGSNAP_DEMO_TWILIO_PHONE_SID");
      const demoVapiPhoneId = Deno.env.get("RINGSNAP_DEMO_VAPI_PHONE_ID");
      const demoVapiAssistantId = Deno.env.get("RINGSNAP_DEMO_VAPI_ASSISTANT_ID");
      const allowFallback = Deno.env.get("RINGSNAP_ALLOW_DEMO_FALLBACK") === "true";

      // Validate all demo bundle env vars are present
      const hasMissingVars = !demoTwilioNumber || !demoTwilioPhoneSid || !demoVapiPhoneId || !demoVapiAssistantId;

      if (hasMissingVars) {
        const missing = [];
        if (!demoTwilioNumber) missing.push("RINGSNAP_DEMO_TWILIO_NUMBER");
        if (!demoTwilioPhoneSid) missing.push("RINGSNAP_DEMO_TWILIO_PHONE_SID");
        if (!demoVapiPhoneId) missing.push("RINGSNAP_DEMO_VAPI_PHONE_ID");
        if (!demoVapiAssistantId) missing.push("RINGSNAP_DEMO_VAPI_ASSISTANT_ID");

        const errorMsg = `TEST MODE ERROR: Missing demo bundle env vars: ${missing.join(", ")}`;
        stepError("demo_bundle_env_validation", baseStepContext(), new Error(errorMsg), {
          phase: "demo_bundle_env_validation",
        });
        logError(errorMsg, { ...baseLogOptions, accountId: currentAccountId });

        // Only allow fallback if explicitly enabled via env var (for local dev only)
        if (!allowFallback) {
          throw new Error(
            `Demo bundle not configured. Set the following Supabase secrets: ${missing.join(", ")}. ` +
            `Or set RINGSNAP_ALLOW_DEMO_FALLBACK=true to use mock values (not recommended for production).`
          );
        }

        console.log(`[${FUNCTION_NAME}] RINGSNAP_ALLOW_DEMO_FALLBACK=true - using mock values (LOCAL DEV ONLY)`);
      }

      // Use demo bundle values (or fallback if explicitly allowed)
      const phoneNumber = demoTwilioNumber || "+15005550006";
      const twilioPhoneSid = demoTwilioPhoneSid || `PN_test_${Date.now()}`;
      const vapiPhoneId = demoVapiPhoneId || `vapi_phone_test_${Date.now()}`;
      const vapiAssistantId = demoVapiAssistantId || `vapi_assistant_test_${Date.now()}`;
      const areaCode = phoneNumber.slice(2, 5); // Extract area code from E.164

      logInfo("TEST MODE: Using shared demo bundle", {
        ...baseLogOptions,
        accountId: currentAccountId,
        context: {
          zipCode: data.zipCode,
          demoPhoneNumber: phoneNumber,
          hasDemoBundle: !hasMissingVars,
          usingFallback: hasMissingVars && allowFallback,
        },
      });

      try {
        // ══════════════════════════════════════════════════════════════
        // Mirror LIVE success path: Create all required DB records
        // ══════════════════════════════════════════════════════════════

        // 1. Insert phone_numbers row (mirrors LIVE: provision-vapi line 426-437)
        const { error: phoneError } = await supabase.from("phone_numbers").insert({
          account_id: currentAccountId,
          phone_number: phoneNumber,
          area_code: areaCode,
          vapi_phone_id: vapiPhoneId,
          purpose: "primary",
          status: "active",
          is_primary: true,
          // is_test_number: true, // Add once migration is applied
        });

        if (phoneError) {
          logWarn("TEST MODE: Phone number insert error (may already exist)", {
            ...baseLogOptions,
            error: phoneError,
          });
          captureCreateTrialException(phoneError, "twilio_provision", currentUserId ?? data.email ?? "anonymous", {
            user_email: data.email,
            account_id: currentAccountId,
          });
        }

        // 2. Insert vapi_assistants row (mirrors LIVE: provision-vapi line 220-227)
        const { error: assistantError } = await supabase.from("vapi_assistants").insert({
          account_id: currentAccountId,
          vapi_assistant_id: vapiAssistantId,
          config: {
            id: vapiAssistantId,
            name: "Demo Assistant",
            description: "Shared demo assistant for test accounts",
            isTestAssistant: true,
          },
          // is_test_assistant: true, // Add once migration is applied
        });

        if (assistantError) {
          logWarn("TEST MODE: Assistant insert error (may already exist)", {
            ...baseLogOptions,
            error: assistantError,
          });
          captureCreateTrialException(assistantError, "vapi_setup", currentUserId ?? data.email ?? "anonymous", {
            user_email: data.email,
            account_id: currentAccountId,
          });
        }

        // 3. Update accounts row (mirrors LIVE: provision-vapi line 622-629)
        await supabase.from("accounts").update({
          vapi_assistant_id: vapiAssistantId,
          vapi_phone_number: phoneNumber,
          phone_number_e164: phoneNumber,
          vapi_phone_number_id: vapiPhoneId,
          phone_number_status: "active",
          phone_provisioned_at: new Date().toISOString(),
          // billing_test_mode: true, // Add once migration is applied
        }).eq("id", currentAccountId);

        // 4. Mark provisioning as completed via RPC (mirrors LIVE: provision-vapi line 632-635)
        await supabase.rpc("update_provisioning_lifecycle", {
          p_account_id: currentAccountId,
          p_status: "completed",
        });

        // 5. Update profile to active (mirrors LIVE: provision-vapi line 639-641)
        if (currentUserId) {
          await supabase.from("profiles").update({
            onboarding_status: "active",
          }).eq("id", currentUserId);
        }

        logInfo("TEST MODE: Demo bundle provisioning completed successfully", {
          ...baseLogOptions,
          accountId: currentAccountId,
          context: {
            phoneNumber,
            vapiAssistantId,
            vapiPhoneId,
          },
        });
        console.log(`[${FUNCTION_NAME}] TEST MODE: Demo bundle complete for account ${currentAccountId}`);

      } catch (testErr: any) {
        logError("TEST MODE: Demo bundle provisioning failed", {
          ...baseLogOptions,
          accountId: currentAccountId,
          error: testErr,
        });
        captureCreateTrialException(testErr, "test_mode_provisioning", currentUserId ?? data.email ?? "anonymous", {
          user_email: data.email,
          account_id: currentAccountId,
        });
        // Non-critical - signup still succeeded, user can retry
      }
    } else {
      // ═══════════════════════════════════════════════════════════════
      // LIVE MODE: Real provisioning via job queue
      // ═══════════════════════════════════════════════════════════════
      // ... metadata build ...

      const enqueueProvisioningStart = Date.now();
      stepStart("enqueue_provisioning", baseStepContext(), {
        operation: "before_insert",
        table: "provisioning_jobs",
        account_id: currentAccountId,
        user_id: currentUserId,
        status: "queued",
      });

      try {
        // Assign to outer var - Do not redeclare const
        // NOTE: test_mode field removed to prevent crash if column doesn't exist in DB
        const baseProvisioningJobInsert = {
          account_id: currentAccountId,
          user_id: currentUserId,
          status: "queued",
        };

        // Prefer explicit job_type for critical guardrails/invariants.
        // Fallback keeps backward compatibility if a stale environment is missing this column.
        let { error } = await supabase.from("provisioning_jobs").insert({
          ...baseProvisioningJobInsert,
          job_type: "provision_phone",
        });

        if (error && /job_type|column/i.test(error.message || "")) {
          stepError("enqueue_provisioning_with_job_type", baseStepContext(), error, {
            phase: "vapi_provision_start",
            fallback: "retry_without_job_type",
          });

          const fallbackResult = await supabase
            .from("provisioning_jobs")
            .insert(baseProvisioningJobInsert);
          error = fallbackResult.error;
        }

        jobError = error;

        stepEnd("enqueue_provisioning", baseStepContext(), {
          table: "provisioning_jobs",
          hasError: !!jobError,
          errorCode: jobError?.code ?? null,
        }, enqueueProvisioningStart);

        if (jobError) {
          logError("Failed to enqueue provisioning job (non-critical)", {
            ...baseLogOptions,
            accountId: currentAccountId,
            error: jobError,
          });
          captureCreateTrialException(jobError, "vapi_setup", currentUserId ?? data.email ?? "anonymous", {
            user_email: data.email,
            account_id: currentAccountId,
          });

          // Create admin alert for failed job enqueue
          await createAdminAlert(supabase, "provisioning_job_enqueue_failed", {
            email: data.email,
            error: jobError.message || "Unknown error",
            phase: "job_enqueue",
            request_id,
          }, currentAccountId);
        } else {
          logInfo("Provisioning job enqueued", {
            ...baseLogOptions,
            accountId: currentAccountId,
          });

          // FIRE-AND-FORGET: Provision Vapi
          supabase.functions.invoke("provision-vapi", {
            body: { triggered_by: "create-trial" }
          }).catch(err => {
            stepError("trigger_provision_vapi_background", baseStepContext(), err, {
              phase: "vapi_provision_start",
            });
            captureCreateTrialException(err, "vapi_setup_background_invoke", currentUserId ?? data.email ?? "anonymous", {
              user_email: data.email,
              account_id: currentAccountId,
            });
          });

          // FIRE-AND-FORGET: Send Welcome Email
          supabase.functions.invoke("send-welcome-email", {
            body: {
              email: data.email,
              name: data.name,
              userId: currentUserId
            }
          }).catch(err => {
            stepError("trigger_send_welcome_email_background", baseStepContext(), err, {
              phase: "vapi_provision_start",
              email: maskEmailForLogs(data.email),
            });
            captureCreateTrialException(err, "welcome_email_background_invoke", currentUserId ?? data.email ?? "anonymous", {
              user_email: data.email,
              account_id: currentAccountId,
            });
          });

          // FIRE-AND-FORGET: Admin signup notification (email + Slack)
          sendSignupNotifications({
            email: data.email,
            name: data.name,
            companyName: data.companyName,
            phone: data.phone,
            trade: data.trade,
            planType: data.planType,
            source: data.source,
            accountId: currentAccountId,
            userId: currentUserId,
          }).catch(err => {
            stepError("admin_signup_notifications_background", baseStepContext(), err, {
              phase: "background_notification",
            });
            captureCreateTrialException(err, "signup_notifications_background", currentUserId ?? data.email ?? "anonymous", {
              user_email: data.email,
              account_id: currentAccountId,
            });
          });
        }
      } catch (err: any) {
        stepError("vapi_provision_start", baseStepContext(), err, { phase: "vapi_provision_start" });
        logWarn("Provisioning job enqueue error (non-critical)", { ...baseLogOptions, error: err });
        captureCreateTrialException(err, "vapi_setup", currentUserId ?? data.email ?? "anonymous", {
          user_email: data.email,
          account_id: currentAccountId,
        });

        // Create admin alert for exception during job enqueue
        await createAdminAlert(supabase, "provisioning_job_exception", {
          email: data.email,
          error: err?.message || "Unknown error",
          phase: "job_enqueue",
          request_id,
        }, currentAccountId);
      }
    }

    phase = "done";
    console.log(`[${FUNCTION_NAME}] request_id=${request_id} phase=${phase}`);

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
      try {
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
      } catch (err: any) {
        stepError("idempotency_cache", baseStepContext(), err, { phase: "idempotency_cache" });
        logWarn("Idempotency cache error (non-critical)", { ...baseLogOptions, error: err });
        captureCreateTrialException(err, "idempotency_cache", currentUserId ?? attemptedSignupData.email ?? "anonymous", {
          account_id: currentAccountId,
        });
      }
    }

    console.log("[create-trial] Completed successfully", { accountId: currentAccountId });

    // PostHog server-side conversion event — fire-and-forget
    capturePostHogEvent('trial_created', currentUserId ?? data.email ?? 'anonymous', {
      plan_type: data.planType,
      source: data.source ?? 'website',
      account_id: currentAccountId,
      subscription_id: subscription.id,
      $lib: 'edge-function',
    });

    return new Response(
      JSON.stringify(successResponse),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    // Top-level error handler
    stepError("trial_creation", baseStepContext(), error, {
      phase,
      request_id,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
    });

    logError("Trial creation failed", {
      ...baseLogOptions,
      accountId: currentAccountId,
      error,
      context: { phase },
    });

    // Send error to Sentry
    if (currentAccountId) {
      setContext('accountId', currentAccountId);
    }
    if (currentUserId) {
      setContext('userId', currentUserId);
    }
    await captureError(error, { phase, stripeErrorType: (error as any)?.type || 'unknown' });

    // PostHog error tracking — fire-and-forget
    const _phDistinctId = currentUserId ?? attemptedSignupData.email ?? 'anonymous';
    capturePostHogEvent('signup_failed', _phDistinctId, {
      error_message: error?.message ?? String(error),
      error_source: 'create_trial',
      step: 'create_trial',
    });
    captureCreateTrialException(error, "top_level_catch", _phDistinctId, {
      phase,
      account_id: currentAccountId,
      user_email: attemptedSignupData.email,
    });

    // FIRE-AND-FORGET: Admin signup failure notification (email + Slack)
    sendSignupFailureNotifications({
      ...attemptedSignupData,
      phase,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      correlationId,
      requestId: request_id,
    }).catch((err) => {
      stepError("admin_signup_failure_notifications_background", baseStepContext(), err, {
        phase: "background_failure_notification",
      });
      captureCreateTrialException(err, "signup_failure_notifications_background", _phDistinctId, {
        phase,
      });
    });

    // Track failure in Analytics (Critical for Dashboard visibility)
    // We try to access 'data' if it was parsed, otherwise we lose the email.
    // Since 'data' is scoped to the try block, we can't access it here directly if not lifted.
    // However, most failures happen after parsing. 
    // TODO: Ideally we retrieve email from a wider scope variable. 
    // For now, we will track what we have.
    await trackEvent(supabase, currentAccountId, currentUserId, 'trial_creation_failed', {
      error: error instanceof Error ? error.message : "Unknown error",
      phase: phase,
      stripeErrorType: (error as any)?.type || 'unknown',
      // In a real refactor we would lift 'email' to outer scope. 
      // For this specific 'catch', we might be limited.
      // But wait, we can log the event without email if needed.
    }, correlationId);

    const errorMessage = error instanceof Error ? error.message : "Internal server error";

    // Return structured error if flag enabled
    if (ENABLE_STRUCTURED_TRIAL_ERRORS) {
      const errorResponse: TrialCreationErrorResponse = {
        success: false,
        errorCode: 'INTERNAL_ERROR',
        userMessage: 'We hit a snag while creating your trial. Please try again in a moment.',
        debugMessage: error?.message ?? errorMessage,
        correlationId,
        phase,
        retryable: true,
        suggestedAction: 'Try again or contact support if the issue persists',
        // Legacy fields
        error: error?.message ?? errorMessage,
        message: String(error?.message ?? errorMessage),
        request_id
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } else {
      // Legacy behavior - return existing error format
      return new Response(
        JSON.stringify({
          success: false,
          request_id,
          phase,
          message: String(error?.message ?? errorMessage),
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  }
  } finally {
    await flushPostHogClient();
  }
});
