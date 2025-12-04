/**
 * Lead Capture API Helper
 *
 * Provides a typed interface for calling the capture-signup-lead Edge Function.
 * Used in Step 1 of the two-step signup flow.
 */

import { supabase } from '@/lib/supabase';

export interface CaptureLeadPayload {
  email: string;
  full_name: string;
  source?: 'website' | 'sales' | 'referral';
  signup_flow?: string;
  metadata?: {
    utm_source?: string;
    utm_campaign?: string;
    utm_medium?: string;
    referrer?: string;
    step?: string;
  };
}

export interface CaptureLeadResponse {
  success: boolean;
  lead_id?: string;
  message?: string;
  error?: string;
}

/**
 * Capture a signup lead (Step 1 of two-step signup)
 *
 * @param payload - Lead information to capture
 * @returns Promise with lead_id on success
 * @throws Error if the request fails
 *
 * @example
 * ```ts
 * const { lead_id } = await captureSignupLead({
 *   email: 'john@acme.com',
 *   full_name: 'John Smith',
 *   source: 'website',
 *   signup_flow: 'two-step-v2',
 * });
 * ```
 */
export async function captureSignupLead(
  payload: CaptureLeadPayload
): Promise<{ lead_id: string }> {
  const { data, error } = await supabase.functions.invoke<CaptureLeadResponse>(
    'capture-signup-lead',
    {
      body: {
        email: payload.email.trim().toLowerCase(),
        full_name: payload.full_name.trim(),
        source: payload.source ?? 'website',
        signup_flow: payload.signup_flow ?? 'two-step-v2',
        metadata: payload.metadata,
      },
    }
  );

  if (error) {
    console.error('[captureSignupLead] Edge function error:', error);
    throw new Error(error.message || 'Failed to capture lead');
  }

  if (!data?.success || !data.lead_id) {
    console.error('[captureSignupLead] Invalid response:', data);
    throw new Error(data?.message || data?.error || 'Failed to capture lead');
  }

  return { lead_id: data.lead_id };
}

/**
 * localStorage key for storing lead_id between steps
 */
export const LEAD_ID_STORAGE_KEY = 'ringsnap_signup_lead_id';

/**
 * Store lead_id in localStorage for persistence across page reloads
 */
export function storeLeadId(leadId: string): void {
  try {
    localStorage.setItem(LEAD_ID_STORAGE_KEY, leadId);
  } catch {
    console.warn('[storeLeadId] localStorage not available');
  }
}

/**
 * Retrieve lead_id from localStorage
 */
export function getStoredLeadId(): string | null {
  try {
    return localStorage.getItem(LEAD_ID_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Clear stored lead_id (call after successful trial creation)
 */
export function clearStoredLeadId(): void {
  try {
    localStorage.removeItem(LEAD_ID_STORAGE_KEY);
  } catch {
    // Ignore
  }
}
