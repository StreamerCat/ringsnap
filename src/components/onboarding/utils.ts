/**
 * Utility Functions for Trial Onboarding Flows
 * Shared helpers used across self-serve and sales-guided flows
 */

import type { PlanType, AssistantGender } from "./types";

/**
 * Format phone number to E.164 format (+1XXXXXXXXXX)
 * Handles various input formats
 */
export function formatPhoneE164(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");

  // If 10 digits, assume US and add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // If 11 digits starting with 1, add +
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  // If already has +, return as is
  if (phone.startsWith("+")) {
    return phone;
  }

  // Default: add + and hope for the best
  return `+${digits}`;
}

/**
 * Format phone number for display (XXX) XXX-XXXX
 */
export function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  // Handle 10-digit US numbers
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  // Handle 11-digit numbers (1 + 10 digits)
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  // Return original if can't format
  return phone;
}

/**
 * Extract digits for call forwarding (*72)
 * Removes +1 prefix and formats for carrier forwarding codes
 */
export function getForwardingDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  // Remove leading 1 if present
  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }

  return digits;
}

/**
 * Validate email format (basic)
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate ZIP code (US 5-digit)
 */
export function isValidZipCode(zip: string): boolean {
  return /^\d{5}$/.test(zip);
}

/**
 * Get plan price by plan type
 */
export function getPlanPrice(planType: PlanType): number {
  const prices: Record<PlanType, number> = {
    starter: 297,
    professional: 497,
    premium: 797,
  };
  return prices[planType];
}

/**
 * Get plan name by plan type
 */
export function getPlanName(planType: PlanType): string {
  const names: Record<PlanType, string> = {
    starter: "Starter",
    professional: "Professional",
    premium: "Premium",
  };
  return names[planType];
}

/**
 * Get Stripe price ID by plan type
 * TODO: Update with actual Stripe price IDs from environment
 */
export function getStripePriceId(planType: PlanType): string {
  const priceIds: Record<PlanType, string> = {
    starter: import.meta.env.VITE_STRIPE_PRICE_STARTER_OLD || "price_starter",
    professional:
      import.meta.env.VITE_STRIPE_PRICE_PROFESSIONAL_OLD || "price_professional",
    premium: import.meta.env.VITE_STRIPE_PRICE_PREMIUM_OLD || "price_premium",
  };
  return priceIds[planType];
}

/**
 * Get voice label
 */
export function getVoiceLabel(gender: AssistantGender): string {
  return gender === "male" ? "Male Voice" : "Female Voice";
}

/**
 * Calculate trial end date (3 days from now)
 */
export function getTrialEndDate(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 3);
  return date;
}

/**
 * Format date for display
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

/**
 * Sleep utility for async operations
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sanitize business name for Vapi assistant name
 * Removes special characters, limits length
 */
export function sanitizeBusinessName(name: string): string {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9\s-]/g, "") // Remove special chars
    .slice(0, 50) // Limit length
    .trim();
}

/**
 * Generate AI assistant display name
 */
export function generateAssistantName(
  companyName: string,
  gender: AssistantGender
): string {
  const sanitized = sanitizeBusinessName(companyName);
  const genderLabel = gender === "male" ? "Male" : "Female";
  return `${sanitized} AI Receptionist (${genderLabel})`;
}

/**
 * Check if provisioning is complete
 */
export function isProvisioningComplete(status: string): boolean {
  return status === "active";
}

/**
 * Check if provisioning failed
 */
export function isProvisioningFailed(status: string): boolean {
  return status === "failed";
}

/**
 * Check if provisioning is in progress
 */
export function isProvisioningInProgress(status: string): boolean {
  return status === "pending" || status === "provisioning";
}

/**
 * Get error message for common signup errors
 */
export function getSignupErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "An unexpected error occurred. Please try again.";
}

/**
 * Debounce function for form validation
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}
