/**
 * outbound-audit
 *
 * Diagnostics + config-as-code for the cold outbound pipeline.
 *
 * Default mode (POST {} or {"action":"audit"}): READ-ONLY report —
 *  - env-var PRESENCE for the secrets the outbound functions need (booleans only)
 *  - Vapi outbound assistant + tool config, sanitized (tool names, server URLs,
 *    header NAMES, whether a secret is set — never any credential values)
 *  - Vapi outbound phone number binding
 *  - Twilio from-number ownership/SMS capability + recent message statuses/error codes
 *
 * Sync mode (POST {"action":"sync","dryRun":true|false}, requires the
 * x-vapi-secret header matching VAPI_TOOL_SECRET): idempotently wires the
 * Sarah assistant's Vapi tools —
 *      create_agent_trial -> agent-trial-checkout
 *      send_link          -> send-outbound-link
 *      add_to_dnc         -> add-outbound-dnc
 *      end_call           -> built-in endCall tool
 * each function tool with an anon-key Authorization header (the outbound edge
 * functions run verify_jwt = true), attaches exactly those tools to
 * model.toolIds and detaches anything else (notably the miswired create_trial
 * tool that pointed at the PRODUCT create-trial function; the detached tool is
 * left in place in Vapi, just no longer referenced). Never touches the
 * assistant's serverUrl, prompt, voice, or model. dryRun defaults to TRUE and
 * only reports planned actions.
 *
 * Never returns secret values.
 */

const OUTBOUND_ASSISTANT_ID = "e2329175-069b-457f-8984-0f2e62742ed8";
const OUTBOUND_PHONE_NUMBER_ID = "7c61b25d-d31f-4216-b5fb-1a877f5cf2be";
const VAPI_BASE = "https://api.vapi.ai";

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

// ── Sync mode ─────────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
function desiredFunctionTools(functionsBase: string, authHeader: string, toolSecret: string): any[] {
  // secret: Vapi sends it as the x-vapi-secret header, which the outbound
  // functions require (the anon Authorization header only satisfies the
  // gateway's verify_jwt — it is public and does not authenticate Vapi).
  const server = (fn: string) => ({
    url: `${functionsBase}/${fn}`,
    secret: toolSecret,
    headers: { Authorization: authHeader },
  });
  return [
    {
      type: "function",
      function: {
        name: "create_agent_trial",
        description:
          "Create a 3-day free-trial Stripe checkout for the prospect and text them the secure signup link. Use once the prospect agrees to try RingSnap and has shared their mobile number.",
        parameters: {
          type: "object",
          properties: {
            contactName: { type: "string", description: "Prospect's full name" },
            contactEmail: { type: "string", description: "Prospect's email address, if shared" },
            contactMobile: { type: "string", description: "Prospect's mobile number to text the checkout link to" },
            businessName: { type: "string", description: "Prospect's business name" },
            city: { type: "string", description: "Prospect's city, as confirmed or corrected on the call" },
            state: { type: "string", description: "Prospect's US state (2-letter code or full name), as confirmed or corrected on the call" },
            planKey: {
              type: "string",
              enum: ["night_weekend", "lite", "core", "pro"],
              description: "Plan for the trial. Defaults to core if omitted.",
            },
          },
          required: ["contactMobile"],
        },
      },
      server: server("agent-trial-checkout"),
    },
    {
      type: "function",
      function: {
        name: "send_link",
        description:
          "Text the prospect the generic getringsnap.com/start signup link. Use when they want to sign up later on their own rather than through a checkout link.",
        parameters: {
          type: "object",
          properties: {
            contactMobile: { type: "string", description: "Prospect's mobile number to text the link to" },
            contactName: { type: "string", description: "Prospect's full name" },
            businessName: { type: "string", description: "Prospect's business name" },
          },
          required: ["contactMobile"],
        },
      },
      server: server("send-outbound-link"),
    },
    {
      type: "function",
      function: {
        name: "add_to_dnc",
        description:
          "Add the prospect's phone number to the do-not-call list. Use IMMEDIATELY whenever they ask not to be called again, then apologize and end the call.",
        parameters: {
          type: "object",
          properties: {
            contactMobile: { type: "string", description: "Phone number to suppress from all future outreach" },
            businessName: { type: "string", description: "Prospect's business name" },
            reason: { type: "string", description: "Short reason, e.g. 'asked to be removed'" },
          },
          required: ["contactMobile"],
        },
      },
      server: server("add-outbound-dnc"),
    },
  ];
}

