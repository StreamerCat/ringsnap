# Outbound Pipeline Completion — 2026-07-02

Goal: get the first real outbound call + SMS out via the Sarah Vapi agent.
Live audit + fixes performed against Supabase project rmyvvbqnccpfeyowidrq.

## Done (verified live)

- [x] Live pipeline test of `agent-trial-checkout` with a synthetic Vapi tool-call
      payload (anon-key Authorization header, fired via pg_net). Result: Stripe
      customer + live checkout session created, `outbound_leads` +
      `outbound_checkout_log` rows written, `stripe-webhook` fired. SMS failed
      (see blockers).
- [x] Confirmed auth model: both outbound functions run `verify_jwt = true`; a
      `Authorization: Bearer <anon key>` header passes. Vapi tools must send it.
- [x] Recovered `send-outbound-link` deployed source (was dashboard-only) and
      committed it to the repo at `supabase/functions/send-outbound-link/index.ts`.
- [x] Built + deployed + verified `add-outbound-dnc` (v1). Marks
      `outbound_leads.status = 'dnc'` by phone, insert-if-missing. Test number
      +19705565583 is now marked dnc (protects owner's phone from the dialer).
- [x] Built + deployed `outbound-audit` (v1): read-only diagnostics — env-var
      presence booleans, sanitized Vapi assistant/tool config, Twilio from-number
      + recent message statuses. Never returns secret values.
- [x] Added the four outbound functions to `supabase/config.toml` with
      `verify_jwt = true` to codify live state.
- [x] Checked pg_cron: only `process-provisioning-jobs` exists — the outbound
      call schedule lives in n8n, not Postgres.

## Blockers (need Josh — cannot be done from this session)

- [ ] **Free an edge-function slot** — the project is at the 100-function cap
      (PaymentRequired on any deploy, even redeploys of existing functions).
      Either disable the spend cap / upgrade, or delete a few of the ~16 stale
      one-off debug functions in the dashboard (safe candidates, all deployed
      ad-hoc in Nov 2025–Jan 2026 and unreferenced in the repo:
      `invoke-send-magic-link-and-reset`, `send-magic-link-diagnostic`,
      `send-password-reset-diagnostic`, `send-password-reset-inspect`,
      `run-send-password-reset-diagnostic`, `run-send-password-reset-diagnostic-2`,
      `invoke-send-password-reset-diagnostic`, `debug-stripe-check`,
      `create-trial-source-dump`, `smoke-test`, `test-phone-lookup`,
      `test-webhook-lookup`, `check-vapi-status`, `repair-assistant-schema`,
      `apply-schema`). Once one slot is free, redeploy `outbound-audit` from the
      repo (it now includes the Vapi tool sync mode) and run
      `POST {"action":"sync","dryRun":true}` then `{"dryRun":false}`.

- [ ] **Set `TWILIO_PHONE_NUMBER` Supabase secret** — it is missing; this is the
      confirmed root cause of the SMS failure. Likely value: +16504126726
      (the outbound number). `supabase secrets set TWILIO_PHONE_NUMBER=+1650...`
- [ ] **Verify Twilio credentials** — the audit's read-only call to Twilio
      `Messages.json` returned 401 with the stored `TWILIO_ACCOUNT_SID` /
      `TWILIO_AUTH_TOKEN`. Either the token is stale/wrong, or the SID stored is
      an API-key SID rather than the account SID. If product SMS (OTP codes)
      currently works, compare which env vars those functions read.
- [ ] **Fix Vapi assistant tool wiring** — audit shows the assistant
      ("RingSnap Outbound Qualifier (Dallas)", gpt-4o-mini) has only ONE tool:
      `create_trial` pointing at the PRODUCT function
      `/functions/v1/create-trial` with no auth header. The intended tools
      (`create_agent_trial`, `send_link`, `add_to_dnc`, `end_call`) are not
      attached. Required per tool: server URL = the matching
      `/functions/v1/<fn>` endpoint, header `Authorization: Bearer <anon key>`.
      Detach/replace the `create_trial` tool — the outbound agent must not call
      the product web-flow function.
- [ ] **Fix Vapi assistant serverUrl** — currently
      `https://ringsnap.app.n8n.cloud/workflow/2IN9vYDsMx3SjIKj`, which is the
      n8n EDITOR page, not a webhook endpoint. End-of-call reports are being
      dropped. Point it at a real `https://ringsnap.app.n8n.cloud/webhook/...`
      URL (or the vapi-webhook function) once the n8n workflow is confirmed.
- [ ] **n8n verification** (no credentials available from this session):
      confirm both workflows exist and are wired; check credential status for
      Vapi API key, Supabase service role key, Google Sheets OAuth2, Twilio.
- [ ] **DST cron fix** — the outbound trigger schedule is in n8n. In the
      workflow's Settings, set the workflow timezone to `America/Denver` (or the
      calling region's timezone) and express the Schedule Trigger in local time,
      instead of a fixed UTC cron that drifts an hour across DST.

## Manual Vapi wiring spec (alternative to the sync function)

If you'd rather wire the tools in the Vapi dashboard than free a function slot,
configure the assistant (`e2329175-069b-457f-8984-0f2e62742ed8`) with exactly
these four tools and REMOVE the existing `create_trial` tool (it points at the
product create-trial function — the outbound agent must never call it):

Every function tool needs this server header (anon key is publishable, from
Supabase dashboard → Settings → API):
`Authorization: Bearer <anon key>`

1. `create_agent_trial` → `https://rmyvvbqnccpfeyowidrq.supabase.co/functions/v1/agent-trial-checkout`
   Parameters: contactName, contactEmail, contactMobile (required),
   businessName, planKey (enum: night_weekend | lite | core | pro)
2. `send_link` → `https://rmyvvbqnccpfeyowidrq.supabase.co/functions/v1/send-outbound-link`
   Parameters: contactMobile (required), contactName, businessName
3. `add_to_dnc` → `https://rmyvvbqnccpfeyowidrq.supabase.co/functions/v1/add-outbound-dnc`
   Parameters: contactMobile (required), businessName, reason
4. `end_call` → built-in End Call tool (no server config)

Exact JSON schemas for 1–3 are in
`supabase/functions/outbound-audit/index.ts` (`desiredFunctionTools`).
Verify afterward by POSTing `{}` to `/functions/v1/outbound-audit` with the
anon-key Authorization header and checking `referencedTools`.

## Deferred

- [ ] `claude-proxy` CORS function for the lead acquisition app — does not
      block outbound calling; needs a spec of what the app sends before building.
- [ ] `send-outbound-link` never logs to `outbound_sms_log` (unlike
      `agent-trial-checkout`) — SMS sends via that tool are invisible in the
      tables. Worth adding logging when next touching it.

## Review

Pipeline state after this session: everything downstream of Vapi is proven live
(Stripe, DB logging, DNC); the SMS leg fails only on the missing
`TWILIO_PHONE_NUMBER` secret (+ possible stale Twilio token); nothing upstream
can fire because the assistant's tools are miswired to the wrong function with
no auth header, and its server URL points at a non-endpoint. Fix the two Twilio
items + retarget the four tools and the first real outbound call/SMS should
work end to end.
