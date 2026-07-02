/**
 * add-outbound-dnc
 *
 * Called by the Vapi Sarah outbound agent as a function tool when a prospect
 * asks not to be contacted again. Marks the lead as DNC in outbound_leads so
 * the n8n dialer workflow skips them permanently.
 *
 * Touches ONLY outbound_leads. Never touches product tables.
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

    if (!toolCall) {
      return respond("unknown", "No tool call found in request.");
    }

    toolCallId = toolCall.id ?? "unknown";
    const args = toolCall.arguments ?? {};
    const { contactMobile, businessName, reason } = args;

    if (!contactMobile) {
      return respondError(toolCallId, "I need the phone number to add to the do-not-call list.");
    }

    const phone = normalizePhone(String(contactMobile));

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
      console.error("[add-outbound-dnc] Lookup failed:", lookupError);
      return respondError(toolCallId, "I couldn't update the do-not-call list right now. Flag this number for manual removal.");
    }

    if (existingLead) {
      const { error: updateError } = await supabase
        .from("outbound_leads")
        .update({ status: "dnc", updated_at: new Date().toISOString() })
        .eq("id", existingLead.id);

      if (updateError) {
        console.error("[add-outbound-dnc] Update failed:", updateError);
        return respondError(toolCallId, "I couldn't update the do-not-call list right now. Flag this number for manual removal.");
      }
    } else {
      const { error: insertError } = await supabase
        .from("outbound_leads")
        .insert({
          business_name: businessName ?? "Unknown (DNC request)",
          phone,
          status: "dnc",
          source: "outbound_agent",
        });

      if (insertError) {
        console.error("[add-outbound-dnc] Insert failed:", insertError);
        return respondError(toolCallId, "I couldn't update the do-not-call list right now. Flag this number for manual removal.");
      }
    }

    console.log("[add-outbound-dnc] Marked DNC:", { phone, reason: reason ?? null });

    return respond(
      toolCallId,
      `Done — ${phone} is on the do-not-call list and won't be contacted again. Apologize for the interruption and end the call politely.`
    );

  } catch (err: unknown) {
    console.error("[add-outbound-dnc] Unhandled error:", err);
    return respondError(
      toolCallId,
      "Something went wrong updating the do-not-call list. Flag this number for manual removal."
    );
  }
});