async function runSync(req: Request, dryRun: boolean): Promise<Response> {
  // Sync mutates Vapi config — require the private tool secret. The anon key
  // that satisfies verify_jwt is public, so it must not gate this path.
  const toolSecret = Deno.env.get("VAPI_TOOL_SECRET");
  const provided = req.headers.get("x-vapi-secret");
  if (!toolSecret || !provided || provided !== toolSecret) {
    return json({ error: "unauthorized: sync requires the x-vapi-secret header matching VAPI_TOOL_SECRET" }, 401);
  }

  const vapiKey = Deno.env.get("VAPI_API_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!vapiKey || !anonKey || !supabaseUrl) {
    return json({ error: "VAPI_API_KEY / SUPABASE_ANON_KEY / SUPABASE_URL not available" }, 500);
  }

  const vapiHeaders = { Authorization: `Bearer ${vapiKey}`, "Content-Type": "application/json" };
  const functionsBase = `${supabaseUrl}/functions/v1`;
  const authHeader = `Bearer ${anonKey}`;
  const actions: unknown[] = [];

  try {
    const aRes = await fetch(`${VAPI_BASE}/assistant/${OUTBOUND_ASSISTANT_ID}`, { headers: vapiHeaders });
    if (!aRes.ok) return json({ error: `assistant fetch failed: ${aRes.status}` }, 502);
    const assistant = await aRes.json();
    const currentToolIds: string[] = assistant?.model?.toolIds ?? [];

    const listRes = await fetch(`${VAPI_BASE}/tool?limit=100`, { headers: vapiHeaders });
    if (!listRes.ok) return json({ error: `tool list failed: ${listRes.status}` }, 502);
    const allTools = await listRes.json();

    // deno-lint-ignore no-explicit-any
    const byName = new Map<string, any>();
    // deno-lint-ignore no-explicit-any
    for (const t of allTools as any[]) {
      const name = t?.function?.name ?? (t?.type === "endCall" ? "end_call" : null);
      if (name && !byName.has(name)) byName.set(name, t);
    }

    const finalToolIds: string[] = [];

    for (const desired of desiredFunctionTools(functionsBase, authHeader, toolSecret)) {
      const name = desired.function.name;
      const existing = byName.get(name);
      if (existing) {
        // Always PATCH: Vapi may not return server.secret / header values on
        // GET, so a "looks configured" tool can still carry a stale secret or
        // Authorization value. An unconditional PATCH is idempotent and
        // guarantees the live config matches the desired one.
        actions.push({ tool: name, action: "update", id: existing.id, serverUrl: desired.server.url });
        if (!dryRun) {
          const pRes = await fetch(`${VAPI_BASE}/tool/${existing.id}`, {
            method: "PATCH",
            headers: vapiHeaders,
            body: JSON.stringify({ function: desired.function, server: desired.server }),
          });
          if (!pRes.ok) return json({ error: `tool ${name} update failed: ${pRes.status} ${await pRes.text()}`, actions }, 502);
        }
        finalToolIds.push(existing.id);
      } else {
        actions.push({ tool: name, action: "create", serverUrl: desired.server.url });
        if (!dryRun) {
          const cRes = await fetch(`${VAPI_BASE}/tool`, {
            method: "POST",
            headers: vapiHeaders,
            body: JSON.stringify(desired),
          });
          if (!cRes.ok) return json({ error: `tool ${name} create failed: ${cRes.status} ${await cRes.text()}`, actions }, 502);
          const created = await cRes.json();
          finalToolIds.push(created.id);
        }
      }
    }

    const existingEndCall = byName.get("end_call");
    if (existingEndCall) {
      actions.push({ tool: "end_call", action: "unchanged", id: existingEndCall.id });
      finalToolIds.push(existingEndCall.id);
    } else {
      actions.push({ tool: "end_call", action: "create" });
      if (!dryRun) {
        const cRes = await fetch(`${VAPI_BASE}/tool`, {
          method: "POST",
          headers: vapiHeaders,
          body: JSON.stringify({ type: "endCall" }),
        });
        if (!cRes.ok) return json({ error: `endCall tool create failed: ${cRes.status} ${await cRes.text()}`, actions }, 502);
        const created = await cRes.json();
        finalToolIds.push(created.id);
      }
    }

    const detached = currentToolIds.filter((id) => !finalToolIds.includes(id));
    actions.push({
      action: "patch-assistant-toolIds",
      before: currentToolIds,
      after: dryRun ? "(ids known after create)" : finalToolIds,
      detached,
    });
    if (!dryRun) {
      const model = { ...assistant.model, toolIds: finalToolIds };
      delete model.tools; // referenced tools only; no inline duplicates
      const uRes = await fetch(`${VAPI_BASE}/assistant/${OUTBOUND_ASSISTANT_ID}`, {
        method: "PATCH",
        headers: vapiHeaders,
        body: JSON.stringify({ model }),
      });
      if (!uRes.ok) return json({ error: `assistant patch failed: ${uRes.status} ${await uRes.text()}`, actions }, 502);
    }

    return json({ dryRun, actions });
  } catch (e) {
    return json({ error: String(e), actions }, 500);
  }
}

// ── Audit mode ────────────────────────────────────────────────────────────────

async function runAudit(): Promise<Response> {
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
      const aRes = await fetch(`${VAPI_BASE}/assistant/${OUTBOUND_ASSISTANT_ID}`, { headers: vapiHeaders });
      if (!aRes.ok) {
        out.vapiAssistant = { error: `assistant fetch failed: ${aRes.status}` };
      } else {
        const a = await aRes.json();
        const toolIds: string[] = a?.model?.toolIds ?? [];
        const referencedTools = [];
        for (const id of toolIds) {
          const tRes = await fetch(`${VAPI_BASE}/tool/${id}`, { headers: vapiHeaders });
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
      const pRes = await fetch(`${VAPI_BASE}/phone-number/${OUTBOUND_PHONE_NUMBER_ID}`, { headers: vapiHeaders });
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
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  let action = "audit";
  let dryRun = true;
  try {
    const body = await req.json();
    if (body?.action === "sync") action = "sync";
    if (typeof body?.dryRun === "boolean") dryRun = body.dryRun;
  } catch {
    // no body — default to audit
  }

  if (action === "sync") return await runSync(req, dryRun);
  return await runAudit();
});
