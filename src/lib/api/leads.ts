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
    const { data, error } = await supabase.functions.invoke('capture-signup-lead', {
      body: {
        email: normalizedEmail,
        full_name: full_name?.trim(),
        phone: phone?.trim(),
        source: source ?? 'website',
        signup_flow: signup_flow ?? 'two-step-v2',
        metadata: extraFields.metadata || extraFields,
      },
    });

    if (error) {
      // Handle Edge Function invocation errors (e.g. network, 500s)
      console.error("[captureSignupLead] Edge Function invocation failed:", error);
      // Try to parse the error body if it exists, otherwise use message
      let errorMessage = error.message || "Unknown error";
      try {
        // sometimes the error body is a stringified JSON
        const body = typeof error.context === 'string' ? JSON.parse(error.context) : error.context;
        if (body?.message) errorMessage = body.message;
      } catch { /* ignore parse error */ }

      throw new Error(`Failed to save your information: ${errorMessage}`);
    }

    if (!data?.success) {
      throw new Error(data?.message || "Failed to capture lead");
    }

    console.log("[captureSignupLead] success", { leadId: data.lead_id });

    // Return a mock row structure that complies with the interface
    // The Edge Function returns lead_id. We might need to fetch the full row or just return basic info.
    // Start.tsx only uses `lead.id`.
    return {
      id: data.lead_id,
      email: normalizedEmail,
      full_name: full_name ?? null,
      phone: phone ?? null,
      source: source ?? null,
      signup_flow: signup_flow ?? null,
      metadata: extraFields.metadata || extraFields,
      completed_at: null, // New leads are not completed
    };

  } catch (error: any) {
    console.error("[captureSignupLead] error", error);
    // Determine if it's a "User already exists" or similar logic that we should mask?
    // The edge function handles updates, so it shouldn't fail on duplicates.
    throw error;
  }
}
