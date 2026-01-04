import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { extractCorrelationId, extractTraceId, logError, logInfo, logWarn, stepStart, stepEnd, stepError } from "../_shared/logging.ts";

type Json = Record<string, unknown>;

type VapiAssistant = { id: string } & Json;
type VapiNumber = { id: string; number?: string; phoneNumber?: string; country?: string } & Json;

type ProvisionPayload = {
  accountId: string;
  userId: string;
  companyName?: string;
  areaCode?: string;
};

const FUNCTION_NAME = "provision";
const DEFAULT_VOICE = { provider: "azure", voiceId: "en-US-JennyNeural" };
const DEFAULT_MODEL = { provider: "openai", model: "gpt-4o" };

const VAPI_BASE_URL = Deno.env.get("VAPI_BASE_URL") ?? "https://api.vapi.ai";
const VAPI_API_KEY = Deno.env.get("VAPI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !VAPI_API_KEY) {
  console.error(JSON.stringify({
    level: "error",
    functionName: FUNCTION_NAME,
    message: "Missing required environment variables",
    missing: {
      SUPABASE_URL: !SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !SUPABASE_SERVICE_ROLE_KEY,
      VAPI_API_KEY: !VAPI_API_KEY,
    },
  }));
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...corsHeaders,
    },
  });
}

async function vapi(path: string, init: RequestInit = {}) {
  const res = await fetch(`${VAPI_BASE_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${VAPI_API_KEY}`,
      ...(init.headers ?? {}),
    },
  });

  const text = await res.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }
  }

  if (!res.ok) {
    const errorMessage = typeof payload === "object" && payload !== null && "message" in payload
      ? String((payload as Record<string, unknown>).message)
      : text || res.statusText;
    throw new Error(`Vapi ${path} ${res.status}: ${errorMessage}`);
  }

  return payload as Json;
}

async function sb(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      apikey: SUPABASE_SERVICE_ROLE_KEY!,
      authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: "return=representation",
      ...(init.headers ?? {}),
    },
  });

  const text = await res.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!res.ok) {
    throw new Error(`Supabase ${path} ${res.status}: ${text || res.statusText}`);
  }

  return payload;
}

function pickFirst<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value.length ? value[0] : null) : value;
}

const nowISO = () => new Date().toISOString();

async function upsertJob(accountId: string, userId: string) {
  const existing = await sb(`/provisioning_jobs?account_id=eq.${accountId}&select=*`) as Json[] | null;
  const attempts = existing && existing.length ? Number(existing[0].attempts ?? 0) + 1 : 1;

  if (existing && existing.length) {
    const updated = await sb(`/provisioning_jobs?id=eq.${existing[0].id}`, {
      method: "PATCH",
      body: JSON.stringify({
        user_id: userId,
        status: "running",
        step: "create_assistant",
        error: null,
        attempts,
        updated_at: nowISO(),
      }),
    }) as Json[];
    return pickFirst(updated);
  }

  const created = await sb(`/provisioning_jobs`, {
    method: "POST",
    body: JSON.stringify({
      account_id: accountId,
      user_id: userId,
      status: "running",
      step: "create_assistant",
      attempts,
    }),
  }) as Json[];
  return pickFirst(created);
}

async function updateJob(jobId: string, patch: Record<string, unknown>) {
  await sb(`/provisioning_jobs?id=eq.${jobId}`, {
    method: "PATCH",
    body: JSON.stringify({ ...patch, updated_at: nowISO() }),
  });
}

async function upsertAssistantRecord(accountId: string, assistantId: string, config: Json) {
  const existing = await sb(`/vapi_assistants?account_id=eq.${accountId}&select=id`) as Json[] | null;
  if (existing && existing.length) {
    await sb(`/vapi_assistants?id=eq.${existing[0].id}`, {
      method: "PATCH",
      body: JSON.stringify({ vapi_assistant_id: assistantId, config }),
    });
    return;
  }

  await sb(`/vapi_assistants`, {
    method: "POST",
    body: JSON.stringify({ account_id: accountId, vapi_assistant_id: assistantId, config }),
  });
}

async function upsertNumberRecord(accountId: string, numberId: string, phone: string, country?: string | null) {
  const existing = await sb(`/vapi_numbers?account_id=eq.${accountId}&select=id`) as Json[] | null;
  if (existing && existing.length) {
    await sb(`/vapi_numbers?id=eq.${existing[0].id}`, {
      method: "PATCH",
      body: JSON.stringify({ vapi_number_id: numberId, phone_e164: phone, country: country ?? "US" }),
    });
    return;
  }

  await sb(`/vapi_numbers`, {
    method: "POST",
    body: JSON.stringify({
      account_id: accountId,
      vapi_number_id: numberId,
      phone_e164: phone,
      country: country ?? "US",
    }),
  });
}

async function fetchAccount(accountId: string) {
  const data = await sb(`/accounts?id=eq.${accountId}&select=id,vapi_assistant_id,vapi_number_id,phone_number_e164,company_name`) as Json[] | null;
  return data && data.length ? data[0] : null;
}

function ensurePayload(payload: unknown): asserts payload is ProvisionPayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("invalid_payload");
  }
  const { accountId, userId } = payload as ProvisionPayload;
  if (!accountId) throw new Error("missing_account_id");
  if (!userId) throw new Error("missing_user_id");
}

