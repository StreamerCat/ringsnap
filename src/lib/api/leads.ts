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

  const dbPayload = {
    email: normalizedEmail,
    full_name: full_name?.trim(),
    phone: phone?.trim(),
    source: source ?? 'website',
    signup_flow: signup_flow ?? 'two-step-v2',
    metadata: extraFields.metadata || extraFields,
  };

  try {
    // Attempt upsert (Insert or Update if email exists)
    // Using 'as any' because signup_leads table definition is missing in local types
    const { data: leads, error } = await (supabase
      .from('signup_leads') as any)
      .upsert(dbPayload, {
        onConflict: 'email',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) {
      console.error("[captureSignupLead] upsert error:", error);

      // Fallback: If upsert failed (e.g. RLS preventing update), try simple insert to see if we can just create
      // But if it's a unique violation on insert, we try to fetch.
      if (error.code === '42501' || error.code === 'PGRST301') {
        // Permission denied or other RLS issue on UPDATE. Try fetch.
        const { data: existing } = await (supabase
          .from('signup_leads') as any)
          .select('*')
          .eq('email', normalizedEmail)
          .maybeSingle();

        if (existing) return existing as SignupLeadRow;
      }

      throw new Error(`Failed to save your information: ${error.message}`);
    }

    if (!leads) {
      throw new Error("Saved successfully but no data returned.");
    }

    return leads as SignupLeadRow;

  } catch (error: any) {
    console.error("[captureSignupLead] error", error);
    throw error;
  }
}
