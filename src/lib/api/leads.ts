// src/lib/api/leads.ts
import { supabase } from "@/lib/supabase";

export type SignupLeadPayload = {
  email: string;
  full_name?: string;
  phone?: string;
  source?: string;
  signup_flow?: string;
  [key: string]: any;
};

export type SignupLeadRow = {
  id: string;
  email: string;
  full_name?: string | null;
  phone?: string | null;
  source?: string | null;
  signup_flow?: string | null;
  [key: string]: any;
};

export async function captureSignupLead(
  payload: SignupLeadPayload,
): Promise<SignupLeadRow> {
  const { email, full_name, phone, source, signup_flow, ...extraFields } = payload;

  if (!email) {
    throw new Error("Failed to save your information: Email is required");
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    // Use the SECURITY DEFINER RPC which bypasses RLS and handles upsert atomically.
    // Direct client-side INSERT/UPDATE on signup_leads is unreliable: anon has no
    // UPDATE policy and the SELECT used to detect duplicates is also blocked for anon.
    const { data, error } = await (supabase as any).rpc('capture_signup_lead', {
      p_email: normalizedEmail,
      p_full_name: full_name?.trim() ?? null,
      p_phone: phone?.trim() ?? null,
      p_source: source ?? 'website',
      p_signup_flow: signup_flow ?? 'two-step-v2',
      p_metadata: extraFields.metadata ?? extraFields,
    });

    if (error) throw error;

    if (!data) {
      throw new Error("Operation completed but no data returned.");
    }

    return data as SignupLeadRow;

  } catch (error: any) {
    console.error("[captureSignupLead] error", error);
    throw new Error(`Failed to save your information: ${error.message}`);
  }
}
