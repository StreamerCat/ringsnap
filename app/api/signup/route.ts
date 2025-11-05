import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Json = Record<string, unknown>;

type SignupBody = {
  name?: string;
  email?: string;
  phone?: string;
  trade?: string;
  companyName?: string;
  areaCode?: string;
};

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables for signup route");
}

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })
  : null;

function normalizeString(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function errorResponse(message: string, status = 400) {
  return Response.json({ ok: false, error: message }, { status });
}

export async function POST(req: NextRequest) {
  if (!supabase) {
    return errorResponse("server_not_configured", 500);
  }

  let body: SignupBody;
  try {
    body = await req.json();
  } catch {
    return errorResponse("invalid_json", 400);
  }

  const name = normalizeString(body.name);
  const email = normalizeString(body.email)?.toLowerCase();
  const phone = normalizeString(body.phone);
  const trade = normalizeString(body.trade);
  const companyName = normalizeString(body.companyName) ?? name ?? undefined;
  const areaCode = normalizeString(body.areaCode) ?? undefined;

  if (!name || !email) {
    return errorResponse("missing_required_fields", 400);
  }

  try {
    // Ensure a user record exists
    const { data: existingUser, error: fetchUserError } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (fetchUserError && fetchUserError.code !== "PGRST116") {
      throw fetchUserError;
    }

    let user = existingUser as Json | null;

    if (user) {
      const updates: Record<string, unknown> = {};
      if (!user["name"] && name) updates["name"] = name;
      if (!user["phone"] && phone) updates["phone"] = phone;
      if (trade && user["trade"] !== trade) updates["trade"] = trade;

      if (Object.keys(updates).length) {
        const { data: updatedUser, error: updateUserError } = await supabase
          .from("users")
          .update(updates)
          .eq("id", user["id"])
          .select("*")
          .single();
        if (updateUserError) throw updateUserError;
        user = updatedUser as Json;
      }
    } else {
      const { data: insertedUser, error: insertUserError } = await supabase
        .from("users")
        .insert({ name, email, phone, trade })
        .select("*")
        .single();
      if (insertUserError) throw insertUserError;
      user = insertedUser as Json;
    }

    if (!user || !user["id"]) {
      throw new Error("user_not_created");
    }

    // Ensure an account record exists
    let account: Json | null = null;
    const { data: existingAccount, error: fetchAccountError } = await supabase
      .from("accounts")
      .select("*")
      .eq("company_name", companyName ?? name)
      .maybeSingle();

    if (fetchAccountError && fetchAccountError.code !== "PGRST116") {
      throw fetchAccountError;
    }

    if (existingAccount) {
      account = existingAccount as Json;
      const accountUpdates: Record<string, unknown> = {};
      if (trade && account["trade"] !== trade) accountUpdates["trade"] = trade;
      if (phone && account["phone_number_e164"] !== phone) accountUpdates["phone_number_e164"] = phone;
      if (areaCode && account["phone_number_area_code"] !== areaCode) accountUpdates["phone_number_area_code"] = areaCode;

      if (Object.keys(accountUpdates).length) {
        const { data: updatedAccount, error: updateAccountError } = await supabase
          .from("accounts")
          .update(accountUpdates)
          .eq("id", account["id"])
          .select("*")
          .single();
        if (updateAccountError) throw updateAccountError;
        account = updatedAccount as Json;
      }
    } else {
      const { data: insertedAccount, error: insertAccountError } = await supabase
        .from("accounts")
        .insert({
          company_name: companyName ?? name,
          trade,
          phone_number_e164: phone,
          phone_number_area_code: areaCode,
        })
        .select("*")
        .single();
      if (insertAccountError) throw insertAccountError;
      account = insertedAccount as Json;
    }

    if (!account || !account["id"]) {
      throw new Error("account_not_created");
    }

    const provisionResponse = await fetch(`${SUPABASE_URL}/functions/v1/provision`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accountId: account["id"],
        userId: user["id"],
        companyName: companyName ?? name,
        areaCode,
      }),
    });

    const provisionBody = await provisionResponse.json();
    if (!provisionResponse.ok || !provisionBody?.ok) {
      const errorMessage = provisionBody?.error ?? "provision_failed";
      return errorResponse(errorMessage, 400);
    }

    return Response.json({
      ok: true,
      accountId: account["id"],
      assistantId: provisionBody.assistantId,
      phone: provisionBody.number,
      jobId: provisionBody.jobId ?? null,
    });
  } catch (error) {
    console.error("Signup provisioning error", error);
    const message = error instanceof Error ? error.message : "unknown_error";
    return errorResponse(message, 500);
  }
}
