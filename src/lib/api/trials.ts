/**
 * Trial Creation API Helper
 *
 * Provides a typed interface for calling the create-trial Edge Function.
 * Used in Step 2 of the two-step signup flow after chat onboarding.
 */

import { supabase } from '@/lib/supabase';

export interface CreateTrialPayload {
  // Required user info
  name: string;
  email: string;
  phone: string;

  // Required business info
  companyName: string;
  trade: string;

  // Optional business info
  website?: string;
  serviceArea?: string;
  zipCode?: string;
  businessHours?: string; // JSON string of hours object

  // AI configuration
  assistantGender?: 'male' | 'female';
  primaryGoal?: 'book_appointments' | 'capture_leads' | 'answer_questions' | 'take_orders';
  wantsAdvancedVoice?: boolean;

  // Plan & payment
  planType: 'starter' | 'professional' | 'premium';
  paymentMethodId: string;

  // Source tracking
  source?: 'website' | 'sales';
  salesRepName?: string;

  // Optional: Link to existing lead (from Step 1)
  leadId?: string;

  // Optional metadata
  referralCode?: string;
  deviceFingerprint?: string;
}

export interface CreateTrialResponse {
  success: boolean;
  ok?: boolean;

  // Account info
  account_id?: string;
  accountId?: string;
  user_id?: string;

  // Auth credentials (for auto sign-in)
  email?: string;
  password?: string;

  // Stripe info
  stripe_customer_id?: string;
  stripeCustomerId?: string;
  subscription_id?: string;
  stripeSubscriptionId?: string;

  // Trial info
  trial_end_date?: string;
  plan_type?: string;

  // Provisioning status
  provisioning_status?: 'pending' | 'in_progress' | 'completed' | 'failed';
  vapi_assistant_id?: string | null;
  phone_number?: string | null;

  // Error info
  message?: string;
  error?: string;
  phase?: string;
  request_id?: string;
}

/**
 * Create a trial account (Step 2 of two-step signup)
 *
 * @param payload - Complete trial setup information
 * @returns Promise with account info and credentials on success
 * @throws Error if the request fails
 *
 * @example
 * ```ts
 * const result = await createTrial({
 *   name: 'John Smith',
 *   email: 'john@acme.com',
 *   phone: '+15551234567',
 *   companyName: 'Acme Plumbing',
 *   trade: 'plumbing',
 *   planType: 'starter',
 *   paymentMethodId: 'pm_xxx',
 *   leadId: 'uuid-from-step-1', // Links to lead from Step 1
 * });
 * ```
 */
export async function createTrial(
  payload: CreateTrialPayload
): Promise<CreateTrialResponse> {
  const { data, error } = await supabase.functions.invoke<CreateTrialResponse>(
    'create-trial',
    {
      body: {
        // Required user info
        name: payload.name,
        email: payload.email.trim().toLowerCase(),
        phone: payload.phone,

        // Required business info
        companyName: payload.companyName.trim(),
        trade: payload.trade,

        // Optional business info
        website: payload.website || undefined,
        serviceArea: payload.serviceArea || undefined,
        zipCode: payload.zipCode || undefined,
        businessHours: payload.businessHours || undefined,

        // AI configuration
        assistantGender: payload.assistantGender ?? 'female',
        primaryGoal: payload.primaryGoal || undefined,
        wantsAdvancedVoice: payload.wantsAdvancedVoice ?? false,

        // Plan & payment
        planType: payload.planType,
        paymentMethodId: payload.paymentMethodId,

        // Source tracking
        source: payload.source ?? 'website',
        salesRepName: payload.salesRepName || undefined,

        // Link to lead from Step 1
        leadId: payload.leadId || undefined,

        // Optional metadata
        referralCode: payload.referralCode || undefined,
        deviceFingerprint: payload.deviceFingerprint || undefined,
      },
    }
  );

  if (error) {
    console.error('[createTrial] Edge function error:', error);
    throw new Error(error.message || 'Failed to create trial');
  }

  if (!data?.success && !data?.ok) {
    console.error('[createTrial] Invalid response:', data);
    throw new Error(data?.message || data?.error || 'Failed to create trial');
  }

  return data;
}

/**
 * Convert a business hours object to the JSON string format expected by create-trial
 *
 * @example
 * ```ts
 * const hours = {
 *   monday: '09:00-17:00',
 *   tuesday: '09:00-17:00',
 *   // ...
 * };
 * const hoursStr = formatBusinessHours(hours);
 * ```
 */
export function formatBusinessHours(
  hours: Record<string, string> | null | undefined
): string | undefined {
  if (!hours) return undefined;
  return JSON.stringify(hours);
}
