# Runbook: Outbound Voice Agent Tool Contract

## Background

On 2026-05-24, the [RingSnap Outbound Qualifier (Dallas)](https://dashboard.vapi.ai/assistants/e2329175-069b-457f-8984-0f2e62742ed8)
assistant collected only a mobile number from the prospect, told them
"text sent," but never produced a recorded tool result. The likely cause:
the assistant was wired to call `create_trial` (the full web-signup tool,
which requires `businessName`, `niche`, `city`, `state`, `contactName`,
`businessPhone`, and `contactEmail`) instead of the purpose-built outbound
tool, so the call almost certainly failed argument validation before any
trial or checkout was created.

There are two separate, similarly-named tools/functions in this codebase.
**They are not interchangeable** — using the wrong one against an outbound
qualifier assistant will silently fail to create anything.

## The two tools

| | `create_trial` | `create_agent_trial` |
|---|---|---|
| Edge function | `supabase/functions/create-trial/index.ts` | `supabase/functions/agent-trial-checkout/index.ts` |
| Intended caller | Web signup flow (`/start`, onboarding chat) | Outbound voice agents only |
| Required fields | `businessName`, `niche`, `city`, `state`, `contactName`, `businessPhone`, `contactEmail` (7 fields; `contactMobile` optional) | `contactMobile` only (`contactName`, `contactEmail`, `businessName`, `planKey` optional) |
| What it does | Creates Stripe customer + subscription, account, profile, and enqueues async provisioning (phone number + Vapi assistant) | Creates a Stripe Checkout session with a 3-day trial and SMSes the link. Does **not** touch `accounts`/`profiles`/provisioning — it's a lightweight "send them a link" tool |
| Data touched | `accounts`, `profiles`, `provisioning_jobs`, etc. | `outbound_leads`, `outbound_checkout_log`, `outbound_sms_log` only |

## Rule

**Any Vapi assistant whose job is a quick outbound qualifying call (light
information gathering, not a full guided signup) must be bound to
`create_agent_trial`, never `create_trial`.** An outbound call script is
not going to naturally collect all 7 fields `create_trial` requires — trying
to force that fit is what caused the 2026-05-24 incident.

If a future assistant genuinely needs the full `create_trial` contract
(e.g., a more thorough inbound/guided-signup voice flow), it must be
scripted to actually collect all 7 required fields before calling the tool,
and its prompt must gate any "you're all set" / "text sent" language on the
tool call actually returning success — never assert an action succeeded
without a confirmed tool result.

## Checklist when configuring or updating an outbound assistant in Vapi

- [ ] Confirm which tool the assistant is bound to (dashboard → assistant → tools) matches its actual data-collection scope
- [ ] Outbound qualifier / lead-gen assistants → `create_agent_trial` (`agent-trial-checkout`)
- [ ] Full guided-signup assistants → `create_trial`, only if the script collects all 7 required fields
- [ ] System prompt confirms success to the caller only after a tool result confirms it — never unconditionally (e.g. not "text sent" as a scripted line, but "confirm only after create_agent_trial/create_trial returns success; otherwise apologize and say a team member will follow up")
- [ ] After any assistant/tool change, place a test outbound call and verify a tool-result is recorded in the Vapi call log, not just the assistant's spoken claim

## References

- `supabase/functions/create-trial/index.ts` — full web signup
- `supabase/functions/agent-trial-checkout/index.ts` — outbound agent checkout tool (`create_agent_trial`)
- `supabase/functions/trigger-outbound-calls/index.ts` — dials the Dallas Outbound Qualifier assistant (`VAPI_ASSISTANT_ID = e2329175-069b-457f-8984-0f2e62742ed8`) via cron
