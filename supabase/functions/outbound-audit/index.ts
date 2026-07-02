/**
 * outbound-audit
 *
 * Read-only diagnostics for the cold outbound pipeline. Reports:
 *  - env-var PRESENCE for the secrets the outbound functions need (booleans only)
 *  - Vapi outbound assistant + tool config, sanitized (tool names, server URLs,
 *    header NAMES, whether a secret is set — never any credential values)
 *  - Vapi outbound phone number binding
 *  - Twilio from-number ownership/SMS capability + recent message statuses/error codes
 *
 * Never returns secret values. Safe to run repeatedly; makes no writes anywhere.
 */

const OUTBOUND_ASSISTANT_ID = "e2329175-069b-457f-8984-0f2e62742ed8";
const OUTBOUND_PHONE_NUMBER_ID = "7c61b25d-d31f-4216-b5fb-1a877f5cf2be";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// deno-lint-ignore no-explicit-any
function sanitizeTool(t: any) {
  return {
    type: t?.type ?? null,
    name: t?.function?.name ?? t?.name ?? null,
    serverUrl: t?.server?.url ?? t?.function?.server?.url ?? null,
    serverHasSecret: Boolean(t?.server?.secret),
    serverHeaderKeys: t?.server?.headers ? Object.keys(t.server.headers) : [],
    async: t?.async ?? null,
  };
}

Deno.serve(async (_req: Request) => {
  const out: Record<string, unknown> = {};

  // 1. Env presence (booleans only — never values)
  const envKeys = [
    "VAPI_API_KEY",
    "STRIPE_SECRET_KEY",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_PHONE_NUMBER",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  out.envPresent = Object.fromEntries(envKeys.map((k) => [k, Boolean(Deno.env.get(k))]));

  // 2. Vapi assistant + tools (sanitized)
  const vapiKey = Deno.env.get("VAPI_API_KEY");
  if (vapiKey) {
    const vapiHeaders = { Authorization: `Bearer ${vapiKey}` };
    try {
      const aRes = await fetch(`https://api.vapi.ai/assistant/${OUTBOUND_ASSISTANT_ID}`, { headers: vapiHeaders });
      if (!aRes.ok) {
        out.vapiAssistant = { error: `assistant fetch failed: ${aRes.status}` };
      } else {
        const a = await aRes.json();
        const toolIds: string[] = a?.model?.toolIds ?? [];
        const referencedTools = [];
        for (const id of toolIds) {
          const tRes = await fetch(`https://api.vapi.ai/tool/${id}`, { headers: vapiHeaders });
          referencedTools.push(tRes.ok ? { id, ...sanitizeTool(await tRes.json()) } : { id, error: `tool fetch failed: ${tRes.status}` });
        }
        out.vapiAssistant = {
          name: a?.name ?? null,
          model: a?.model?.model ?? null,
          assistantServerUrl: a?.server?.url ?? a?.serverUrl ?? null,
          assistantServerHasSecret: Boolean(a?.server?.secret ?? a?.serverUrlSecret),
          inlineTools: (a?.model?.tools ?? []).map(sanitizeTool),
          toolIds,
          referencedTools,
        };
      }
    } catch (e) {
      out.vapiAssistant = { error: String(e) };
    }

    try {
      const pRes = await fetch(`https://api.vapi.ai/phone-number/${OUTBOUND_PHONE_NUMBER_ID}`, { headers: vapiHeaders });
      if (!pRes.ok) {
        out.vapiPhoneNumber = { error: `phone-number fetch failed: ${pRes.status}` };
      } else {
        const p = await pRes.json();
        out.vapiPhoneNumber = {
          number: p?.number ?? null,
          provider: p?.provider ?? null,
          assistantId: p?.assistantId ?? null,
          status: p?.status ?? null,
        };
      }
    } catch (e) {
      out.vapiPhoneNumber = { error: String(e) };
    }
  } else {
    out.vapiAssistant = { error: "VAPI_API_KEY not set" };
  }

  // 3. Twilio from-number + recent message statuses
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const tok = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_PHONE_NUMBER");
  if (sid && tok) {
    const auth = "Basic " + btoa(`${sid}:${tok}`);
    try {
      if (from) {
        const nRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(from)}`,
          { headers: { Authorization: auth } },
        );
        if (nRes.ok) {
          const n = await nRes.json();
          const match = n?.incoming_phone_numbers?.[0];
          out.twilioFromNumber = {
            from,
            ownedByAccount: Boolean(match),
            smsCapable: match?.capabilities?.sms ?? null,
          };
        } else {
          out.twilioFromNumber = { from, error: `lookup failed: ${nRes.status}` };
        }
      } else {
        out.twilioFromNumber = { from: null, error: "TWILIO_PHONE_NUMBER not set" };
      }

      const mRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json?PageSize=5`,
        { headers: { Authorization: auth } },
      );
      if (mRes.ok) {
        const m = await mRes.json();
        // deno-lint-ignore no-explicit-any
        out.twilioRecentMessages = (m?.messages ?? []).map((x: any) => ({
          to: x.to,
          from: x.from,
          status: x.status,
          errorCode: x.error_code,
          dateCreated: x.date_created,
        }));
      } else {
        out.twilioRecentMessages = { error: `messages fetch failed: ${mRes.status}` };
      }
    } catch (e) {
      out.twilio = { error: String(e) };
    }
  } else {
    out.twilioFromNumber = { error: "TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not set" };
  }

  return json(out);
});
