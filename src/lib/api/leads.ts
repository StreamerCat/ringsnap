// src/lib/api/leads.ts
import { supabase } from "@/lib/supabase";

export type SignupLeadPayload = {
  email?: string;
  full_name?: string;
  name?: string;
  phone?: string;
  source?: string;
  signup_flow?: string;
  [key: string]: unknown;
};

export type SignupLeadResponse = {
  success: boolean;
  message?: string;
  error?: string;
  data?: unknown;
  [key: string]: unknown;
};

export async function captureSignupLead(
  payload: SignupLeadPayload,
): Promise<SignupLeadResponse> {
  const normalizedEmail = payload.email?.toLowerCase();
  const normalizedFullName = payload.full_name ?? payload.name ?? null;

  if (!normalizedEmail) {
    return { success: false, error: "Email is required" };
  }

  if (!normalizedFullName) {
    return { success: false, error: "Full name is required" };
  }

  const { email, full_name, name, phone, source, signup_flow, ...rest } = payload;

  const { data, error } = await supabase
    .from("signup_leads")
    .insert({
      email: normalizedEmail,
      full_name: normalizedFullName,
      phone: phone ?? null,
      source: source ?? "website",
      signup_flow: signup_flow ?? null,
      ...rest,
    })
    .select()
    .single();

  if (error) {
    console.error("[signup_leads] insert error", error);
    return { success: false, error: error.message };
  }

  return { success: true, data };
}
