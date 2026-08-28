/**
 * agent-trial-checkout
 *
 * Called by the Vapi Sarah outbound agent as a function tool.
 * Creates a Stripe Checkout Session with a 3-day trial, SMSes the link
 * to the prospect, and logs everything to outbound_checkout_log.
 *
 * Completely separate from create-trial (web flow). Does not touch
 * accounts, profiles, or any product tables.
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
 *         contactEmail: string,
 *         contactMobile: string,
 *         businessName: string,
 *         planKey: "night_weekend" | "lite" | "core" | "pro"  (optional, defaults to "core")
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
import { captureServerEvent, captureServerException, flushServerAnalytics } from "../_shared/server-analytics.ts";

// ── Plan config (mirrors plans table) ────────────────────────────────────────

type PlanKey = "night_weekend" | "lite" | "core" | "pro";

const PLAN_PRICE_IDS: Record<PlanKey, { base: string; overage: string; label: string; cents: number }> = {
  night_weekend: {
    base: "price_1T6fHyIdevV48BnpkPU5FLeE",
    overage: "price_1T6fHzIdevV48BnpjMJWgiPW",
    label: "Night & Weekend",
    cents: 5900,
  },
  lite: {
    base: "price_1T6fHzIdevV48BnpaFZYlvbO",
    overage: "price_1T6fI0IdevV48Bnp0qJsKFuz",
    label: "Lite",
    cents: 12900,
  },
  core: {
    base: "price_1T6fI0IdevV48BnphRV8dnvO",
    overage: "price_1T6fI1IdevV48BnpHPSj8W03",
    label: "Core",
    cents: 22900,
  },
  pro: {
    base: "price_1T6fI1IdevV48Bnpn84ebIuz",
    overage: "price_1T6fI1IdevV48BnpMyJnSHFO",
    label: "Pro",
    cents: 44900,
  },
};

const VALID_PLAN_KEYS = Object.keys(PLAN_PRICE_IDS) as PlanKey[];
const DEFAULT_PLAN: PlanKey = "core";
const TRIAL_DAYS = 3;
const SITE_URL = "https://getringsnap.com";

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
  console.error("[agent-trial-checkout] Error:", message);
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
    const distinctId = vapiCallId ?? toolCallId;

    // ── 1. Validate inputs ───────────────────────────────────────────────────

    const { contactName, contactEmail, contactMobile, businessName } = args;
    let planKey: PlanKey = (args.planKey ?? DEFAULT_PLAN) as PlanKey;

    if (!VALID_PLAN_KEYS.includes(planKey)) {
      planKey = DEFAULT_PLAN;
    }

    await captureServerEvent("outbound_trial_requested", distinctId, {
      signup_channel: "outbound_agent",
      call_id: vapiCallId,
      vapi_call_id: vapiCallId,
      function_name: "agent-trial-checkout",
      plan_key: planKey,
      has_email: Boolean(contactEmail),
      has_business_name: Boolean(businessName),
    });

    if (!contactMobile) {
      await captureServerEvent("outbound_trial_creation_failed", distinctId, {
        signup_channel: "outbound_agent",
        call_id: vapiCallId,
        function_name: "agent-trial-checkout",
        outcome: "trial_failed",
        failure_stage: "validate_input",
        error_code: "MISSING_MOBILE",
      });
      return respondError(toolCallId, "I need a mobile number to send the link. Can you share yours?");
    }

    const phone = normalizePhone(String(contactMobile));

    // ── 2. Stripe: create customer + checkout session ─────────────────────────
    // Idempotency keys are derived from the Vapi tool-call id so a retried
    // tool call (network hiccup, Vapi re-invoke) reuses the same Stripe
    // customer/session instead of creating duplicates.

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      console.error("[agent-trial-checkout] STRIPE_SECRET_KEY not set");
      await captureServerEvent("outbound_trial_creation_failed", distinctId, {
        signup_channel: "outbound_agent",
        call_id: vapiCallId,
        function_name: "agent-trial-checkout",
        outcome: "trial_failed",
        failure_stage: "stripe_config",
        error_code: "STRIPE_KEY_MISSING",
      });
      return respondError(toolCallId, "Something went wrong on our end. I'll send you the signup link directly instead.");
    }

    await captureServerEvent("outbound_trial_creation_attempted", distinctId, {
      signup_channel: "outbound_agent",
      call_id: vapiCallId,
      function_name: "agent-trial-checkout",
      plan_key: planKey,
    });

    const _attemptStartedAt = Date.now();

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const plan = PLAN_PRICE_IDS[planKey];

    // Create Stripe customer (pre-populate email if provided)
    const customerParams: Stripe.CustomerCreateParams = {
      name: businessName ?? contactName ?? undefined,
      metadata: {
        source: "outbound_agent",
        vapi_call_id: vapiCallId ?? "",
        contact_name: contactName ?? "",
        business_name: businessName ?? "",
      },
    };
    if (contactEmail) customerParams.email = contactEmail;
    if (phone) customerParams.phone = phone;

    const customer = await stripe.customers.create(customerParams, {
      idempotencyKey: `agent-trial-checkout-customer-${toolCallId}`,
    });

    // Checkout session — trial, card required, pre-fill email
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      mode: "subscription",
      line_items: [
        { price: plan.base, quantity: 1 },
        { price: plan.overage },
      ],
      subscription_data: {
        trial_period_days: TRIAL_DAYS,
        metadata: {
          plan_key: planKey,
          source: "outbound_agent",
          vapi_call_id: vapiCallId ?? "",
        },
      },
      success_url: `${SITE_URL}/start?session_id={CHECKOUT_SESSION_ID}&source=agent`,
      cancel_url: `${SITE_URL}/start?canceled=true&source=agent`,
      metadata: {
        plan_key: planKey,
        source: "outbound_agent",
        vapi_call_id: vapiCallId ?? "",
        contact_name: contactName ?? "",
        business_name: businessName ?? "",
        contact_mobile: phone,
      },
    }, {
      idempotencyKey: `agent-trial-checkout-session-${toolCallId}`,
    });

    const checkoutUrl = session.url!;

    // ── 3. Send SMS via Twilio ────────────────────────────────────────────────

    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioFrom = Deno.env.get("TWILIO_PHONE_NUMBER");

    let smsSent = false;

    if (twilioSid && twilioToken && twilioFrom) {
      const firstName = ((contactName ?? businessName ?? "there") as string)
        .trim()
        .split(/\s+/)[0];

      const smsBody =
        `Hi ${firstName}! Here's your RingSnap secure signup link — ` +
        `free 3-day trial, card required but no charge during trial:\n\n${checkoutUrl}\n\n` +
        `Opens Stripe's secure checkout. Takes 30 seconds.`;

      try {
        const twilioRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: "Basic " + btoa(`${twilioSid}:${twilioToken}`),
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ From: twilioFrom, To: phone, Body: smsBody }),
          }
        );
        smsSent = twilioRes.ok;
        if (!twilioRes.ok) {
          const err = await twilioRes.json();
          console.error("[agent-trial-checkout] Twilio error:", err);
        }
      } catch (smsErr) {
        console.error("[agent-trial-checkout] SMS send failed:", smsErr);
      }
    } else {
      console.warn("[agent-trial-checkout] Twilio env vars missing — skipping SMS");
    }

    // ── 4. Log to Supabase ────────────────────────────────────────────────────

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Upsert lead record (find existing by phone or create new)
    let leadId: string | null = null;
    try {
      const { data: existingLead } = await supabase
        .from("outbound_leads")
        .select("id")
        .eq("phone", phone)
        .maybeSingle();

      if (existingLead) {
        leadId = existingLead.id;
        await supabase
          .from("outbound_leads")
          .update({ status: "checkout_sent", updated_at: new Date().toISOString() })
          .eq("id", leadId);
      } else {
        const { data: newLead } = await supabase
          .from("outbound_leads")
          .insert({
            business_name: businessName ?? contactName ?? "Unknown",
            phone,
            status: "checkout_sent",
            source: "outbound_agent",
          })
          .select("id")
          .single();
        leadId = newLead?.id ?? null;
      }

      // Log the checkout session
      await supabase.from("outbound_checkout_log").insert({
        lead_id: leadId,
        phone,
        email: contactEmail ?? null,
        stripe_session_id: session.id,
        stripe_customer_id: customer.id,
        plan_key: planKey,
        checkout_url: checkoutUrl,
        status: "created",
      });

      // Log SMS if sent
      if (smsSent && leadId) {
        await supabase.from("outbound_sms_log").insert({
          lead_id: leadId,
          phone,
          body: `Checkout link sent: ${checkoutUrl}`,
          status: "sent",
        });
      }
    } catch (dbErr) {
      // Non-fatal for the caller (checkout was created, SMS sent) but this
      // is the step that actually records the lead→trial conversion, so it
      // must be visible in monitoring rather than only console.error.
      console.error("[agent-trial-checkout] DB logging failed:", dbErr);
      await captureServerException(dbErr, distinctId, {
        signup_channel: "outbound_agent",
        call_id: vapiCallId,
        function_name: "agent-trial-checkout",
        failure_stage: "db_logging",
      });
      await captureServerEvent("outbound_trial_creation_failed", distinctId, {
        signup_channel: "outbound_agent",
        call_id: vapiCallId,
        function_name: "agent-trial-checkout",
        outcome: "trial_failed",
        failure_stage: "db_logging",
        error_category: "database",
        stripe_session_id_present: Boolean(session.id),
        duration_ms: Date.now() - _attemptStartedAt,
      });
    }

    await captureServerEvent("outbound_trial_creation_succeeded", distinctId, {
      signup_channel: "outbound_agent",
      call_id: vapiCallId,
      function_name: "agent-trial-checkout",
      outcome: "trial_created",
      plan_key: planKey,
      sms_sent: smsSent,
      duration_ms: Date.now() - _attemptStartedAt,
    });
    await flushServerAnalytics();

    // ── 5. Return result to Vapi ──────────────────────────────────────────────

    const planLabel = plan.label;
    const priceLabel = `$${(plan.cents / 100).toFixed(0)}/mo`;

    if (smsSent) {
      return respond(
        toolCallId,
        `Checkout link sent to ${phone}. ` +
        `It's the ${planLabel} plan at ${priceLabel} — 3-day free trial, card required but no charge during the trial. ` +
        `Tell them to check their texts and tap the link. It opens Stripe's secure checkout and takes about 30 seconds.`
      );
    } else {
      // SMS failed — give Sarah the URL to read out / direct them to the site
      return respond(
        toolCallId,
        `I had trouble sending the text. Have them go to getringsnap.com/start directly — ` +
        `or I can try again if they give me their mobile number.`
      );
    }

  } catch (err: unknown) {
    console.error("[agent-trial-checkout] Unhandled error:", err);
    const distinctId = toolCallId;
    await captureServerException(err, distinctId, {
      signup_channel: "outbound_agent",
      function_name: "agent-trial-checkout",
      failure_stage: "unhandled",
    });
    await captureServerEvent("outbound_trial_creation_failed", distinctId, {
      signup_channel: "outbound_agent",
      function_name: "agent-trial-checkout",
      outcome: "trial_failed",
      failure_stage: "unhandled",
      error_category: err instanceof Stripe.errors.StripeError ? "stripe" : "unknown",
      error_code: err instanceof Stripe.errors.StripeError ? err.code ?? err.type : undefined,
    });
    await flushServerAnalytics();
    return respondError(
      toolCallId,
      "Something went wrong creating the checkout. Have them go to getringsnap.com/start to sign up directly."
    );
  }
});
