const { createClient } = require("@supabase/supabase-js");

const jsonResponse = (statusCode, payload) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type"
  },
  body: JSON.stringify(payload)
});

exports.handler = async (event) => {
  console.log("=== SIGNUP FUNCTION STARTED ===");
  console.log("HTTP Method:", event.httpMethod);
  console.log("Headers:", JSON.stringify(event.headers, null, 2));

  try {
    // Handle CORS preflight
    if (event.httpMethod === "OPTIONS") {
      return jsonResponse(200, { ok: true });
    }

    if (event.httpMethod !== "POST") {
      console.error("Invalid method:", event.httpMethod);
      return jsonResponse(405, { ok: false, error: "method_not_allowed" });
    }

    // Check environment variables
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
    console.log("Environment check:", {
      hasSupabaseUrl: !!SUPABASE_URL,
      hasServiceRoleKey: !!SUPABASE_SERVICE_ROLE_KEY,
      supabaseUrl: SUPABASE_URL
    });

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing Supabase environment configuration");
      return jsonResponse(500, {
        ok: false,
        error: "config_error",
        details: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
      });
    }

    // Parse body
    console.log("Raw body:", event.body);
    let parsedBody = {};
    try {
      const isJson = (event.headers["content-type"] || "").includes("application/json");
      parsedBody = isJson
        ? JSON.parse(event.body || "{}")
        : Object.fromEntries(new URLSearchParams(event.body || ""));
      console.log("Parsed body:", JSON.stringify(parsedBody, null, 2));
    } catch (parseError) {
      console.error("Body parse error:", parseError);
      return jsonResponse(400, {
        ok: false,
        error: "invalid_body",
        details: parseError.message
      });
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

    // Validate required fields
    const normalizedName = typeof owner_name === "string" ? owner_name.trim() : "";
    const normalizedEmail = typeof owner_email === "string" ? owner_email.trim() : "";
    const phoneValue = typeof owner_phone === "string" && owner_phone.trim() ? owner_phone.trim() : null;

    console.log("Validation:", {
      hasName: !!normalizedName,
      hasEmail: !!normalizedEmail,
      hasPhone: !!phoneValue,
      emailValid: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    });

    if (!normalizedName || !normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return jsonResponse(400, {
        ok: false,
        error: "missing_fields",
        details: "Name and valid email are required"
      });
    }

    if (!phoneValue) {
      console.error("Phone number is required but was not provided");
      return jsonResponse(400, {
        ok: false,
        error: "missing_phone",
        details: "Phone number is required"
      });
    }

    // Create Supabase client
    console.log("Creating Supabase client...");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    console.log("Supabase client created");

    // Prepare insert payload
    const tradeValue = typeof industry === "string" && industry.trim() ? industry.trim() : null;
    const sourceValue = typeof source === "string" && source.trim() ? source.trim() : null;
    const wantsAdvancedVoiceValue = typeof wantsAdvancedVoice === "boolean" ? wantsAdvancedVoice : false;

    const insertPayload = {
      name: normalizedName,
      email: normalizedEmail,
      phone: phoneValue,
      trade: tradeValue,
      source: sourceValue,
      wants_advanced_voice: wantsAdvancedVoiceValue
    };

    console.log("Attempting insert with payload:", {
      ...insertPayload,
      email: normalizedEmail.substring(0, 3) + "***"
    });

    // Insert into trial_signups
    const { data, error } = await supabase
      .from("trial_signups")
      .insert([insertPayload])
      .select("id")
      .single();

    if (error) {
      console.error("Supabase insert error:", JSON.stringify(error, null, 2));
      return jsonResponse(500, {
        ok: false,
        error: "database_insert_failed",
        details: error.message,
        code: error.code,
        hint: error.hint
      });
    }

    if (!data) {
      console.error("No data returned from insert");
      return jsonResponse(500, {
        ok: false,
        error: "database_insert_failed",
        details: "No data returned from insert"
      });
    }

    console.log("Insert successful, signupId:", data.id);

    // Webhook notification (optional)
    const { PROVISION_WEBHOOK_URL } = process.env;
    if (PROVISION_WEBHOOK_URL) {
      console.log("Sending webhook notification...");
      try {
        await fetch(PROVISION_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signupId: data.id,
            name: normalizedName,
            email: normalizedEmail,
            phone: phoneValue,
            trade: tradeValue,
            company_name: company_name,
            wants_advanced_voice: wantsAdvancedVoiceValue
          })
        });
        console.log("Webhook sent successfully");
      } catch (webhookError) {
        console.warn("Provision webhook failed (continuing):", webhookError);
      }
    }

    console.log("=== SIGNUP FUNCTION COMPLETED SUCCESSFULLY ===");
    return jsonResponse(200, { ok: true, signupId: data.id });

  } catch (e) {
    console.error("=== UNHANDLED ERROR ===");
    console.error("Error:", e);
    console.error("Stack:", e.stack);
    return jsonResponse(500, {
      ok: false,
      error: "internal_error",
      details: e.message,
      stack: process.env.NODE_ENV === 'development' ? e.stack : undefined
    });
  }
};
