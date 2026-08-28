# Trial Acquisition Health — PostHog Dashboard & Alerts (Config Reference)

This session has no PostHog API credentials, so the dashboard/alerts below are
documented as a build reference rather than created live. Create them in the
PostHog UI (Dashboards → New Dashboard → "Trial Acquisition Health") using
these insight definitions once the events below are flowing in staging.

## Event taxonomy shipped in this change

Server-side, verified events (never rely on the assistant's spoken output):

| Event | Fired from | Key properties |
|---|---|---|
| `outbound_trial_requested` | `agent-trial-checkout` (tool invoked) | `signup_channel`, `call_id`, `vapi_call_id`, `plan_key` |
| `outbound_trial_creation_attempted` | `agent-trial-checkout` (before Stripe calls) | same, `plan_key` |
| `outbound_trial_creation_succeeded` | `agent-trial-checkout` (after Stripe + DB) | `outcome=trial_created`, `duration_ms`, `sms_sent` |
| `outbound_trial_creation_failed` | `agent-trial-checkout` (validation / stripe config / db / unhandled) | `failure_stage`, `error_code`, `error_category`, `duration_ms` |
| `outbound_call_started` | `trigger-outbound-calls` (per lead dialed) | `lead_id`, `vapi_call_id`, `outcome` (on failure), `failure_stage` |
| `outbound_call_completed` | `add-outbound-dnc` (DNC outcome only, today) | `outcome=do_not_call` |
| `outbound_trial_creation_succeeded` (webhook echo) | `stripe-webhook` `checkout.session.completed` for `metadata.source=outbound_agent` | `account_linked=false` (see gap below) |

Existing website events (unchanged, already in production — see `src/lib/analytics.ts` and `create-trial/index.ts`): `form_started`, `lead_captured`, `trial_started`, `trial_created`/`signup_failed` (server), `onboarding_step_completed`, `checkout_started`/`checkout_completed`, `trial_activated`, `provisioning_completed`/`provisioning_failed`/`provisioning_timeout`.

**Not yet renamed to the exact task taxonomy** (`trial_form_viewed`, `trial_submit_attempted`, `trial_creation_succeeded`, `trial_creation_failed`, `trial_onboarding_started`, `trial_provisioning_succeeded`) — see "Remaining work" in the final report. Build funnel insights below against the *existing* names until that follow-up lands, or add thin additive aliases first.

Standardized properties used throughout: `signup_channel`, `lead_id`, `account_id`, `call_id`, `vapi_call_id`, `correlation_id`, `environment`, `outcome`, `failure_stage`, `error_code`, `error_category`, `http_status`, `function_name`, `duration_ms`.

## Dashboard insights to build

1. **Website signup funnel** — Funnel insight: `$pageview` (path=`/start`) → `form_started` → `lead_captured` → `trial_created` (server). Breakdown by `utm_source`.
2. **Outbound call-to-trial funnel** — Funnel insight: `outbound_call_started` → `outbound_trial_requested` → `outbound_trial_creation_attempted` → `outbound_trial_creation_succeeded`.
3. **Trial creation success rate by signup_channel** — Trends insight, formula `outbound_trial_creation_succeeded / (outbound_trial_creation_succeeded + outbound_trial_creation_failed)` and equivalent for website (`trial_created` vs `signup_failed`), breakdown by `signup_channel`.
4. **Failures by failure_stage / error_code / function** — Trends: `outbound_trial_creation_failed` + `signup_failed`, breakdown by `failure_stage`, then a second panel breakdown by `error_code`, third by `function_name`.
5. **Provisioning success rate** — Trends: `provisioning_completed` / (`provisioning_completed` + `provisioning_failed`).
6. **Recent failed trial attempts with correlation IDs** — Events table insight filtered to `signup_failed` OR `outbound_trial_creation_failed`, columns: timestamp, `correlation_id`/`call_id`, `failure_stage`, `error_code`.
7. **Outbound outcomes** — Trends: count of `outbound_call_started`/`outbound_call_completed` broken down by `outcome` (bar chart across the controlled enum).
8. **Median / p95 trial creation duration** — Trends insight on `duration_ms` from `outbound_trial_creation_succeeded` and `trial_created`, aggregation = median and p95, breakdown by `signup_channel`.

## Abandonment (no unload-event dependency)

Build a **Funnel with a conversion window** insight: `trial_form_started` (or existing `form_started`) → `trial_created` (server), conversion window 30 minutes. Users who enter step 1 but never reach step 2 within the window are the abandonment cohort — no client-side unload/beforeunload tracking required.

## Alerts (PostHog Alerts, where supported on your plan)

| Alert | Insight | Threshold |
|---|---|---|
| Any production trial creation failure | Trends: `signup_failed` + `outbound_trial_creation_failed`, `environment=production` | count > 0 in the alert's check window |
| 3+ failures within 15 minutes | Same insight, 15-min interval | count >= 3 |
| Trial success rate < 90% | Insight #3 above | value < 0.9, rolling 24h |
| Provisioning failure | `provisioning_failed` count | count > 0 |
| Outbound trial requested but no terminal event within 10 minutes | Requires a scheduled query (PostHog SQL insight or external job): `outbound_trial_requested` rows with no matching `outbound_trial_creation_succeeded`/`_failed` sharing `call_id` within 10 minutes | any row |

The last alert can't be expressed as a simple PostHog threshold alert (it's a join-with-time-window query) — implement it either as a PostHog SQL insight polling alert, or a small scheduled Supabase Edge Function job querying `outbound_call_log`/PostHog Query API and paging the team. Flagging as a config/ops task, not code shipped in this change.
