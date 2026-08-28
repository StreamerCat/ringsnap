/**
 * add-outbound-dnc
 *
 * Called by the Vapi Sarah outbound agent as a function tool when a
 * prospect asks not to be contacted again. Marks the lead do-not-call
 * in outbound_leads. Does not touch accounts, profiles, or any product
 * tables.
 *
 * Vapi tool-call request shape:
 * {
 *   message: {
 *     type: "tool-calls",
 *     call: { id: "..." },
 *     toolCallList: [{
 *       id: "...",
 *       name: "add_to_dnc",
 *       arguments: {
 *         contactMobile: string,      // required — number to suppress
 *         businessName: string,       // optional
 *         reason: string              // optional, e.g. "asked to be removed"
 *       }
 *     }]
 *   }
 * }
 *
 * Returns Vapi tool-call response shape:
 * { results: [{ toolCallId: "...", result: "..." }] }
 */

import { createClient } from "supabase";
import { logInfo, logError, extractCorrelationId } from "../_shared/logging.ts";
import { captureServerEvent, flushServerAnalytics } from "../_shared/server-analytics.ts";

const FUNCTION_NAME = "add-outbound-dnc";

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const withCountry = digits.length === 10 ? "1" + digits : digits;
  return "+" + withCountry;
}

function respond(toolCallId: string, result: string): Response {
  return new Response(
    JSON.stringify({ results: [{ toolCallId, result }] }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

function respondError(toolCallId: string, message: string, correlationId: string): Response {
  logError("add-outbound-dnc error", { functionName: FUNCTION_NAME, correlationId, context: { message } });
  return respond(toolCallId, message);
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type, x-vapi-secret",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  const correlationId = extractCorrelationId(req);

  // ── Auth: this is a public verify_jwt=false endpoint, so require Vapi's
  // configured tool secret header — otherwise anyone who finds the URL could
  // mark arbitrary numbers dnc or spam outbound_leads with junk rows.
  const vapiToolSecret = Deno.env.get("VAPI_TOOL_SECRET");
  if (!vapiToolSecret) {
    logError("VAPI_TOOL_SECRET not configured — refusing to run", { functionName: FUNCTION_NAME, correlationId });
    return respondError("unknown", "Something went wrong on our end.", correlationId);
  }
  if (req.headers.get("x-vapi-secret") !== vapiToolSecret) {
    return respondError("unknown", "Unauthorized.", correlationId);
  }

  let toolCallId = "unknown";

  try {
    const body = await req.json();
    const toolCall = body?.message?.toolCallList?.[0];
    const vapiCallId = body?.message?.call?.id ?? null;

    if (!toolCall) {
      return respond("unknown", "No tool call found in request.");
    }

    toolCallId = toolCall.id ?? "unknown";
    const args = toolCall.arguments ?? {};

    // ── 1. Validate inputs ───────────────────────────────────────────────────

    const { contactMobile, businessName, reason } = args;

    if (!contactMobile) {
      return respondError(toolCallId, "I don't have a number to flag — can you confirm the mobile number?", correlationId);
    }

    const phone = normalizePhone(String(contactMobile));

    // ── 2. Mark do-not-call in Supabase ──────────────────────────────────────

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: existingLead, error: lookupError } = await supabase
      .from("outbound_leads")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();

    if (lookupError) {
      return respondError(toolCallId, "I couldn't update our records just now — please try again.", correlationId);
    }

    let writeError;
    if (existingLead) {
      ({ error: writeError } = await supabase
        .from("outbound_leads")
        .update({ status: "dnc", updated_at: new Date().toISOString() })
        .eq("id", existingLead.id));
    } else {
      // No prior lead record for this number — create one directly in dnc
      // status so any future import/sync respects it.
      ({ error: writeError } = await supabase.from("outbound_leads").insert({
        business_name: businessName ?? "Unknown",
        phone,
        status: "dnc",
        source: "outbound_agent",
      }));
    }

    if (writeError) {
      logError("Failed to write dnc status", { functionName: FUNCTION_NAME, correlationId, error: writeError });
      return respondError(toolCallId, "I couldn't update our records just now — please try again.", correlationId);
    }

    logInfo("Marked DNC", {
      functionName: FUNCTION_NAME,
      correlationId,
      context: { phone, reason: reason ?? null, vapi_call_id: vapiCallId },
    });

    await captureServerEvent("outbound_call_completed", vapiCallId ?? existingLead?.id ?? "unknown", {
      signup_channel: "outbound_agent",
      lead_id: existingLead?.id ?? null,
      call_id: vapiCallId,
      vapi_call_id: vapiCallId,
      correlation_id: correlationId,
      function_name: FUNCTION_NAME,
      outcome: "do_not_call",
    });
    await flushServerAnalytics();

    // ── 3. Return result to Vapi ──────────────────────────────────────────────

    return respond(toolCallId, "Got it — that number has been added to our do-not-call list and won't be contacted again.");

  } catch (err: unknown) {
    logError("Unhandled error", { functionName: FUNCTION_NAME, correlationId, error: err });
    return respondError(
      toolCallId,
      "Something went wrong updating our records, but I've noted it — I'll make sure this number isn't called again.",
      correlationId
    );
  }
});
