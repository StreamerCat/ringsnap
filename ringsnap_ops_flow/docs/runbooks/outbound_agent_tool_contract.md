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
| Edge function | `supabase/functions/create-trial/index.ts` | `supabase/functions/agent-trial-checkout/index.ts` |
| Intended caller | Web signup flow (`/start`, onboarding chat) | Outbound voice agents only |
| Required fields | `name`, `email`, `phone`, `companyName`, `trade`, `paymentMethodId` (6 fields; see `createTrialSchema` in the edge function for the full optional field list — `website`, `zipCode`, `serviceArea`, `businessHours`, etc.) | `contactMobile` only (`contactName`, `contactEmail`, `businessName`, `planKey` optional) |
| What it does | Creates Stripe customer + subscription, account, profile, and enqueues async provisioning (phone number + Vapi assistant) | Creates a Stripe Checkout session with a 3-day trial and SMSes the link. Does **not** touch `accounts`/`profiles`/provisioning — it's a lightweight "send them a link" tool |
| Data touched | `accounts`, `profiles`, `provisioning_jobs`, etc. | `outbound_leads`, `outbound_checkout_log`, `outbound_sms_log` only |

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
bound to it. If a future assistant needs to hand off to a real signup, use
`create_agent_trial` to text a Stripe Checkout link instead (as it already
does) — never try to complete `create_trial` inline on a call.

## Checklist when configuring or updating an outbound assistant in Vapi

- [ ] Confirm which tool the assistant is bound to (dashboard → assistant → tools) matches its actual data-collection scope
- [ ] Any voice assistant (outbound or inbound) → `create_agent_trial` (`agent-trial-checkout`) only. Never bind a voice assistant to `create_trial` — it requires a Stripe `paymentMethodId` that cannot be collected over a call
- [ ] System prompt confirms success to the caller only after a tool result confirms it — never unconditionally (e.g. not "text sent" as a scripted line, but "confirm only after create_agent_trial returns success; otherwise apologize and say a team member will follow up")
- [ ] After any assistant/tool change, place a test outbound call and verify a tool-result is recorded in the Vapi call log, not just the assistant's spoken claim

## References

- `supabase/functions/create-trial/index.ts` — full web signup
- `supabase/functions/agent-trial-checkout/index.ts` — outbound agent checkout tool (`create_agent_trial`)
- `supabase/functions/trigger-outbound-calls/index.ts` — dials the Dallas Outbound Qualifier assistant (`VAPI_ASSISTANT_ID = e2329175-069b-457f-8984-0f2e62742ed8`) via cron
