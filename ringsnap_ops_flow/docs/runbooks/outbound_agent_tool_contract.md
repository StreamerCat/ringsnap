# Runbook: Outbound Voice Agent Tool Contract

## Background

On 2026-05-24, the [RingSnap Outbound Qualifier (Dallas)](https://dashboard.vapi.ai/assistants/e2329175-069b-457f-8984-0f2e62742ed8)
assistant collected only a mobile number from the prospect, told them
"text sent," but never produced a recorded tool result. The likely cause:
the assistant was wired to call `create_trial` (the full web-signup tool)
instead of the purpose-built outbound tool, so the call almost certainly
failed argument validation before any trial or checkout was created. (The
assistant's Vapi-side tool config had already been changed by the time this
was investigated, so the exact call-time argument schema isn't recoverable —
see the current schema below for what `create_trial` requires today.)

There are two separate, similarly-named tools/functions in this codebase.
**They are not interchangeable** — using the wrong one against an outbound
qualifier assistant will silently fail to create anything.

## The two tools

| | `create_trial` | `create_agent_trial` |
|---|---|---|
| Edge function | `supabase/functions/create-trial/index.ts` | `supabase/functions/create-agent-trial/index.ts` |
| Intended caller | Web signup flow (`/start`, onboarding chat) | Outbound voice agents only |
| Required fields | `name`, `email`, `phone`, `companyName`, `trade`, `paymentMethodId` (6 fields; see `createTrialSchema` in the edge function for the full optional field list — `website`, `zipCode`, `serviceArea`, `businessHours`, etc.) | `contactMobile`, `contactEmail`, `businessName` (`contactName`, `city`, `state` optional) |
| What it does | Creates Stripe customer + **paid** subscription, account, profile, and enqueues async provisioning (phone number + Vapi assistant) | Creates a **real, cardless** trial account — account, profile, async provisioning (phone number + Vapi assistant), welcome email — same as `create_trial` minus payment. A bare Stripe customer (no subscription, no card) is attached so the dashboard's existing "add a card" flow works later with zero changes |
| Data touched | `accounts`, `profiles`, `provisioning_jobs`, etc. | Same, plus `outbound_leads`/`outbound_checkout_log` for pipeline tracking |

**Card collection happens later, not on the call.** As of 2026-09-01, outbound trials are cardless by design — the prospect gets full trial access immediately, and a card is added from the dashboard before the 3-day trial ends (`pause-expired-cardless-trials` cron suspends any trial that expires without one — see `supabase/functions/pause-expired-cardless-trials/index.ts`). The outbound assistant should **never** ask for payment info on the call.

**SMS (`send_link`) is not part of the happy path.** It's only for a prospect who does *not* accept a trial live on the call and asks to be sent a signup link instead — never a follow-up to a successful `create_agent_trial` call.

## Rule

**Any Vapi assistant whose job is a quick outbound qualifying call (light
information gathering, not a full guided signup) must be bound to
`create_agent_trial`, never `create_trial`.** A voice call cannot collect
`create_trial`'s required `paymentMethodId` at all (there's no way to take a
card number safely over a live call), so the tool call was always going to
fail validation regardless of which other fields the script asked for —
that mismatch is what caused the 2026-05-24 incident.

`create_trial` is for the web signup flow only, where Stripe Elements
collects the payment method client-side. No voice assistant should ever be
bound to it, even to hand off to a real signup — `create_agent_trial`
creates the real trial account directly, with no card and no handoff
needed.

**Legacy note:** `stripe-webhook`'s `source === 'outbound_agent'` branch and
`create-trial`'s `isOutboundCheckoutMode` (`source: 'outbound_agent'` +
`stripeSessionId`) existed to adopt a completed Stripe Checkout session
from the old card-required `agent-trial-checkout` flow into a real account.
Since `create_agent_trial` no longer creates any Checkout session, that
code path (and `retry-outbound-account-creation`'s matching recovery sweep)
is now dead — nothing produces the events it's listening for. Left in
place rather than removed in the cardless-trial change, since ripping it
out touches `stripe-webhook`/`create-trial` (the most critical payment
paths in the app) for no functional benefit. Flag for cleanup if it's ever
confusing.

## Checklist when configuring or updating an outbound assistant in Vapi

- [ ] Confirm which tool the assistant is bound to (dashboard → assistant → tools) matches its actual data-collection scope
- [ ] Any voice assistant (outbound or inbound) → `create_agent_trial` (`create-agent-trial`) only. Never bind a voice assistant to `create_trial` — it requires a Stripe `paymentMethodId` that cannot be collected over a call
- [ ] The call script must collect an email, not just a mobile number — `create_agent_trial` needs it to create the account login (the old checkout-based tool didn't require this; the new cardless one does)
- [ ] System prompt confirms success to the caller only after a tool result confirms it — never unconditionally (e.g. not "trial started" as a scripted line, but "confirm only after create_agent_trial returns success; otherwise apologize and say a team member will follow up")
- [ ] After any assistant/tool change, place a test outbound call and verify a tool-result is recorded in the Vapi call log, not just the assistant's spoken claim

## References

- `supabase/functions/create-trial/index.ts` — full web signup (paid)
- `supabase/functions/create-agent-trial/index.ts` — outbound agent cardless trial tool (`create_agent_trial`)
- `supabase/functions/pause-expired-cardless-trials/index.ts` — suspends cardless trials that expire without a card
- `supabase/functions/trigger-outbound-calls/index.ts` — dials the Dallas Outbound Qualifier assistant (`VAPI_ASSISTANT_ID = e2329175-069b-457f-8984-0f2e62742ed8`) via cron
