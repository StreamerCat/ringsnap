/**
 * Email Service for Customer Onboarding
 *
 * Handles automated email delivery for signup flows:
 * - Self-service: Magic link for password setup
 * - Sales-guided: Magic link with custom welcome message
 * - Enterprise: Custom onboarding emails
 *
 * Uses Supabase Auth for magic link generation.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ==============================================================================
// Types
// ==============================================================================

export type SignupChannel = "self_service" | "sales_guided" | "enterprise";

export interface SendWelcomeEmailParams {
  email: string;
  name: string;
  companyName: string;
  signupChannel: SignupChannel;
  salesRepName?: string;
  correlationId: string;
}

export interface MagicLinkEmailParams {
  email: string;
  redirectTo?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ==============================================================================
// Magic Link Email (Primary Method for Password Setup)
// ==============================================================================

/**
 * Send magic link email for password setup
 *
 * This replaces manual password handoff. User clicks link to set their own password.
 *
 * @param supabase - Supabase client with admin privileges
 * @param params - Email parameters
 * @returns Result with success status
 */
export async function sendMagicLinkEmail(
  supabase: ReturnType<typeof createClient>,
  params: MagicLinkEmailParams
): Promise<EmailResult> {
  try {
    const { data, error } = await supabase.auth.signInWithOtp({
      email: params.email,
      options: {
        emailRedirectTo: params.redirectTo || `${Deno.env.get("PUBLIC_APP_URL")}/auth/callback`,
        shouldCreateUser: false, // User already created by create_account_transaction()
      },
    });

    if (error) {
      console.error("[email-service] Magic link send failed:", error);
      return {
        success: false,
        error: error.message,
      };
    }

    console.log(`[email-service] Magic link sent to ${params.email}`);
    return {
      success: true,
      messageId: data?.messageId,
    };
  } catch (err) {
    console.error("[email-service] Unexpected error sending magic link:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ==============================================================================
// Welcome Email (Custom Templates by Channel)
// ==============================================================================

/**
 * Send welcome email with magic link based on signup channel
 *
 * Templates:
 * - Self-service: Standard welcome with quick start guide
 * - Sales-guided: Personalized welcome from sales rep
 * - Enterprise: Custom onboarding with account manager details
 *
 * @param supabase - Supabase client
 * @param params - Welcome email parameters
 * @returns Result with success status
 */
export async function sendWelcomeEmail(
  supabase: ReturnType<typeof createClient>,
  params: SendWelcomeEmailParams
): Promise<EmailResult> {
  try {
    // Step 1: Send magic link for password setup
    const magicLinkResult = await sendMagicLinkEmail(supabase, {
      email: params.email,
      redirectTo: getRedirectUrlForChannel(params.signupChannel),
    });

    if (!magicLinkResult.success) {
      return magicLinkResult;
    }

    // Step 2: Send custom welcome email (if using external email service)
    // For now, Supabase Auth handles the email with magic link
    // Future: Add custom HTML email templates via SendGrid/Postmark

    console.log(
      `[email-service] Welcome email sent to ${params.email} (channel: ${params.signupChannel}, correlation: ${params.correlationId})`
    );

    return {
      success: true,
      messageId: magicLinkResult.messageId,
    };
  } catch (err) {
    console.error("[email-service] Error sending welcome email:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ==============================================================================
// Email Template Helpers
// ==============================================================================

/**
 * Get redirect URL based on signup channel
 */
function getRedirectUrlForChannel(channel: SignupChannel): string {
  const baseUrl = Deno.env.get("PUBLIC_APP_URL") || "https://app.ringsnap.com";

  switch (channel) {
    case "self_service":
      return `${baseUrl}/onboarding/welcome`;
    case "sales_guided":
      return `${baseUrl}/onboarding/sales-guided`;
    case "enterprise":
      return `${baseUrl}/onboarding/enterprise`;
    default:
      return `${baseUrl}/auth/callback`;
  }
}

/**
 * Get email template for channel (future: custom HTML templates)
 */
export function getEmailTemplate(channel: SignupChannel): {
  subject: string;
  preheader: string;
} {
  switch (channel) {
    case "self_service":
      return {
        subject: "Welcome to RingSnap - Set Up Your Account",
        preheader: "Click the link below to set your password and get started",
      };
    case "sales_guided":
      return {
        subject: "Your RingSnap Account is Ready",
        preheader: "Your sales rep has set up your account - click to complete setup",
      };
    case "enterprise":
      return {
        subject: "Welcome to RingSnap Enterprise",
        preheader: "Your enterprise account is ready - complete your setup",
      };
    default:
      return {
        subject: "Welcome to RingSnap",
        preheader: "Get started with your new account",
      };
  }
}

// ==============================================================================
// Email Status Tracking
// ==============================================================================

/**
 * Log email delivery status to database
 *
 * Useful for debugging and customer support.
 *
 * @param supabase - Supabase client
 * @param params - Logging parameters
 */
export async function logEmailDelivery(
  supabase: ReturnType<typeof createClient>,
  params: {
    accountId: string;
    email: string;
    emailType: "magic_link" | "welcome" | "onboarding";
    status: "sent" | "failed";
    correlationId: string;
    error?: string;
  }
): Promise<void> {
  try {
    // Future: Create email_delivery_log table for tracking
    // For now, just log to console
    console.log(
      `[email-service] Email delivery: ${params.emailType} to ${params.email} - ${params.status} (correlation: ${params.correlationId})`
    );

    if (params.error) {
      console.error(`[email-service] Error: ${params.error}`);
    }
  } catch (err) {
    console.error("[email-service] Failed to log email delivery:", err);
  }
}

// ==============================================================================
// Retry Logic for Failed Emails
// ==============================================================================

/**
 * Retry failed email with exponential backoff
 *
 * @param fn - Email function to retry
 * @param maxRetries - Maximum number of retry attempts
 * @param baseDelayMs - Base delay in milliseconds
 * @returns Result from email function
 */
export async function retryEmail<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < maxRetries) {
        const delayMs = baseDelayMs * Math.pow(2, attempt);
        console.log(
          `[email-service] Retry attempt ${attempt + 1}/${maxRetries} after ${delayMs}ms`
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError || new Error("Retry failed");
}

// ==============================================================================
// Self-Service Onboarding Email Flow
// ==============================================================================

/**
 * Complete email flow for self-service signup
 *
 * 1. Send magic link for password setup
 * 2. Log state transition: stripe_linked → email_sent
 * 3. Track delivery status
 *
 * @param supabase - Supabase client
 * @param params - Email flow parameters
 * @returns Result with success status
 */
export async function sendSelfServiceOnboardingEmail(
  supabase: ReturnType<typeof createClient>,
  params: {
    accountId: string;
    email: string;
    name: string;
    companyName: string;
    correlationId: string;
  }
): Promise<EmailResult> {
  try {
    // Send welcome email with magic link
    const result = await retryEmail(
      () =>
        sendWelcomeEmail(supabase, {
          email: params.email,
          name: params.name,
          companyName: params.companyName,
          signupChannel: "self_service",
          correlationId: params.correlationId,
        }),
      3,
      2000
    );

    if (!result.success) {
      await logEmailDelivery(supabase, {
        accountId: params.accountId,
        email: params.email,
        emailType: "magic_link",
        status: "failed",
        correlationId: params.correlationId,
        error: result.error,
      });

      return result;
    }

    // Log state transition: stripe_linked → email_sent
    await supabase.rpc("log_state_transition", {
      p_account_id: params.accountId,
      p_from_stage: "stripe_linked",
      p_to_stage: "email_sent",
      p_triggered_by: "email-service",
      p_correlation_id: params.correlationId,
      p_metadata: {
        email: params.email,
        message_id: result.messageId,
      },
    });

    // Log delivery success
    await logEmailDelivery(supabase, {
      accountId: params.accountId,
      email: params.email,
      emailType: "magic_link",
      status: "sent",
      correlationId: params.correlationId,
    });

    return result;
  } catch (err) {
    console.error("[email-service] Self-service onboarding email failed:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ==============================================================================
// Sales-Guided Onboarding Email Flow
// ==============================================================================

/**
 * Complete email flow for sales-guided signup
 *
 * Similar to self-service but includes sales rep context.
 *
 * @param supabase - Supabase client
 * @param params - Email flow parameters
 * @returns Result with success status
 */
export async function sendSalesGuidedOnboardingEmail(
  supabase: ReturnType<typeof createClient>,
  params: {
    accountId: string;
    email: string;
    name: string;
    companyName: string;
    salesRepName: string;
    correlationId: string;
  }
): Promise<EmailResult> {
  try {
    const result = await retryEmail(
      () =>
        sendWelcomeEmail(supabase, {
          email: params.email,
          name: params.name,
          companyName: params.companyName,
          signupChannel: "sales_guided",
          salesRepName: params.salesRepName,
          correlationId: params.correlationId,
        }),
      3,
      2000
    );

    if (!result.success) {
      await logEmailDelivery(supabase, {
        accountId: params.accountId,
        email: params.email,
        emailType: "magic_link",
        status: "failed",
        correlationId: params.correlationId,
        error: result.error,
      });

      return result;
    }

    // Log state transition
    await supabase.rpc("log_state_transition", {
      p_account_id: params.accountId,
      p_from_stage: "stripe_linked",
      p_to_stage: "email_sent",
      p_triggered_by: "email-service",
      p_correlation_id: params.correlationId,
      p_metadata: {
        email: params.email,
        sales_rep_name: params.salesRepName,
        message_id: result.messageId,
      },
    });

    await logEmailDelivery(supabase, {
      accountId: params.accountId,
      email: params.email,
      emailType: "magic_link",
      status: "sent",
      correlationId: params.correlationId,
    });

    return result;
  } catch (err) {
    console.error("[email-service] Sales-guided onboarding email failed:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
