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

function isSchemaError(error: any): boolean {
  const msg: string = error?.message ?? "";
  return msg.includes("schema cache") || msg.includes("Could not find the function");
}

export async function captureSignupLead(
  payload: SignupLeadPayload,
): Promise<SignupLeadRow> {
  const { email, full_name, phone, source, signup_flow, ...extraFields } = payload;

  if (!email) {
    throw new Error("Failed to save your information: Email is required");
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    // Prefer the SECURITY DEFINER RPC which handles upsert atomically.
    const { data, error } = await (supabase as any).rpc('capture_signup_lead', {
      p_email: normalizedEmail,
      p_full_name: full_name?.trim() ?? null,
      p_phone: phone?.trim() ?? null,
      p_source: source ?? 'website',
      p_signup_flow: signup_flow ?? 'two-step-v2',
      p_metadata: extraFields.metadata ?? extraFields,
    });

    // If the RPC is missing from the schema cache (deploy/cache issue), fall back to
    // a direct upsert. This works because anon has INSERT+UPDATE+SELECT via RLS
    // policies added in migration 20260314000006.
    if (error && isSchemaError(error)) {
      console.warn("[captureSignupLead] RPC unavailable, using direct upsert fallback", error.message);
      const { data: fallback, error: fallbackError } = await (supabase as any)
        .from('signup_leads')
        .upsert(
          {
            email: normalizedEmail,
            full_name: full_name?.trim() ?? null,
            phone: phone?.trim() ?? null,
            source: source ?? 'website',
            signup_flow: signup_flow ?? 'two-step-v2',
          },
          { onConflict: 'email' }
        )
        .select('id, email, full_name')
        .single();

      if (fallbackError) throw fallbackError;
      return fallback as SignupLeadRow;
    }

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
