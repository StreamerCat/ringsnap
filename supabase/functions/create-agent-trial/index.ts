/**
 * create-agent-trial
 *
 * Called by the Vapi Sarah outbound agent as a function tool when a
 * prospect accepts a trial live on the call. Creates a REAL trial account —
 * same as any other RingSnap trial (provisioned phone number + Vapi
 * assistant, welcome email) — with NO card collected during the call. The
 * card is added later from the dashboard; see
 * pause-expired-cardless-trials for what happens if it never is.
 *
 * Replaces the old agent-trial-checkout, which created a Stripe Checkout
 * session (card required) — that's no longer the outbound flow. If a
 * prospect doesn't accept a trial live and asks to be sent something
 * instead, that's send-outbound-link's job (send_link tool), not this one.
 *
 * Vapi tool-call request shape:
 * {
 *   message: {
 *     type: "tool-calls",
 *     call: { id: "..." },
 *     toolCallList: [{
 *       id: "...",
 *       name: "create_agent_trial",
 *       arguments: {
 *         contactName: string,
 *         contactEmail: string,     // required — Supabase auth needs an identifier
 *         contactMobile: string,    // required
 *         businessName: string,     // required
 *         city: string,             // optional, confirmed/corrected on the call
 *         state: string,            // optional
 *       }
 *     }]
 *   }
 * }
 *
 * Returns Vapi tool-call response shape:
 * { results: [{ toolCallId: "...", result: "..." }] }
 */

import { createClient } from "supabase";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno&deno-std=0.168.0";
import { logInfo, logError, extractCorrelationId } from "../_shared/logging.ts";
import { isVapiProvisioningEnabled } from "../_shared/provisioning-switch.ts";

const FUNCTION_NAME = "create-agent-trial";
const DEFAULT_PLAN_KEY = "core";

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const withCountry = digits.length === 10 ? "1" + digits : digits;
  return "+" + withCountry;
}

