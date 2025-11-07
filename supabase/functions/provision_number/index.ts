import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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
      log.warn("Error during polling", err, { vapiId });
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
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!accountId || typeof accountId !== "string") {
      console.error("[provision_number] Invalid accountId:", accountId);
      return new Response(JSON.stringify({ status: "failed", error: "Missing or invalid accountId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log("[provision_number] Validation passed, starting provisioning");
    log.info("Provisioning request started", { areaCode }, accountId);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      console.error("[provision_number] Supabase credentials missing");
      log.error("Supabase credentials missing");
      return new Response(JSON.stringify({ status: "failed", error: "Server configuration error" }), {
        status: 500,
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
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    console.log("[provision_number] VAPI_API_KEY found");

    // Mark account as provisioning
    console.log("[provision_number] Updating account status to provisioning");
    const updateRes = await supabase
      .from("accounts")
      .update({ provisioning_status: "provisioning" })
      .eq("id", accountId);

    if (updateRes.error) {
      console.error("[provision_number] Failed to update account:", updateRes.error);
      log.error("Failed to update account status", updateRes.error, { accountId });
      return new Response(JSON.stringify({ status: "failed", error: "Database error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    console.log("[provision_number] Account status updated");

    // Log provisioning start
    await supabase.from("provisioning_logs").insert({
      account_id: accountId,
      operation: "create_started",
      details: { areaCode, assistantId, workflowId }
    });

    // Create phone number on Vapi
    console.log("[provision_number] Creating phone number on Vapi");
    const { data: created, error: createError } = await createPhoneNumber(
      areaCode,
      assistantId,
      workflowId,
      log
    );

    console.log("[provision_number] Vapi creation result:", { created, createError });

    if (createError || !created?.id) {
      console.error("[provision_number] Phone creation failed:", createError);
      log.error("Phone creation failed", undefined, { accountId, error: createError });

      // Mark as failed
      await supabase.from("accounts").update({ provisioning_status: "failed" }).eq("id", accountId);

      await supabase.from("provisioning_logs").insert({
        account_id: accountId,
        operation: "create_failed",
        details: { areaCode, error: createError }
      });

      return new Response(JSON.stringify({
        status: "failed",
        error: createError || "Failed to create phone number"
      }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const vapiId = created.id;
    console.log("[provision_number] Phone created on Vapi:", vapiId);

    // Poll for activation
    console.log("[provision_number] Starting polling for phone activation");
    const { data: finalPhone, error: pollError } = await pollPhoneStatus(vapiId, log);

    console.log("[provision_number] Polling result:", { finalPhone, pollError });

    if (pollError) {
      console.warn("[provision_number] Poll ended with error:", pollError);
      log.warn("Poll ended with error", {
        vapiId,
        error: pollError
      });
    }

    const finalStatus = finalPhone?.status ?? "pending";
    console.log("[provision_number] Final status:", finalStatus);

    // Upsert phone record
    console.log("[provision_number] Upserting phone record");
    const phoneRecord = {
      account_id: accountId,
      vapi_id: vapiId,
      phone_number: finalPhone?.number || `+1${areaCode}0000000`,
      area_code: areaCode,
      provider: "vapi",
      status: finalStatus,
      provisioning_attempts: 1,
      last_polled_at: new Date().toISOString(),
      activated_at: finalStatus === "active" ? new Date().toISOString() : null,
      raw: finalPhone
    };

    const { data: inserted, error: upsertError } = await supabase
      .from("phone_numbers")
      .upsert(phoneRecord, { onConflict: "vapi_id" })
      .select()
      .single();

    console.log("[provision_number] Upsert result:", { inserted, upsertError });

    if (upsertError) {
      console.error("[provision_number] Failed to upsert phone record:", upsertError);
      log.error("Failed to upsert phone record", upsertError, { accountId });
      await supabase.from("accounts").update({ provisioning_status: "failed" }).eq("id", accountId);
      return new Response(JSON.stringify({ status: "failed", error: "Database write failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Update account with phone link
    const accountUpdateStatus = finalStatus === "active" ? "active" : "pending";

    console.log("[provision_number] Updating account with phone info");
    await supabase
      .from("accounts")
      .update({
        provisioning_status: accountUpdateStatus,
        vapi_phone_number_id: inserted?.id,
        phone_provisioned_at: finalStatus === "active" ? new Date().toISOString() : null
      })
      .eq("id", accountId);

    // Log success
    await supabase.from("provisioning_logs").insert({
      account_id: accountId,
      operation: "create_success",
      details: {
        vapiId,
        phoneNumber: finalPhone?.number,
        status: finalStatus
      }
    });

    log.info("Provisioning completed", {
      status: finalStatus,
      number: finalPhone?.number
    }, accountId);

    console.log("[provision_number] Provisioning complete, returning response");

    // Return response
    if (finalStatus === "active") {
      console.log("[provision_number] Returning active status with number:", finalPhone?.number);
      return new Response(JSON.stringify({
        status: "active",
        phone: finalPhone,
        phoneId: inserted?.id,
        number: finalPhone?.number
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } else {
      console.log("[provision_number] Returning pending status");
      return new Response(JSON.stringify({
        status: "pending",
        phone: finalPhone,
        phoneId: inserted?.id,
        error: "Phone is still provisioning. You will be notified when ready."
      }), {
        status: 202,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  } catch (err) {
    console.error("[provision_number] Unhandled error:", err);
    log.error("Unhandled error in provision_number", err);
    return new Response(JSON.stringify({
      status: "failed",
      error: "Internal server error",
      details: String(err)
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
