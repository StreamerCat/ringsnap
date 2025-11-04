const { createClient } = require("@supabase/supabase-js");

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
      owner_name,
      owner_email,
      owner_phone,
      industry,
      company_name,
      source,
      wantsAdvancedVoice
    } = parsedBody;

    const normalizedName = typeof owner_name === "string" ? owner_name.trim() : "";
    const normalizedEmail = typeof owner_email === "string" ? owner_email.trim() : "";
    const phoneValue =
      typeof owner_phone === "string" && owner_phone.trim() ? owner_phone.trim() : null;
    const tradeValue = typeof industry === "string" && industry.trim() ? industry.trim() : null;
    const sourceValue = typeof source === "string" && source.trim() ? source.trim() : null;
    const wantsAdvancedVoiceValue = typeof wantsAdvancedVoice === "boolean" ? wantsAdvancedVoice : false;

    if (!normalizedName || !normalizedEmail || !isValidEmail(normalizedEmail)) {
      return jsonResponse(400, { ok: false, error: "missing_fields" });
    }

    if (!phoneValue) {
      console.error("Phone number is required but was not provided");
      return jsonResponse(400, { ok: false, error: "missing_phone" });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Insert into trial_signups table
    const insertPayload = {
      name: normalizedName,
      email: normalizedEmail,
      phone: phoneValue,
      trade: tradeValue,
      source: sourceValue,
      wants_advanced_voice: wantsAdvancedVoiceValue
    };

    console.log("Attempting to insert trial signup:", { ...insertPayload, email: normalizedEmail.substring(0, 3) + "***" });

    const { data, error } = await supabase
      .from("trial_signups")
      .insert([insertPayload])
      .select("id")
      .single();

    if (error || !data) {
      console.error("Insert trial signup error:", JSON.stringify(error, null, 2));
      return jsonResponse(500, {
        ok: false,
        error: "database_insert_failed",
        details: error?.message || "Unknown error"
      });
    }

    const signupId = data.id;

    // Send webhook if configured
    if (PROVISION_WEBHOOK_URL) {
      try {
        await fetch(PROVISION_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signupId: signupId,
            name: normalizedName,
            email: normalizedEmail,
            phone: phoneValue,
            trade: tradeValue,
            company_name: company_name,
            wants_advanced_voice: wantsAdvancedVoiceValue
          })
        });
      } catch (webhookError) {
        console.warn("Provision webhook failed (continuing):", webhookError);
      }
    }

    return jsonResponse(200, { ok: true, signupId: signupId });
  } catch (e) {
    console.error("Unhandled error:", e);
    return jsonResponse(500, { ok: false, error: "internal_error" });
  }
};
