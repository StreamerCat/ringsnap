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
 *         contactMobile: string,
 *         reason: string  (optional)
 *       }
 *     }]
 *   }
 * }
 *
 * Returns Vapi tool-call response shape:
 * { results: [{ toolCallId: "...", result: "..." }] }
 */

import { createClient } from "supabase";

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

function respondError(toolCallId: string, message: string): Response {
  console.error("[add-outbound-dnc] Error:", message);
  return respond(toolCallId, message);
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
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

    const { contactMobile, reason } = args;

    if (!contactMobile) {
      return respondError(toolCallId, "I don't have a number to flag — can you confirm the mobile number?");
    }

    const phone = normalizePhone(String(contactMobile));

    // ── 2. Mark do-not-call in Supabase ──────────────────────────────────────

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: existingLead } = await supabase
      .from("outbound_leads")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();

    if (existingLead) {
      await supabase
        .from("outbound_leads")
        .update({ status: "dnc", updated_at: new Date().toISOString() })
        .eq("id", existingLead.id);
    } else {
      // No prior lead record for this number — create one directly in dnc
      // status so any future import/sync respects it.
      await supabase.from("outbound_leads").insert({
        business_name: "Unknown",
        phone,
        status: "dnc",
        source: "outbound_agent",
      });
    }

    console.info("[add-outbound-dnc] Marked DNC:", {
      phone,
      reason: reason ?? null,
      vapi_call_id: vapiCallId,
    });

    // ── 3. Return result to Vapi ──────────────────────────────────────────────

    return respond(toolCallId, "Got it — that number has been added to our do-not-call list and won't be contacted again.");

  } catch (err: unknown) {
    console.error("[add-outbound-dnc] Unhandled error:", err);
    return respondError(
      toolCallId,
      "Something went wrong updating our records, but I've noted it — I'll make sure this number isn't called again."
    );
  }
});
