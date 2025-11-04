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

const normalizeString = (value) => (typeof value === "string" ? value.trim() : "");

const buildSupabaseUrl = (baseUrl, path) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${normalizedBase}rest/v1/${path}`;
};

const createSupabaseRequest = (supabaseUrl, supabaseServiceRoleKey) => async (path, init = {}) => {
  if (typeof fetch !== "function") {
    throw new Error("Fetch API is unavailable in this environment");
  }

  const url = buildSupabaseUrl(supabaseUrl, path);
  const headers = {
    apikey: supabaseServiceRoleKey,
    Authorization: `Bearer ${supabaseServiceRoleKey}`,
    ...init.headers,
    "Content-Type": init.headers?.["Content-Type"] || init.headers?.["content-type"] || "application/json"
  };

  const response = await fetch(url, { ...init, headers });
  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch (error) {
      data = text;
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

  const domain = normalizeString(email).split("@")[1];
  if (!domain) {
    return "";
  }

  const label = domain.split(".")[0];
  return label ? label.replace(/[-_]/g, " ").replace(/\s+/g, " ") : "";
};

export const handler = async (event) => {
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

    const name = normalizeString(body?.name);
    const email = normalizeString(body?.email);
    const phone = normalizeString(body?.phone);
    const trade = normalizeString(body?.trade);
    const companyName = resolveCompanyName(email, body?.companyName);
    const wantsAdvancedVoice = Boolean(body?.wantsAdvancedVoice);

    if (!name || !email) {
      return jsonResponse(400, { ok: false, error: "missing_fields" });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("Missing Supabase service credentials");
      return jsonResponse(500, { ok: false, error: "configuration_error" });
    }

    const supabaseRequest = createSupabaseRequest(supabaseUrl, supabaseServiceRoleKey);

    const now = new Date();
    const trialEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    let accountId;

    try {
      const accountInsertResult = await supabaseRequest("accounts", {
        method: "POST",
        body: JSON.stringify([
          {
            owner_name: name,
            owner_email: email,
            owner_phone: phone || null,
            industry: trade || null,
            plan_status: "trial",
            trial_minutes_used: 0,
            trial_start_at: now.toISOString(),
            trial_end_at: trialEnd.toISOString(),
            onboarding_step: "created"
          }
        ]),
        headers: {
          Prefer: "return=representation"
        }
      });

      accountId = accountInsertResult?.[0]?.account_id || accountInsertResult?.[0]?.id;
    } catch (accountError) {
      console.error("Insert account error", accountError);
      return jsonResponse(500, { ok: false, error: "database_insert_failed" });
    }

    if (!accountId) {
      console.error("Account insert did not return an account_id");
      return jsonResponse(500, { ok: false, error: "database_insert_failed" });
    }

    try {
      await supabaseRequest("users", {
        method: "POST",
        body: JSON.stringify([
          {
            account_id: accountId,
            name,
            email,
            phone: phone || null,
            role: "owner"
          }
        ]),
        headers: {
          Prefer: "resolution=ignore-duplicates"
        }
      });
    } catch (userError) {
      console.warn("Unable to insert owner user", userError);
    }

    if (process.env.PROVISION_WEBHOOK_URL && typeof fetch === "function") {
      let controller = null;
      let timeout = null;

      if (typeof AbortController === "function") {
        controller = new AbortController();
        timeout = setTimeout(() => {
          try {
            controller.abort();
          } catch (abortError) {
            console.warn("Failed to abort provisioning webhook", abortError);
          }
        }, 5000);
      }

      fetch(process.env.PROVISION_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          owner_name: name,
          owner_email: email,
          owner_phone: phone || null,
          industry: trade || null,
          company_name: companyName || null,
          wantsAdvancedVoice
        }),
        signal: controller?.signal
      })
        .catch((webhookError) => {
          console.warn("Provisioning webhook failed", webhookError);
        })
        .finally(() => {
          if (timeout) {
            clearTimeout(timeout);
          }
        });
    }

    return jsonResponse(200, { ok: true, accountId });
  } catch (error) {
    console.error("Unhandled error in signup function", error);
    return jsonResponse(500, { ok: false, error: "internal_error" });
  }
};
