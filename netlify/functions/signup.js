const { createClient } = require("@supabase/supabase-js");

const jsonResponse = (statusCode, payload) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload)
});

const parseBody = (event) => {
  const contentType = (event.headers?.["content-type"] || event.headers?.["Content-Type"] || "")
    .toLowerCase();

  if (contentType.includes("application/json")) {
    return JSON.parse(event.body || "{}");
  }

  return Object.fromEntries(new URLSearchParams(event.body || ""));
};

const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    let body;
    try {
      body = parseBody(event);
    } catch (parseError) {
      console.error("Failed to parse signup payload", parseError);
      return jsonResponse(400, { ok: false, error: "invalid_payload" });
    }

    const { name, email, phone, trade } = body;
    if (!name || !email) {
      return jsonResponse(400, { ok: false, error: "missing_fields" });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("Missing Supabase service credentials");
      return jsonResponse(500, { ok: false, error: "configuration_error" });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const now = new Date();
    const trialEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .insert([
        {
          owner_name: name,
          owner_email: email,
          owner_phone: phone,
          industry: trade,
          plan_status: "trial",
          trial_minutes_used: 0,
          trial_start_at: now.toISOString(),
          trial_end_at: trialEnd.toISOString(),
          onboarding_step: "created"
        }
      ])
      .select("account_id")
      .single();

    if (accountError || !account) {
      console.error("Insert account error", accountError);
      return jsonResponse(500, { ok: false, error: "database_insert_failed" });
    }

    try {
      await supabase
        .from("users")
        .insert([
          { account_id: account.account_id, name, email, phone, role: "owner" }
        ])
        .select()
        .single();
    } catch (userError) {
      console.warn("Unable to insert owner user", userError);
    }

    if (process.env.PROVISION_WEBHOOK_URL) {
      const fetchImpl = typeof fetch === "function" ? fetch : null;

      if (!fetchImpl) {
        console.warn("Fetch is unavailable in this environment; skipping provisioning webhook.");
      } else {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        fetchImpl(process.env.PROVISION_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: account.account_id,
            owner_name: name,
            owner_email: email,
            owner_phone: phone,
            industry: trade
          }),
          signal: controller.signal
        })
          .catch((webhookError) => {
            console.warn("Provisioning webhook failed", webhookError);
          })
          .finally(() => {
            clearTimeout(timeout);
          });
      }
    }

    return jsonResponse(200, { ok: true, accountId: account.account_id });
  } catch (error) {
    console.error("Unhandled error in signup function", error);
    return jsonResponse(500, { ok: false, error: "internal_error" });
  }
};

exports.handler = handler;
