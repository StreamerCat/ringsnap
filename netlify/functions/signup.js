import { createClient } from "@supabase/supabase-js";

const jsonResponse = (statusCode, payload) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload)
});

const isValidEmail = (value = "") => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const isSchemaMismatchError = (error) => {
  if (!error) return false;
  const code = error.code || "";
  const message = (error.message || "").toLowerCase();
  return code === "42703" || code === "42P01" || message.includes("does not exist");
};

const isConflictError = (error) => {
  if (!error) return false;
  const code = error.code || "";
  const message = (error.message || "").toLowerCase();
  return code === "23505" || message.includes("duplicate key value") || message.includes("conflict");
};

const insertAccountRecord = async (supabase, payload, selectColumn) =>
  supabase.from("accounts").insert([payload]).select(selectColumn).single();

const updateAccountRecord = async (supabase, payload, column, accountId) =>
  supabase.from("accounts").update(payload).eq(column, accountId);

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return jsonResponse(405, { ok: false, error: "method_not_allowed" });
    }

    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PROVISION_WEBHOOK_URL } = process.env;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing Supabase environment configuration");
      return jsonResponse(500, { ok: false, error: "config_error" });
    }

    const isJson = (event.headers["content-type"] || "").includes("application/json");
    let parsedBody = {};
    try {
      parsedBody = isJson
        ? JSON.parse(event.body || "{}")
        : Object.fromEntries(new URLSearchParams(event.body || ""));
    } catch (parseError) {
      console.error("Body parse error", parseError);
      return jsonResponse(400, { ok: false, error: "invalid_body" });
    }

    const {
      accountId,
      owner_name,
      owner_email,
      owner_phone,
      industry,
      company_name,
      service_area,
      business_hours,
      emergency_policy
    } = parsedBody;

    const normalizedOwnerName = typeof owner_name === "string" ? owner_name.trim() : "";
    const normalizedOwnerEmail = typeof owner_email === "string" ? owner_email.trim() : "";
    const ownerPhoneValue =
      typeof owner_phone === "string" && owner_phone.trim() ? owner_phone.trim() : null;
    const industryValue = typeof industry === "string" && industry.trim() ? industry.trim() : null;
    const companyNameValue =
      typeof company_name === "string" && company_name.trim() ? company_name.trim() : null;
    const serviceAreaValue =
      typeof service_area === "string" && service_area.trim() ? service_area.trim() : null;
    const businessHoursValue =
      typeof business_hours === "string" && business_hours.trim() ? business_hours.trim() : null;
    const emergencyPolicyValue =
      typeof emergency_policy === "string" && emergency_policy.trim() ? emergency_policy.trim() : null;

    if (!normalizedOwnerName || !normalizedOwnerEmail || !isValidEmail(normalizedOwnerEmail)) {
      return jsonResponse(400, { ok: false, error: "missing_fields" });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const now = new Date();
    const trialEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const trimmedAccountId =
      typeof accountId === "string" && accountId.trim() ? accountId.trim() : undefined;

    const normalizedCompanyName =
      companyNameValue ||
      (normalizedOwnerEmail.includes("@")
        ? normalizedOwnerEmail.split("@")[1] || normalizedOwnerName
        : normalizedOwnerName);
    const companyDomain =
      normalizedOwnerEmail.includes("@")
        ? normalizedOwnerEmail.split("@")[1]?.toLowerCase() || null
        : null;

    let account_id = trimmedAccountId;

    if (!account_id) {
      const specInsertPayload = {
        owner_name: normalizedOwnerName,
        owner_email: normalizedOwnerEmail,
        owner_phone: ownerPhoneValue,
        industry: industryValue,
        company_name: normalizedCompanyName,
        service_area: serviceAreaValue,
        business_hours: businessHoursValue,
        emergency_policy: emergencyPolicyValue,
        plan_status: "trial",
        trial_minutes_used: 0,
        trial_start_at: now.toISOString(),
        trial_end_at: trialEnd.toISOString(),
        onboarding_step: "created"
      };

      let insertResult = await insertAccountRecord(supabase, specInsertPayload, "account_id");

      if (insertResult.error && isSchemaMismatchError(insertResult.error)) {
        const fallbackPayload = {
          company_name: normalizedCompanyName,
          company_domain: companyDomain,
          trade: industryValue,
          wants_advanced_voice: null,
          subscription_status: "trial",
          trial_start_date: now.toISOString(),
          trial_end_date: trialEnd.toISOString()
        };

        insertResult = await insertAccountRecord(supabase, fallbackPayload, "id");
      }

      if (insertResult.error || !insertResult.data) {
        console.error("Insert account error:", insertResult.error);
        return jsonResponse(500, { ok: false, error: "database_insert_failed" });
      }

      const resolvedAccountId = insertResult.data.account_id || insertResult.data.id;
      account_id = typeof resolvedAccountId === "string" ? resolvedAccountId : String(resolvedAccountId);
    } else {
      const specUpdatePayload = {
        owner_name: normalizedOwnerName,
        owner_email: normalizedOwnerEmail,
        owner_phone: ownerPhoneValue,
        industry: industryValue,
        company_name: normalizedCompanyName,
        service_area: serviceAreaValue,
        business_hours: businessHoursValue,
        emergency_policy: emergencyPolicyValue,
        plan_status: "trial",
        trial_minutes_used: 0,
        trial_start_at: now.toISOString(),
        trial_end_at: trialEnd.toISOString(),
        onboarding_step: "created"
      };

      let updateResult = await updateAccountRecord(
        supabase,
        specUpdatePayload,
        "account_id",
        account_id
      );

      if (updateResult.error && isSchemaMismatchError(updateResult.error)) {
        const fallbackPayload = {
          company_name: normalizedCompanyName,
          company_domain: companyDomain,
          trade: industryValue,
          subscription_status: "trial",
          trial_start_date: now.toISOString(),
          trial_end_date: trialEnd.toISOString(),
          wants_advanced_voice: null
        };

        updateResult = await updateAccountRecord(supabase, fallbackPayload, "id", account_id);
      }

      if (updateResult.error) {
        console.error("Update account error:", updateResult.error);
        return jsonResponse(500, { ok: false, error: "database_update_failed" });
      }
    }

    account_id = typeof account_id === "string" ? account_id : String(account_id);

    const ownerUserPayload = {
      account_id: account_id,
      name: normalizedOwnerName,
      email: normalizedOwnerEmail,
      phone: ownerPhoneValue,
      role: "owner"
    };

    const ensureTrialSignup = async () => {
      const trialSignupPayload = {
        name: normalizedOwnerName,
        email: normalizedOwnerEmail,
        phone: ownerPhoneValue || "",
        trade: industryValue,
        wants_advanced_voice: null,
        source: "website"
      };

      const { error: trialSignupError } = await supabase
        .from("trial_signups")
        .upsert(trialSignupPayload, { onConflict: "email" });

      if (trialSignupError) {
        if (isSchemaMismatchError(trialSignupError)) {
          console.warn("Trial signup fallback table unavailable:", trialSignupError);
          return;
        }

        console.error("Trial signup upsert error:", trialSignupError);
        throw new Error("trial_signup_failed");
      }
    };

    const insertUserResult = await supabase.from("users").insert([ownerUserPayload]);

    if (insertUserResult.error) {
      if (isSchemaMismatchError(insertUserResult.error)) {
        try {
          await ensureTrialSignup();
        } catch (fallbackError) {
          return jsonResponse(500, { ok: false, error: "user_upsert_failed" });
        }
      } else if (isConflictError(insertUserResult.error)) {
        const { error: updateUserError } = await supabase
          .from("users")
          .update(ownerUserPayload)
          .eq("email", normalizedOwnerEmail);

        if (updateUserError) {
          if (isSchemaMismatchError(updateUserError)) {
            try {
              await ensureTrialSignup();
            } catch (fallbackError) {
              return jsonResponse(500, { ok: false, error: "user_upsert_failed" });
            }
          } else {
            console.error("Update user error:", updateUserError);
            return jsonResponse(500, { ok: false, error: "user_upsert_failed" });
          }
        }
      } else {
        console.error("Insert user error:", insertUserResult.error);
        return jsonResponse(500, { ok: false, error: "user_upsert_failed" });
      }
    }

    if (PROVISION_WEBHOOK_URL) {
      try {
        await fetch(PROVISION_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: account_id,
            owner_name: normalizedOwnerName,
            owner_email: normalizedOwnerEmail,
            owner_phone: ownerPhoneValue,
            industry: industryValue,
            company_name: normalizedCompanyName,
            service_area: serviceAreaValue,
            business_hours: businessHoursValue,
            emergency_policy: emergencyPolicyValue
          })
        });
      } catch (webhookError) {
        console.warn("Provision webhook failed (continuing):", webhookError);
      }
    }

    return jsonResponse(200, { ok: true, accountId: account_id });
  } catch (e) {
    console.error("Unhandled error:", e);
    return jsonResponse(500, { ok: false, error: "internal_error" });
  }
};
