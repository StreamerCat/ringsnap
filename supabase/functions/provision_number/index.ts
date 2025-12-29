import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?target=deno";
import { extractCorrelationId, logError, logInfo, logWarn, withLogContext } from "../_shared/logging.ts";
import { corsHeaders } from "../_shared/cors.ts";

const FUNCTION_NAME = "provision_number";
const VAPI_BASE = "https://api.vapi.ai";
const POLL_TIMEOUT_MS = 20000;
const POLL_INTERVAL_MS = 1000;

interface ProvisionRequest {
  areaCode: string;
  accountId: string;
  assistantId?: string;
  workflowId?: string;
}

interface VapiPhoneResponse {
  id: string;
  status: "pending" | "active" | "failed";
  number?: string;
  areaCode?: string;
  [key: string]: unknown;
}

interface ProvisionResponse {
  status: "active" | "pending" | "failed";
  phone?: VapiPhoneResponse;
  phoneId?: string;
  number?: string;
  error?: string;
  details?: unknown;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isValidAreaCode = (code: string): boolean => /^\d{3}$/.test(code ?? "");

async function createPhoneNumber(
  areaCode: string,
  assistantId?: string,
  workflowId?: string,
  log: ReturnType<typeof withLogContext> = withLogContext({ functionName: FUNCTION_NAME, correlationId: "" })
): Promise<{ data: VapiPhoneResponse | null; error?: string }> {
  const vapiKey = Deno.env.get("VAPI_API_KEY");
  if (!vapiKey) {
    const error = "VAPI_API_KEY not configured";
    log.error(error);
    return { data: null, error };
  }

  const payload: Record<string, unknown> = {
    provider: "vapi",
    areaCode,
    name: `RingSnap ${areaCode}`,
  };

  if (assistantId) payload.assistantId = assistantId;
  if (workflowId) payload.workflowId = workflowId;

  try {
    const response = await fetch(`${VAPI_BASE}/phone-number`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${vapiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error("Vapi create failed", new Error(errorText), {
        status: response.status,
        areaCode
      });
      return {
        data: null,
        error: `Vapi API error: ${response.status}`,
      };
    }

    const data = await response.json();
    log.info("Phone number created on Vapi", { vapiId: data?.id, areaCode });
    return { data };
  } catch (err) {
    log.error("Failed to call Vapi create", err, { areaCode });
    return { data: null, error: String(err) };
  }
}

async function pollPhoneStatus(
  vapiId: string,
  log: ReturnType<typeof withLogContext> = withLogContext({ functionName: FUNCTION_NAME, correlationId: "" })
): Promise<{ data?: VapiPhoneResponse | null; error?: string }> {
  const vapiKey = Deno.env.get("VAPI_API_KEY");
  if (!vapiKey) {
    const error = "VAPI_API_KEY not configured";
    log.error(error);
    return { error };
  }

  const start = Date.now();
  let lastPhone: VapiPhoneResponse | null = null;

  while (Date.now() - start < POLL_TIMEOUT_MS) {
    try {
      const response = await fetch(`${VAPI_BASE}/phone-number/${vapiId}`, {
        headers: { Authorization: `Bearer ${vapiKey}` },
      });

      if (!response.ok) {
        log.warn("Vapi poll returned non-200", {
          status: response.status,
          vapiId
        });
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      lastPhone = await response.json();
      log.info("Polled Vapi phone status", { vapiId, status: lastPhone?.status });

      if (lastPhone?.status === "active") {
        return { data: lastPhone };
      }

      if (lastPhone?.status === "failed") {
        return {
          error: "Vapi provisioning failed on their end",
          data: lastPhone
        };
      }

      // Still pending, keep polling
      await sleep(POLL_INTERVAL_MS);
    } catch (err) {
      log.error("Error during polling", err, { vapiId });
      await sleep(POLL_INTERVAL_MS);
    }
  }

  // Timeout - return last known state or pending
  return { data: lastPhone || { status: "pending" } as VapiPhoneResponse };
}

serve(async (req) => {
  const correlationId = extractCorrelationId(req);
  const log = withLogContext({ functionName: FUNCTION_NAME, correlationId });

  // Log every request for debugging
  console.log("[provision_number] Request received:", req.method);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      console.error("[provision_number] Wrong method:", req.method);
      return new Response(JSON.stringify({ status: "failed", error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const body = await req.json();
    const { areaCode, accountId, assistantId, workflowId } = body as ProvisionRequest;

    console.log("[provision_number] Request body:", { areaCode, accountId });

    // Validation
    if (!isValidAreaCode(areaCode)) {
      console.error("[provision_number] Invalid area code:", areaCode);
      log.info("Invalid area code provided", { areaCode });
      return new Response(JSON.stringify({
        status: "failed",
        error: "Invalid area code. Must be 3 digits (e.g., 303)."
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!accountId || typeof accountId !== "string") {
      console.error("[provision_number] Invalid accountId:", accountId);
      return new Response(JSON.stringify({ status: "failed", error: "Missing or invalid accountId" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log("[provision_number] Validation passed, starting provisioning");
    log.info("Provisioning request started", { areaCode, accountId });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      console.error("[provision_number] Supabase credentials missing");
      log.error("Supabase credentials missing");
      return new Response(JSON.stringify({ status: "failed", error: "Server configuration error" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check VAPI_API_KEY upfront
    const vapiKey = Deno.env.get("VAPI_API_KEY");
    if (!vapiKey) {
      console.error("[provision_number] VAPI_API_KEY not configured");
      return new Response(JSON.stringify({
        status: "failed",
        error: "VAPI_API_KEY not configured. Please contact support."
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Mark account as provisioning
    await supabase.from("accounts").update({ provisioning_status: "provisioning" }).eq("id", accountId);

    // 1. Attempt Allocation from Pool
    let provisionedPhone: { id: string, vapiId: string, number: string, isNew: boolean } | null = null;

    const { data: allocated, error: allocError } = await supabase.rpc("allocate_pooled_phone_number", {
      p_account_id: accountId,
      p_area_code: areaCode
    });

    if (allocError) {
      log.error("Allocator RPC failed", allocError, { accountId });
      // Proceed to buy new? Or fail? Safe to proceed to buy new usually, but let's log loudly.
    }

    if (allocated && allocated.length > 0) {
      const poolPhone = allocated[0];
      log.info("Allocated phone from pool", { phoneId: poolPhone.id, vapiId: poolPhone.vapi_phone_id });

      // Bind to new assistant via Vapi PATCH
      try {
        const patchRes = await fetch(`${VAPI_BASE}/phone-number/${poolPhone.vapi_phone_id}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${vapiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            assistantId: assistantId,
            // Ensure name/label is updated?
          }),
        });

        if (!patchRes.ok) {
          const errText = await patchRes.text();
          throw new Error(`Vapi PATCH failed: ${errText}`);
        }

        provisionedPhone = {
          id: poolPhone.id,
          vapiId: poolPhone.vapi_phone_id,
          number: poolPhone.e164_number,
          isNew: false
        };
      } catch (err) {
        log.error("Failed to bind pooled phone", err, { vapiId: poolPhone.vapi_phone_id });
        // Release back to pool? Or Quarantine? For now, we fail.
        //Ideally transition strict to quarantine so we don't reuse broken phone.
        await supabase.from("accounts").update({
          provisioning_status: "failed",
          provisioning_error_code: "POOL_BIND_FAILED",
          provisioning_error_message: String(err)
        }).eq("id", accountId);

        return new Response(JSON.stringify({ status: "failed", error: "Failed to bind phone number" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    } else {
      // 2. Buy New Number (Legacy Logic)
      log.info("No pool number found, buying new", { areaCode });

      const { data: created, error: createError } = await createPhoneNumber(
        areaCode,
        assistantId,
        workflowId,
        log
      );

      if (createError || !created?.id) {
        await supabase.from("accounts").update({
          provisioning_status: "failed",
          provisioning_error_code: "BUY_FAILED",
          provisioning_error_message: createError
        }).eq("id", accountId);

        log.error("Phone creation failed", undefined, { accountId, error: createError });
        return new Response(JSON.stringify({ status: "failed", error: createError || "Failed to create phone number" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const vapiId = created.id;
      // Upsert new row
      const phoneNumberValue = created.number || `+1${areaCode}0000000`;

      const newRecord = {
        account_id: accountId,
        vapi_phone_id: vapiId,
        provider_phone_number_id: vapiId,
        phone_number: phoneNumberValue,
        e164_number: phoneNumberValue,
        area_code: areaCode,
        provider: "vapi",
        status: "active", // Vapi mostly returns active immediately or pending?
        is_primary: true,
        provisioning_attempts: 1,
        last_polled_at: new Date().toISOString(),
        activated_at: new Date().toISOString(), // Assuming active for now, verification gates completion
        lifecycle_status: "assigned",
        assigned_account_id: accountId,
        assigned_at: new Date().toISOString(),
        raw: created
      };

      const { data: inserted, error: upsertError } = await supabase
        .from("phone_numbers")
        .upsert(newRecord, { onConflict: "vapi_phone_id" })
        .select("id")
        .single();

      if (upsertError) {
        await supabase.from("accounts").update({
          provisioning_status: "failed",
          provisioning_error_code: "DB_WRITE_FAILED",
          provisioning_error_message: upsertError.message
        }).eq("id", accountId);
        return new Response(JSON.stringify({ status: "failed", error: "Database write failed" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      provisionedPhone = {
        id: inserted.id,
        vapiId: vapiId,
        number: phoneNumberValue,
        isNew: true
      };
    }

    // 3. VERIFICATION GATING
    // Loop to verify assistantId matches on Vapi GET
    const MAX_RETRIES = 3;
    let verified = false;
    let verificationError = null;

    for (let i = 0; i < MAX_RETRIES; i++) {
      await sleep(1000 * Math.pow(2, i)); // 1s, 2s, 4s

      try {
        const checkRes = await fetch(`${VAPI_BASE}/phone-number/${provisionedPhone.vapiId}`, {
          headers: { Authorization: `Bearer ${vapiKey}` },
        });
        const checkData = await checkRes.json();

        if (checkData.assistantId === assistantId) {
          verified = true;
          break;
        } else {
          console.warn(`[provision_number] Verification attempt ${i + 1} failed: assistantId mismatch`, {
            expected: assistantId,
            actual: checkData.assistantId
          });
        }
      } catch (err) {
        verificationError = err;
        console.warn(`[provision_number] Verification error attempt ${i + 1}`, err);
      }
    }

    if (!verified) {
      log.error("Vapi verification failed after retries", verificationError, { accountId, vapiId: provisionedPhone.vapiId });

      // Fail the provisioning
      await supabase.from("accounts").update({
        provisioning_status: "failed",
        provisioning_error_code: "VERIFICATION_FAILED",
        provisioning_error_message: "Phone number failed to bind to assistant",
        last_failed_step: "verification_loop"
      }).eq("id", accountId);

      return new Response(JSON.stringify({
        status: "failed",
        error: "Provisioning verification failed. Please contact support."
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 4. Final Success Update
    await supabase.from("accounts").update({
      provisioning_status: "active", // or 'completed'
      vapi_phone_number: provisionedPhone.number,
      phone_number_e164: provisionedPhone.number,
      vapi_phone_number_id: provisionedPhone.id,
      phone_provisioned_at: new Date().toISOString()
    }).eq("id", accountId);

    // Initial log success
    await supabase.from("provisioning_logs").insert({
      account_id: accountId,
      operation: "create_success",
      details: {
        vapiId: provisionedPhone.vapiId,
        phoneNumber: provisionedPhone.number,
        isPooled: !provisionedPhone.isNew
      }
    });

    return new Response(JSON.stringify({
      status: "active",
      phone: { number: provisionedPhone.number },
      phoneId: provisionedPhone.id,
      number: provisionedPhone.number
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[provision_number] Unhandled error:", err);
    log.error("Unhandled error in provision_number", err);
    return new Response(JSON.stringify({
      status: "failed",
      error: "Internal server error",
      details: String(err)
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
