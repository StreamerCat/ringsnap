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

  const { data, error } = await supabase
    .from("signup_leads")
    .insert([
      {
        email: normalizedEmail,
        full_name: full_name?.trim() ?? null,
        phone: phone?.trim() ?? null,
        source: source ?? null,
        signup_flow: signup_flow ?? null,
        ...extraFields,
      },
    ])
    .select("id, email, full_name, phone, source, signup_flow, metadata, completed_at")
    .single();

  if (error) {
    console.error("[signup_leads] insert error", error);
    throw new Error(`Failed to save your information: ${error.message}`);
  }

  console.log("[signup_leads] lead captured", {
    email: normalizedEmail,
    leadId: data?.id,
  });

  return data as SignupLeadRow;
}
