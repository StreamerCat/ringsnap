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

function isDuplicateKeyError(error: any): boolean {
  return error?.code === "23505" || (error?.message ?? "").includes("duplicate key");
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

    // If the RPC is missing from the schema cache, fall back to direct INSERT.
    // This requires no DB constraints and works even if migrations are behind.
    if (error && isSchemaError(error)) {
      console.warn("[captureSignupLead] RPC unavailable, using direct INSERT fallback", error.message);
      return await directInsertFallback(normalizedEmail, full_name, phone, source, signup_flow);
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

async function directInsertFallback(
  email: string,
  full_name?: string,
  phone?: string,
  source?: string,
  signup_flow?: string,
): Promise<SignupLeadRow> {
  // Try a plain INSERT first (no ON CONFLICT clause — no constraint required)
  const { data: inserted, error: insertError } = await (supabase as any)
    .from('signup_leads')
    .insert({
      email,
      full_name: full_name?.trim() ?? null,
      phone: phone?.trim() ?? null,
      source: source ?? 'website',
      signup_flow: signup_flow ?? 'two-step-v2',
    })
    .select('id, email, full_name')
    .single();

  if (!insertError) {
    return inserted as SignupLeadRow;
  }

  // If the email already exists (duplicate key), fetch and return the existing row
  if (isDuplicateKeyError(insertError)) {
    console.warn("[captureSignupLead] duplicate email, returning existing lead");
    const { data: existing, error: selectError } = await (supabase as any)
      .from('signup_leads')
      .select('id, email, full_name')
      .eq('email', email)
      .is('completed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (selectError) throw selectError;
    return existing as SignupLeadRow;
  }

  throw insertError;
}
