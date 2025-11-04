const { createClient } = require("@supabase/supabase-js");

  try {
    // Handle CORS preflight
    if (event.httpMethod === "OPTIONS") {
      return jsonResponse(200, { ok: true });
    }
  }

  if (!response.ok) {
    const error = new Error(`Supabase request failed with status ${response.status}`);
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
};

const resolveCompanyName = (email, providedCompany) => {
  const normalizedCompany = normalizeString(providedCompany);
  if (normalizedCompany) {
    return normalizedCompany;
  }

    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const isJson = (event.headers["content-type"] || "").includes("application/json");
    const body = isJson
      ? JSON.parse(event.body || "{}")
      : Object.fromEntries(new URLSearchParams(event.body || ""));

    const { name, email, phone, trade } = body; // 4 fields only
    if (!name || !email) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, error: "missing_fields" })
      };
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const now = new Date();
    const trialEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();

    // Create the account with minimal trial data
    const { data: acct, error: acctErr } = await supabase
      .from("accounts")
      .insert([{
        owner_name: name,
        owner_email: email,
        owner_phone: phone,
        industry: trade,
        plan_status: "trial",
        trial_minutes_used: 0,
        trial_start_at: now.toISOString(),
        trial_end_at: trialEnd,
        onboarding_step: "created"
      }])
      .select("account_id")
      .single();

    if (acctErr || !acct) {
      console.error("Insert account error:", acctErr);
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, error: "database_insert_failed" })
      };
    }

    // Create the owner user (best-effort)
    await supabase
      .from("users")
      .insert([{ account_id: acct.account_id, name, email, phone, role: "owner" }])
      .select()
      .single()
      .catch(() => ({}));

    // Optional provisioning webhook (Stripe + Vapi)
    if (process.env.PROVISION_WEBHOOK_URL) {
      fetch(process.env.PROVISION_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: acct.account_id,
          owner_name: name,
          owner_email: email,
          owner_phone: phone,
          industry: trade
        })
      }).catch(() => {});
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, accountId: acct.account_id })
    };
  } catch (e) {
    console.error("Unhandled error:", e);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: "internal_error" }) };
  }
};

export default handler;
