import { createClient } from "@supabase/supabase-js";

const jsonResponse = (statusCode, payload) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload)
});

const isValidEmail = (value = "") => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

exports.handler = async (event) => {
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

    let account_id = typeof accountId === "string" && accountId.trim() ? accountId.trim() : undefined;

    if (!account_id) {
      const { data, error } = await supabase
        .from("accounts")
        .insert([
          {
            owner_name: normalizedOwnerName,
            owner_email: normalizedOwnerEmail,
            owner_phone: ownerPhoneValue,
            industry: industryValue,
            company_name: companyNameValue,
            service_area: serviceAreaValue,
            business_hours: businessHoursValue,
            emergency_policy: emergencyPolicyValue,
            plan_status: "trial",
            trial_minutes_used: 0,
            trial_start_at: now.toISOString(),
            trial_end_at: trialEnd.toISOString(),
            onboarding_step: "created"
          }
        ])
        .select("account_id")
        .single();

      if (error || !data) {
        console.error("Insert account error:", error);
        return jsonResponse(500, { ok: false, error: "database_insert_failed" });
      }

      const resolvedAccountId = data.account_id || data.id;
      account_id = typeof resolvedAccountId === "string" ? resolvedAccountId : String(resolvedAccountId);
    } else {
      const { error } = await supabase
        .from("accounts")
        .update({
          owner_name: normalizedOwnerName,
          owner_email: normalizedOwnerEmail,
          owner_phone: ownerPhoneValue,
          industry: industryValue,
          company_name: companyNameValue,
          service_area: serviceAreaValue,
          business_hours: businessHoursValue,
          emergency_policy: emergencyPolicyValue,
          plan_status: "trial",
          trial_minutes_used: 0,
          trial_start_at: now.toISOString(),
          trial_end_at: trialEnd.toISOString(),
          onboarding_step: "created"
        })
        .eq("account_id", account_id);

      if (error) {
        console.error("Update account error:", error);
        return jsonResponse(500, { ok: false, error: "database_update_failed" });
      }
    }

    const { error: userError } = await supabase
      .from("users")
      .upsert(
        {
          account_id: account_id,
          name: normalizedOwnerName,
          email: normalizedOwnerEmail,
          phone: ownerPhoneValue,
          role: "owner"
        },
        { onConflict: "email" }
      );

    if (userError) {
      console.error("Upsert user error:", userError);
      return jsonResponse(500, { ok: false, error: "user_upsert_failed" });
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
            company_name: companyNameValue,
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
