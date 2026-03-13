# PostHog Data Warehouse Plan

## Overview

RingSnap's analytics stack combines PostHog events (primary behavioral signal)
with three external data sources: Stripe (revenue), Vapi (voice AI), and
Supabase's `analytics_events` table (server-side business events).

All four sources are joinable via shared entity keys.

---

## Source Map

### 1. PostHog Events (Primary)

All 23 custom events tracked client-side (via `posthog-js`) and server-side
(via Edge Function REST capture). PostHog is the primary measurement layer.

**Key events for warehouse queries:**
- Funnel: `form_started` → `form_submitted` → `checkout_started` → `checkout_completed` → `trial_activated` → `first_value_reached`
- Engagement: `dashboard_viewed`, `settings_saved`, `feature_used`
- Voice: `call_received`, `call_connected`, `call_ended`, `lead_qualified`, `call_failed`
- Errors: `error_encountered`

### 2. Stripe (Revenue)

Stripe data connects revenue to funnel events. Available sources:
- `checkout.session.completed` events (captured server-side in stripe-webhook → PostHog `checkout_completed` with `source: 'stripe_webhook'`)
- Subscription lifecycle: trial start, trial converted, churned, payment failed

**Connect in PostHog UI (Deferred):**
PostHog → Data Warehouse → Add Source → Stripe
Join key: `account_id` (stored as metadata on Stripe checkout sessions)

### 3. Vapi Webhook Logs

Voice AI call data captured server-side via `capturePostHog()` in
`supabase/functions/vapi-webhook/index.ts`.

Events: `call_received`, `call_connected`, `call_ended` (with `cogs_bucket`),
`lead_qualified`, `call_failed`

**Connect in PostHog UI (Deferred):**
PostHog → Data Warehouse → Add Source → Supabase (direct table access)
Tables: `calls` (if exists), or via Vapi dashboard API export

### 4. Supabase analytics_events

The existing `analytics_events` table in Supabase captures server-side
business events independently of PostHog. Available for direct SQL queries
and as a cross-reference source.

**Connect in PostHog UI (Deferred):**
PostHog → Data Warehouse → Add Source → Supabase
Table: `public.analytics_events`

---

## Join Keys

| Key | Description | Present In |
|-----|-------------|-----------|
| `account_id` | Supabase account UUID | PostHog group properties, Stripe metadata, vapi-webhook, analytics_events |
| `user_id` / `distinct_id` | Supabase user UUID (PostHog distinct_id after identify) | PostHog person properties |
| `call_id` | Vapi call ID (providerCallId) | `call_received`, `call_ended`, `lead_qualified`, Vapi webhook records |
| `session_id` | PostHog session | Automatically tracked by PostHog |
| `pending_signup_id` | Lead ID from capture-signup-lead (used before Supabase user created) | `form_submitted` distinct_id, `identify()` call in Start.tsx |
| `stripe_session_id` | Stripe checkout session ID | `checkout_completed` (source: stripe_webhook), Stripe API |

---

## Identity Lifecycle

```
Anonymous visitor
  → pending_signup_id (lead_id from /capture-signup-lead)   [form_submitted + identify()]
    → supabase_user_id (after create-trial)                  [identify() in OnboardingChat.tsx]
      → group('account', account_id)                         [CustomerDashboard, auth callbacks]
```

PostHog merges these via `identify()` calls. The `$anon_distinct_id` → `pending_signup_id`
merge happens at `form_submitted`. The `pending_signup_id` → `supabase_user_id` merge
happens at `checkout_completed` / `trial_activated` in OnboardingChat.

---

## Deferred PostHog UI Steps

The following cannot be configured in code and require PostHog UI access:

1. **Create PostHog project** and copy API key to `VITE_POSTHOG_KEY`
2. **Connect Stripe** via Data Warehouse → Sources → Stripe
3. **Connect Supabase** via Data Warehouse → Sources → Supabase (for analytics_events + calls tables)
4. **Activate PostHog workflow triggers** (see `docs/posthog-workflows/`)
5. **Set up dashboards**:
   - Signup funnel (form_started → first_value_reached)
   - Voice observability (call_received → lead_qualified, call_ended by cogs_bucket)
   - Revenue (checkout_completed, trial_activated, churn signals)
6. **Feature flag stubs** (create but leave at 100% rollout initially):
   - `hero-headline-test`
   - `pricing-layout-test`
   - `onboarding-flow-test`

---

## SQL Query Templates

See `docs/posthog-queries/` for 7 ready-to-use SQL templates.

These templates use PostHog's HogQL dialect (compatible with ClickHouse SQL)
and can be run in PostHog → SQL Editor or exported to the warehouse.
