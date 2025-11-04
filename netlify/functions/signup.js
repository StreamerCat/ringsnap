const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    // Parse form or JSON
    const isJson = (event.headers["content-type"] || "").includes("application/json");
    const body = isJson
      ? JSON.parse(event.body || "{}")
      : Object.fromEntries(new URLSearchParams(event.body || ""));

    const {
      accountId,                 // optional; if not sent, we will create one
      owner_name,
      owner_email,
      owner_phone,
      industry,
      company_name,
      service_area,
      business_hours,
      emergency_policy
    } = body;

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Create or update the account row
    let account_id = accountId;
    if (!account_id) {
      const { data, error } = await supabase
        .from("accounts")
        .insert([{
          owner_name,
          owner_email,
          owner_phone,
          industry,
          company_name,
          service_area,
          business_hours,
          emergency_policy,
          plan_status: "trial",
          trial_minutes_used: 0,
          trial_start_at: new Date().toISOString(),
          trial_end_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          onboarding_step: "created"
        }])
        .select("account_id")
        .single();

      if (error) {
        console.error("Insert account error:", error);
        return { statusCode: 500, body: "Database insert failed" };
      }
      account_id = data.account_id;
    } else {
      const { error } = await supabase
        .from("accounts")
        .update({
          owner_name,
          owner_email,
          owner_phone,
          industry,
          company_name,
          service_area,
          business_hours,
          emergency_policy,
          plan_status: "trial",
          trial_minutes_used: 0,
          trial_start_at: new Date().toISOString(),
          trial_end_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          onboarding_step: "created"
        })
        .eq("account_id", account_id);

      if (error) {
        console.error("Update account error:", error);
        return { statusCode: 500, body: "Database update failed" };
      }
    }

    // Ensure an owner user exists (safe to attempt every time)
    await supabase
      .from("users")
      .insert([{
        account_id,
        name: owner_name,
        email: owner_email,
        phone: owner_phone,
        role: "owner"
      }])
      .select()
      .single()
      .catch(() => ({}));

    // Optional: kick off provisioning (Stripe customer + Vapi assistant)
    if (process.env.PROVISION_WEBHOOK_URL) {
      try {
        await fetch(process.env.PROVISION_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: account_id,
            owner_name,
            owner_email,
            owner_phone,
            industry,
            company_name,
            service_area,
            business_hours,
            emergency_policy
          })
        });
      } catch (e) {
        console.warn("Provision webhook failed (continuing):", e);
      }
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, accountId: account_id })
    };
  } catch (e) {
    console.error("Unhandled error:", e);
    return { statusCode: 500, body: "Internal error" };
  }
};