function generateSecurePassword(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function respond(toolCallId: string, result: string): Response {
  return new Response(
    JSON.stringify({ results: [{ toolCallId, result }] }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

function respondError(toolCallId: string, message: string, correlationId: string): Response {
  logError("create-agent-trial error", { functionName: FUNCTION_NAME, correlationId, context: { message } });
  return respond(toolCallId, message);
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
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

  // ── Auth: this is a public verify_jwt=false-equivalent (anon-key-gated)
  // endpoint, so require Vapi's configured tool secret header — the anon
  // key alone is public and does not authenticate Vapi.
  const vapiToolSecret = Deno.env.get("VAPI_TOOL_SECRET");
  if (!vapiToolSecret) {
    logError("VAPI_TOOL_SECRET not configured — refusing to run", { functionName: FUNCTION_NAME, correlationId });
    return respondError("unknown", "Something went wrong on our end. I'll have someone follow up with you directly.", correlationId);
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

    const { contactName, contactEmail, contactMobile, businessName, city, state } = args;

    if (!contactMobile || !contactEmail || !businessName) {
      return respondError(
        toolCallId,
        "I need their name, email, mobile number, and business name to set up the trial — can you confirm those?",
        correlationId
      );
    }

    const phone = normalizePhone(String(contactMobile));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── 2. Create the auth user + account ────────────────────────────────────
    //
    // public.handle_new_user_signup() fires on auth.users insert. It requires
    // `phone` in user_metadata — without it, it treats this as a staff signup
    // and creates NO account at all. It already sets subscription_status=
    // 'trial', trial_start_date=now(), trial_end_date=now()+3 days on the new
    // account, matching this flow's trial exactly, so nothing further needs
    // to be set for those fields.

    const tempPassword = generateSecurePassword();

    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email: contactEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        name: contactName || businessName,
        full_name: contactName || businessName,
        phone,
        company_name: businessName,
        source: "outbound_agent",
      },
    });

    if (userError || !userData?.user) {
      logError("Failed to create auth user", { functionName: FUNCTION_NAME, correlationId, error: userError });
      return respondError(toolCallId, "I couldn't get their trial started right now — I'll have someone follow up.", correlationId);
    }

    const userId = userData.user.id;

    // Trigger fires synchronously as part of the insert above, but give it a
    // moment before reading the profile it created — mirrors create-sales-account.
    await new Promise((r) => setTimeout(r, 1000));

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("account_id")
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !profile?.account_id) {
      logError("Profile/account not created by trigger", { functionName: FUNCTION_NAME, correlationId, error: profileError, context: { userId } });
      return respondError(toolCallId, "I couldn't get their trial started right now — I'll have someone follow up.", correlationId);
    }

    const accountId = profile.account_id;

    // ── 3. Bare Stripe customer (no subscription, no payment method) ────────
    //
    // Lets the existing dashboard "add a card" flow (stripe-setup-intent)
    // work later completely unmodified — it only needs stripe_customer_id
    // to be non-null, it doesn't care whether a subscription exists yet.

    let stripeCustomerId: string | null = null;
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (stripeKey) {
      try {
        const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16", httpClient: Stripe.createFetchHttpClient() });
        const customer = await stripe.customers.create({
          name: businessName,
          email: contactEmail,
          phone,
          metadata: { source: "outbound_agent", account_id: accountId, vapi_call_id: vapiCallId ?? "" },
        });
        stripeCustomerId = customer.id;
      } catch (err) {
        // Non-fatal — the account and trial are already real. The card-add
        // flow will fail until this is retried/fixed, but the trial itself
        // works. Log loudly so it gets noticed.
        logError("Failed to create bare Stripe customer (non-fatal)", { functionName: FUNCTION_NAME, correlationId, error: err, context: { accountId } });
      }
    } else {
      logError("STRIPE_SECRET_KEY not set — trial account created without a Stripe customer", { functionName: FUNCTION_NAME, correlationId, context: { accountId } });
    }

    const { error: updateError } = await supabase
      .from("accounts")
      .update({
        plan_key: DEFAULT_PLAN_KEY,
        stripe_customer_id: stripeCustomerId,
      })
      .eq("id", accountId);

    if (updateError) {
      logError("Failed to set plan_key/stripe_customer_id on account (non-fatal)", { functionName: FUNCTION_NAME, correlationId, error: updateError, context: { accountId } });
    }

    // ── 4. Enqueue provisioning (phone number + Vapi assistant) ─────────────

    const { error: jobError } = await supabase.from("provisioning_jobs").insert({
      account_id: accountId,
      user_id: userId,
      status: "queued",
      job_type: "provision_phone",
    });

    if (jobError && jobError.code !== "23505") {
      logError("Failed to enqueue provisioning job (non-fatal)", { functionName: FUNCTION_NAME, correlationId, error: jobError, context: { accountId } });
    } else {
      const provisioningEnabled = await isVapiProvisioningEnabled(userId, { functionName: FUNCTION_NAME, correlationId });
      if (provisioningEnabled) {
        supabase.functions.invoke("provision-vapi", { body: { triggered_by: "create-agent-trial" } }).catch((err) => {
          logError("Background provision-vapi invoke failed (non-fatal)", { functionName: FUNCTION_NAME, correlationId, error: err, context: { accountId } });
        });
      } else {
        logInfo("Provisioning paused; durable job remains queued", { functionName: FUNCTION_NAME, correlationId, context: { accountId } });
      }
    }

    // ── 5. Welcome email + internal notification (fire-and-forget) ──────────

    supabase.functions.invoke("send-welcome-email", {
      body: { email: contactEmail, name: contactName || businessName, userId },
    }).catch((err) => {
      logError("Background send-welcome-email invoke failed (non-fatal)", { functionName: FUNCTION_NAME, correlationId, error: err, context: { accountId } });
    });

    // ── 6. Log to outbound tables ─────────────────────────────────────────────

    try {
      const { data: existingLead } = await supabase
        .from("outbound_leads")
        .select("id")
        .eq("phone", phone)
        .maybeSingle();

      let leadId: string | null = existingLead?.id ?? null;
      if (leadId) {
        await supabase.from("outbound_leads").update({
          status: "trial_created",
          business_name: businessName,
          city: city ?? null,
          state: state ?? null,
          email: contactEmail,
          updated_at: new Date().toISOString(),
        }).eq("id", leadId);
      } else {
        const { data: newLead } = await supabase.from("outbound_leads").insert({
          business_name: businessName,
          phone,
          city: city ?? null,
          state: state ?? null,
          email: contactEmail,
          status: "trial_created",
          source: "outbound_agent",
        }).select("id").single();
        leadId = newLead?.id ?? null;
      }

      await supabase.from("outbound_checkout_log").insert({
        lead_id: leadId,
        phone,
        email: contactEmail,
        plan_key: DEFAULT_PLAN_KEY,
        status: "trial_created",
        account_id: accountId,
      });
    } catch (err) {
      logError("Outbound logging failed (non-fatal)", { functionName: FUNCTION_NAME, correlationId, error: err, context: { accountId } });
    }

    logInfo("Cardless trial created", { functionName: FUNCTION_NAME, correlationId, context: { accountId, userId, vapi_call_id: vapiCallId } });

    // ── 7. Return result to Vapi ──────────────────────────────────────────────

    return respond(
      toolCallId,
      `Their trial is live — no card needed. They'll get a welcome email with dashboard access at ${contactEmail} shortly, and their new number will be ready within a few minutes. Let them know they can add a card anytime from the dashboard before the trial ends.`
    );

  } catch (err: unknown) {
    logError("Unhandled error", { functionName: FUNCTION_NAME, correlationId, error: err });
    return respondError(
      toolCallId,
      "Something went wrong getting their trial set up. I'll have someone follow up with them directly.",
      correlationId
    );
  }
});
