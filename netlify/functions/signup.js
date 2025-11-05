import { createClient } from "@supabase/supabase-js";

const jsonResponse = (statusCode, payload) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type"
  },
  body: JSON.stringify(payload)
});

export const handler = async (event) => {
  console.log("=== SIGNUP FUNCTION STARTED ===");

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
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PROVISION_WEBHOOK_URL } = process.env;

    console.log("Environment check:", {
      hasSupabaseUrl: !!SUPABASE_URL,
      hasServiceRoleKey: !!SUPABASE_SERVICE_ROLE_KEY
    });

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing Supabase environment configuration");
      return jsonResponse(500, {
        ok: false,
        error: "config_error",
        details: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
      });
    }

    // Parse request body
    let parsedBody = {};
    try {
      const isJson = (event.headers["content-type"] || "").includes("application/json");
      parsedBody = isJson
        ? JSON.parse(event.body || "{}")
        : Object.fromEntries(new URLSearchParams(event.body || ""));

      console.log("Received fields:", Object.keys(parsedBody));
    } catch (parseError) {
      console.error("Body parse error:", parseError);
      return jsonResponse(400, {
        ok: false,
        error: "invalid_body",
        details: parseError.message
      });
    }

    // Extract fields (support both formats)
    const name = parsedBody.name || parsedBody.owner_name;
    const email = parsedBody.email || parsedBody.owner_email;
    const phone = parsedBody.phone || parsedBody.owner_phone;
    const trade = parsedBody.trade || parsedBody.industry;

    console.log("Extracted fields:", {
      hasName: !!name,
      hasEmail: !!email,
      hasPhone: !!phone,
      hasTrade: !!trade
    });

    if (!name || !email) {
      console.error("Missing required fields");
      return jsonResponse(400, {
        ok: false,
        error: "missing_fields",
        details: "Name and email are required"
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error("Invalid email format");
      return jsonResponse(400, {
        ok: false,
        error: "invalid_email",
        details: "Please provide a valid email address"
      });
    }

    // Create Supabase client
    console.log("Creating Supabase client...");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Calculate trial dates
    const now = new Date();
    const trialEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    // Prepare account data
    const accountData = {
      owner_name: name.trim(),
      owner_email: email.trim().toLowerCase(),
      owner_phone: phone?.trim() || null,
      industry: trade?.trim() || null,
      plan_status: "trial",
      trial_minutes_used: 0,
      trial_start_at: now.toISOString(),
      trial_end_at: trialEnd.toISOString(),
      onboarding_step: "created"
    };

    console.log("Inserting account...");

    // Insert into ACCOUNTS table
    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .insert([accountData])
      .select("account_id")
      .single();

    if (accountError) {
      console.error("Account insert error:", JSON.stringify(accountError, null, 2));
      return jsonResponse(500, {
        ok: false,
        error: "database_insert_failed",
        details: accountError.message,
        code: accountError.code,
        hint: accountError.hint
      });
    }

    if (!account?.account_id) {
      console.error("No account_id returned from insert");
      return jsonResponse(500, {
        ok: false,
        error: "database_insert_failed",
        details: "No account_id returned"
      });
    }

    console.log("Account created successfully:", account.account_id);

    // Insert owner user into USERS table (best effort)
    const userData = {
      account_id: account.account_id,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim() || null,
      role: "owner"
    };

    console.log("Inserting owner user...");

    const { error: userError } = await supabase
      .from("users")
      .insert([userData])
      .select()
      .single();

    if (userError) {
      console.warn("User insert failed (continuing):", userError.message);
      // Don't fail if user insert fails - account is already created
    } else {
      console.log("Owner user created successfully");
    }

    // Optional: Call provisioning webhook (Make.com, etc)
    if (PROVISION_WEBHOOK_URL) {
      console.log("Calling provisioning webhook...");
      try {
        await fetch(PROVISION_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: account.account_id,
            owner_name: name.trim(),
            owner_email: email.trim().toLowerCase(),
            owner_phone: phone?.trim() || null,
            industry: trade?.trim() || null
          })
        });
        console.log("Webhook called successfully");
      } catch (webhookError) {
        console.warn("Webhook failed (continuing):", webhookError.message);
      }
    }

    console.log("=== SIGNUP COMPLETED SUCCESSFULLY ===");

    return jsonResponse(200, {
      ok: true,
      accountId: account.account_id
    });

  } catch (error) {
    console.error("=== UNHANDLED ERROR ===");
    console.error("Error:", error);
    console.error("Stack:", error.stack);

    return jsonResponse(500, {
      ok: false,
      error: "internal_error",
      details: error.message
    });
  }
};