async function buyNumber(assistantId: string, areaCode: string | undefined, logContext: { functionName: string; correlationId: string; accountId: string }) {
  try {
    return await vapi("/phone-number/buy", {
      method: "POST",
      body: JSON.stringify({ assistantId, ...(areaCode ? { areaCode } : {}) }),
    }) as VapiNumber;
  } catch (error) {
    if (!areaCode) throw error;
    const message = error instanceof Error ? error.message : String(error);
    if (!/area code|no.*inventory|not available/i.test(message)) {
      throw error;
    }
    logWarn("Area code unavailable, retrying without area code", {
      ...logContext,
      context: { areaCode, message },
    });
    return await vapi("/phone-number/buy", {
      method: "POST",
      body: JSON.stringify({ assistantId }),
    }) as VapiNumber;
  }
}

serve(async (req) => {
  const correlationId = extractCorrelationId(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { ok: false, error: "method_not_allowed" });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !VAPI_API_KEY) {
    return json(500, { ok: false, error: "server_not_configured" });
  }

  let job: Json | null = null;
  let accountId: string | null = null;
  const traceId = extractTraceId(req);

  try {
    const payload = await req.json();
    ensurePayload(payload);

    accountId = payload.accountId;
    const userId = payload.userId;
    const companyName = payload.companyName ?? "RingSnap";
    const areaCode = payload.areaCode?.trim() || undefined;

    const baseLog = { functionName: FUNCTION_NAME, correlationId, accountId: accountId! };
    const base = { functionName: FUNCTION_NAME, traceId, accountId: accountId! };
    const provisionStart = Date.now();

    stepStart('provision_account', base, { userId, companyName, areaCode });

    logInfo("Starting provisioning job", {
      ...baseLog,
      context: { userId, companyName, areaCode },
    });

    const account = await fetchAccount(accountId);
    if (!account) {
      throw new Error("account_not_found");
    }

    job = await upsertJob(accountId, userId);
    const jobId = job?.id as string | undefined;

    let assistantId = account.vapi_assistant_id as string | undefined | null;

    if (!assistantId) {
      logInfo("Creating Vapi assistant", baseLog);
      const assistant = await vapi("/assistant", {
        method: "POST",
        body: JSON.stringify({
          name: `${companyName} Assistant`,
          model: DEFAULT_MODEL,
          voice: DEFAULT_VOICE,
          firstMessage: "Hi, thanks for calling. How can I help you today?",
          recordingEnabled: true,
        }),
      }) as VapiAssistant;
      assistantId = assistant.id;
      await upsertAssistantRecord(accountId, assistantId, assistant);
    } else {
      logInfo("Assistant already exists, ensuring record is stored", {
        ...baseLog,
        context: { assistantId },
      });
      const existingAssistantRecord = await sb(`/vapi_assistants?account_id=eq.${accountId}&select=id`) as Json[] | null;
      if (!existingAssistantRecord || !existingAssistantRecord.length) {
        await upsertAssistantRecord(accountId, assistantId, {});
      }
    }

    if (jobId) {
      await updateJob(jobId, { step: "create_number" });
    }

    let numberId = account.vapi_number_id as string | undefined | null;
    let phoneE164 = account.phone_number_e164 as string | undefined | null;

    if (!numberId || !phoneE164) {
      logInfo("Purchasing phone number", {
        ...baseLog,
        context: { areaCode, assistantId },
      });
      const purchased = await buyNumber(assistantId!, areaCode, baseLog);
      numberId = purchased.id;
      phoneE164 = purchased.number ?? purchased.phoneNumber ?? null;
      if (!phoneE164) {
        throw new Error("missing_phone_number");
      }
      await upsertNumberRecord(accountId, numberId, phoneE164, (purchased.country as string | undefined) ?? "US");
    } else {
      await upsertNumberRecord(accountId, numberId, phoneE164);
    }

    await sb(`/accounts?id=eq.${accountId}`, {
      method: "PATCH",
      body: JSON.stringify({
        vapi_assistant_id: assistantId,
        vapi_number_id: numberId,
        phone_number_e164: phoneE164,
        updated_at: nowISO(),
      }),
    });

    if (jobId) {
      await updateJob(jobId, { status: "succeeded", step: "done", error: null });
    }

    logInfo("Provisioning completed", {
      ...baseLog,
      context: { assistantId, numberId, phoneE164 },
    });

    stepEnd('provision_account', base, { result: 'success', assistantId, numberId }, provisionStart);

    return json(200, {
      ok: true,
      assistantId,
      number: phoneE164,
      jobId,
      correlationId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const base = { functionName: FUNCTION_NAME, traceId, accountId: accountId ?? undefined };

    stepError('provision_account', base, error, { reason_code: message });

    logError("Provisioning failed", {
      functionName: FUNCTION_NAME,
      correlationId,
      accountId: accountId ?? undefined,
      error,
    });

    if (job && job.id) {
      await updateJob(job.id as string, {
        status: "failed",
        step: "error",
        error: message,
      });
    }

    return json(400, { ok: false, error: message, correlationId });
  }
});
