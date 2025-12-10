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
    // 1. Check for existing lead manually (since unique constraint might be missing)
    // Using 'as any' to bypass missing type definitions
    const { data: existingLeads } = await (supabase as any)
      .from('signup_leads')
      .select('*')
      .eq('email', normalizedEmail)
      .order('created_at', { ascending: false })
      .limit(1);

    const existingLead = existingLeads?.[0];

    const dbPayload = {
      email: normalizedEmail,
      full_name: full_name?.trim(),
      phone: phone?.trim(),
      source: source ?? 'website',
      signup_flow: signup_flow ?? 'two-step-v2',
      metadata: extraFields.metadata || extraFields,
    };

    let resultData;

    if (existingLead) {
      // 2a. Update existing lead
      console.log("[captureSignupLead] Updating existing lead:", existingLead.id);
      const { data: updated, error: updateError } = await (supabase as any)
        .from('signup_leads')
        .update(dbPayload)
        .eq('id', existingLead.id)
        .select()
        .single();

      if (updateError) throw updateError;
      resultData = updated;
    } else {
      // 2b. Insert new lead
      console.log("[captureSignupLead] Creating new lead");
      const { data: inserted, error: insertError } = await (supabase as any)
        .from('signup_leads')
        .insert(dbPayload)
        .select()
        .single();

      if (insertError) throw insertError;
      resultData = inserted;
    }

    if (!resultData) {
      throw new Error("Operation completed but no data returned.");
    }

    return resultData as SignupLeadRow;

  } catch (error: any) {
    console.error("[captureSignupLead] error", error);
    throw new Error(`Failed to save your information: ${error.message}`);
  }
}
