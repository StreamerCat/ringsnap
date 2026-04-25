# RingSnap — Technical Architecture
_Source of truth derived from codebase. Generated 2026-04-25._

---

## Overview

RingSnap is an AI receptionist SaaS for home-services contractors. It provisions a dedicated phone number and Vapi voice-AI assistant per customer account, handles inbound calls 24/7, books appointments, and routes leads. Customers sign up, choose a plan, forward their business line to their RingSnap number, and manage everything via a web dashboard.

**Status indicators used in this document:**
- ✅ CONFIRMED — seen directly in source code
- ⚠️ INFERRED — logical conclusion from code patterns
- ❓ UNKNOWN — not determinable from static analysis

---

## Stack

| Layer | Technology | Source |
|---|---|---|
| Frontend framework | React 18.3.1 + TypeScript | `package.json` |
| Build tool | Vite 5.4.21 + SWC | `vite.config.ts` |
| Styling | Tailwind CSS + shadcn/ui (Radix primitives) | `tailwind.config.ts`, `components.json` |
| State / data fetching | TanStack Query v5 | `package.json` |
| Forms | react-hook-form + Zod | `package.json` |
| Routing | react-router-dom v6 | `src/App.tsx` |
| Auth | Supabase Auth (magic link, Google OAuth, phone OTP) | `src/lib/auth/` |
| Database | Supabase PostgreSQL (hosted) | `supabase/config.toml` |
| Backend logic | Supabase Edge Functions (Deno TypeScript, 73+ functions) | `supabase/functions/` |
| Voice AI | Vapi | `supabase/functions/provision-vapi/`, `src/lib/VapiWidgetContext.tsx` |
| Phone provisioning | Twilio (via `_shared/telephony.ts`) | `supabase/functions/_shared/telephony.ts` |
| Billing | Stripe (Checkout, subscriptions, usage records) | `supabase/functions/stripe-webhook/`, `src/lib/billing/` |
| Email | Resend | `supabase/functions/_shared/resend-client.ts` |
| Analytics | PostHog (frontend + server-side) | `src/lib/analytics.ts`, `supabase/functions/_shared/posthog.ts` |
| Error tracking | Sentry (React + Edge Functions) | `src/main.tsx`, `supabase/functions/_shared/sentry.ts` |
| Deployment — frontend | Netlify | `netlify.toml` |
| Deployment — backend | Supabase hosted (Edge Functions + DB) | `supabase/config.toml` |
| Package manager | npm (bun also referenced in netlify.toml build cmd) | `package.json`, `netlify.toml` |

---

## Frontend

### Entry & Routing
- **Entry point:** `src/main.tsx` — initializes Sentry, PostHog, renders `<App />`
- **Router:** `src/App.tsx` — 57+ routes; `Index.tsx` eagerly loaded; all others via `React.lazy()` with `<Suspense>` fallback
- **Auth guard HOC:** `withAuthGuard(Component)` from `src/lib/auth/useUser.tsx`
- **Protected routes:** `/dashboard` → `withAuthGuard(CustomerDashboard)`, `/admin` → `withAuthGuard(AdminControl)` (staff roles only)
- **Analytics:** `RouteTracker` in `App.tsx` fires `page_viewed` PostHog events on every navigation

### Key Directories
```
src/
├── pages/           # One file per route (~50 pages)
├── components/
│   ├── ui/          # shadcn/ui primitives — DO NOT EDIT
│   ├── dashboard/   # Dashboard tab components
│   ├── onboarding/  # Onboarding wizard + chat components
│   ├── admin/       # Admin panel components
│   ├── marketing/   # Landing page components
│   ├── signup/      # Signup flow components
│   ├── trades/      # Trade-specific components
│   ├── compare/     # Competitor comparison components
│   └── resources/   # Resource center components
├── lib/
│   ├── supabase.ts         # Supabase browser client (anon key)
│   ├── featureFlags.ts     # 18 env-var-controlled feature flags
│   ├── analytics.ts        # PostHog wrapper
│   ├── auth/               # useUser hook, roles, redirects, session
│   └── billing/            # dashboardPlans.ts — plan definitions & helpers
├── hooks/           # Custom React hooks
├── types/           # Shared TS types (call-log, assistant-config, integrations)
└── integrations/supabase/
    ├── client.ts    # Typed Supabase client export
    └── types.ts     # Auto-generated DB schema types (DO NOT EDIT)
```

### Feature Flags (✅ CONFIRMED — `src/lib/featureFlags.ts`)
All flags parsed from `VITE_FEATURE_*` env vars. Defaults ON in dev/staging, OFF in prod unless noted.

| Flag | Env Var | Default | Purpose |
|---|---|---|---|
| twoStepSignup | VITE_FEATURE_TWO_STEP_SIGNUP | true | Two-step signup (/start → /onboarding-chat) |
| upgradeModalEnabled | VITE_FEATURE_UPGRADE_MODAL | true | In-app plan upgrade modal |
| activationOnboardingEnabled | VITE_FEATURE_ACTIVATION_ONBOARDING | true | Post-provisioning activation stepper |
| reportingWowEnabled | VITE_FEATURE_REPORTING_WOW | true | Enhanced call details drawer |
| activationTroubleshooting | VITE_FEATURE_ACTIVATION_TROUBLESHOOTING | true | Activation timeout guidance panel |
| taggingConfidenceUi | VITE_FEATURE_TAGGING_CONFIDENCE_UI | true | Tag confidence indicators in call logs |
| addPhoneNumberFlow | VITE_FEATURE_ADD_PHONE_NUMBER_FLOW | true | Add-phone feature for eligible plans |
| widgetSafeOffset | VITE_FEATURE_WIDGET_SAFE_OFFSET | true | Mobile safe offset for Vapi widget |
| callRecordingImmediateApply | VITE_FEATURE_CALL_RECORDING_IMMEDIATE_APPLY | true | Immediate Vapi rebuild on recording toggle |
| onboardingGuardEnabled | VITE_FEATURE_ONBOARDING_GUARD_ENABLED | true | **KILL SWITCH** — redirect to /activation if onboarding_completed_at IS NULL |
| internalSkipOnboarding | VITE_FEATURE_INTERNAL_SKIP_ONBOARDING | dev-only | Allow staff to skip onboarding |
| enhancedMarketingSchema | VITE_FEATURE_ENHANCED_MARKETING_SCHEMA | true | JSON-LD schema on marketing pages |
| pricingCallBasedV1 | VITE_FEATURE_PRICING_CALL_BASED_V1 | true | Show "calls" not "minutes" in pricing UI |
| billingCallBasedV1 | VITE_FEATURE_BILLING_CALL_BASED_V1 | true | Call-based billing in authorize-call |
| usageNotificationsV1 | VITE_FEATURE_USAGE_NOTIFICATIONS_V1 | true | Call-based usage notification templates |
| trialExperienceV1 | VITE_FEATURE_TRIAL_EXPERIENCE_V1 | true | Dedicated trial (15 live + 3 verification calls) |
| debugSignup | VITE_DEBUG_SIGNUP | false | Verbose signup logging |

### Auth State (✅ CONFIRMED — `src/lib/auth/useUser.tsx`)
- `useUser()` hook: subscribes to `onAuthStateChange()`, 5-second timeout fallback, updates Sentry user context
- `withAuthGuard(Component)`: HOC; redirects unauthenticated to `/signin?redirect=[path]`
- `signOutUser()` in `src/lib/auth/session.ts`
- `hasRoleAccess(userRole, allowedRoles)` in `src/lib/auth/roles.ts` — platform_owner/platform_admin always granted
- `redirectToRoleDashboard(userId)` in `src/lib/auth/redirects.ts` — queries `staff_roles`, routes: owner/admin → /admin, sales → /salesdash, customer → /dashboard
- Device nonce in `src/lib/auth/deviceNonce.ts` — UUID in localStorage, binds magic links to device

### Plans (✅ CONFIRMED — `src/lib/billing/dashboardPlans.ts`)

| Plan Key | Price/Month | Included Calls | Overage/Call | Max Overage Calls | Coverage |
|---|---|---|---|---|---|
| night_weekend | $59 | 60 | $1.10 | 40 | After-hours only (6PM–8AM + weekends) |
| lite | $129 | 125 | $0.95 | 50 | 24/7 |
| core | $229 | 250 | $0.85 | 75 | 24/7 (recommended / "Best Value") |
| pro | $449 | 450 | $0.75 | 90 | 24/7 + enterprise features |

⚠️ **PRICE MISMATCH RISK:** `scripts/stripe-setup-new-plans.js` defines Pro at $399 (39900 cents) but dashboard shows $449. Must reconcile before launch.

Legacy plan keys (grandfathered): `starter` → lite, `professional` → core, `premium` → pro, `trial` → night_weekend. Normalized by `normalizeLegacyPlanKey()`.

---

## Backend / Edge Functions

### Runtime
- **Platform:** Supabase Edge Functions (Deno TypeScript)
- **Count:** 73+ individual functions
- **Location:** `supabase/functions/[name]/index.ts`
- **Shared utilities:** `supabase/functions/_shared/` (cors, env, logging, telephony, template-builder, validators, sentry, posthog, call-classifier, usage-alerts, email-service, sms, availability, appointment-notifications, auth-utils, auth-email-templates, jobber-adapter, jobber-client, area-code-lookup, pool-config, disposable-domains)
- **Import map:** `supabase/deno.json` — maps `@supabase/supabase-js` → npm v2, `stripe` → npm v14.21.0

### JWT Verification (✅ CONFIRMED — `supabase/config.toml`)
Functions with `verify_jwt = true` (require valid Supabase JWT):
`authorize-call`, `complete-onboarding`, `manage-phone-lifecycle`, `manage-staff-role`, `provision`, `reset-monthly-usage`, `sync-usage`, `get-billing-summary`, `create-billing-portal-session`, `stripe-setup-intent`, `update-customer-info`

All other ~62 functions have `verify_jwt = false` (webhooks, signup flows, internal calls, public endpoints).

### CORS (✅ CONFIRMED — `supabase/functions/_shared/cors.ts`)
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type, sentry-trace, baggage
Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, PATCH, DELETE
```

### Shared Utilities Summary
| File | Key Exports |
|---|---|
| `cors.ts` | `corsHeaders` object |
| `env.ts` | `getSupabaseUrl()`, `getSupabaseServiceRoleKey()`, `getResendApiKey()` |
| `logging.ts` | `logInfo/logWarn/logError`, `withLogContext`, `extractCorrelationId/TraceId`, `stepStart/End/Error`, `maskEmailForLogs`, `maskPhoneForLogs`, `redact()` |
| `telephony.ts` | `provisionPhoneNumber()` — Twilio implemented; Vapi/Vonage/Telnyx stubbed; test mode via `TWILIO_PROVISION_MODE=test` |
| `template-builder.ts` | `buildVapiPrompt(accountData, stateRecordingLaw)` — builds compressed Vapi system prompt; 10 trade modules |
| `validators.ts` | `sanitizeCustomInstructions()`, `isValidZipCode/PhoneNumber/IP()`, `formatPhoneE164()`, `generateReferralCode/VerificationCode()`, `checkRateLimit()` |
| `call-classifier.ts` | `classifyCall()`, `writeBillingLedgerEntry()` — live / verification / excluded |
| `usage-alerts.ts` | `sendUsageAlert()` — threshold alerts at 80% and 100% |
| `sentry.ts` | `withSentryEdge()` wrapper for edge functions |

---

## Supabase

### Auth Flows (✅ CONFIRMED)
1. **Magic link:** `send-magic-link` → email via Resend → user clicks → `verify-magic-link` → session tokens returned
2. **Google OAuth:** Supabase built-in (`VITE_ENABLE_GOOGLE_OAUTH`, `VITE_SUPABASE_ENABLE_GOOGLE_OAUTH`); `GoogleButton.tsx` component; `auth-callback` page handles redirect
3. **Phone OTP:** `send-verification-code` → 6-digit code → `verify-code`; ⚠️ INFERRED: actual SMS sending via Twilio not yet implemented (TODO comment in `send-verification-code/index.ts`)
4. **Staff invite:** `create-staff-invite` → email with token → `/auth/staff-invite` page → `accept-staff-invite` edge function creates user + sets `requires_2fa=true`
5. **Password reset:** `send-password-reset` → Resend email → `/reset-password` page

### JWT Claims Enhancement (✅ CONFIRMED — `supabase/migrations/20251108000002_jwt_claims_and_rbac.sql`)
`custom_access_token_hook` Postgres function adds to `app_metadata`:
- `role` — highest-priority staff role or "customer"
- `account_id` — from profiles or account_members
- `email_verified` — boolean
- `requires_2fa` — boolean
- `last_2fa_at` — timestamp

### Row-Level Security (✅ CONFIRMED — `supabase/migrations/20251108000003_enhanced_rls_policies.sql`)
Multi-tenant isolation via `account_id`. Key enforcement:
- `profiles`: user sees own record only; staff (admin/support/sales) see all
- `accounts`: direct owner OR account_members member OR staff (admin/support/billing/platform_owner) OR sales rep by name match
- `account_members`: same account OR staff
- `phone_numbers`: same account OR staff
- ❓ UNKNOWN: RLS status on `vapi_assistants`, `vapi_numbers`, `provisioning_jobs` — pre-launch audit flags these as disabled (HIGH risk H3)

### Database Client Pattern
- **Browser (SPA):** `import { supabase } from '@/lib/supabase'` — uses anon/publishable key
- **Edge functions:** create service-role client per function using `SUPABASE_SERVICE_ROLE_KEY`
- Service-role key MUST NOT appear in frontend code


---

## Auth Flow (End-to-End)

```
Magic Link:
  Browser → POST /send-magic-link (verify_jwt=false)
          → Resend email with token
          → User clicks link → /auth/magic-callback
          → POST /verify-magic-link
          → { access_token, refresh_token }
          → Supabase session set

Google OAuth:
  Browser → supabase.auth.signInWithOAuth({ provider: 'google' })
          → Google consent → /auth/callback
          → AuthCallback.tsx exchanges code for session

Phone OTP (PARTIAL):
  Browser → POST /send-verification-code
          → ⚠️ SMS NOT YET SENT (TODO in code)
          → User enters code → POST /verify-code
          → { valid: true/false }
```

---

## Billing / Stripe Flow

### Subscription Creation (✅ CONFIRMED)
1. User selects plan in onboarding chat (PlanSelector component)
2. Stripe payment collected via Elements CardElement
3. `create-upgrade-checkout` edge function creates Stripe Checkout session
4. User redirected to Stripe hosted page
5. `stripe-webhook` receives `checkout.session.completed`
6. Account `plan_key`, `subscription_status`, `stripe_customer_id` updated in DB

### Call-Based Overage Billing (✅ CONFIRMED — `supabase/functions/authorize-call/`)
- Every inbound call hits `authorize-call` BEFORE Vapi answers
- If call-based billing enabled (`billing_call_based_v1` flag + per-account `billing_call_based` column):
  - Hard cap: `calls_used >= included_calls + max_overage_calls` → reject call
  - Soft cap: `calls_used >= included_calls` → overage charges accumulate
  - `always_answer` overflow mode: never reject regardless of usage
- Vapi webhook fires `vapi-webhook` after call ends → creates `call_billing_ledger` entry (idempotent on `provider_call_id`) → updates `billing_period_usage_summary`

### Legacy Minute-Based Billing (⚠️ INFERRED)
- Grandfathered accounts use `billing_unit = 'minute'` in `plans` table
- Legacy plan keys: starter, professional, premium
- Both billing modes co-exist via feature flag and per-account DB column

### Stripe Webhook Events Handled (`stripe-webhook/index.ts`)
| Event | Action |
|---|---|
| checkout.session.completed | Update plan_key, subscription_status, stripe_customer_id |
| customer.subscription.updated | Sync subscription status and plan |
| customer.subscription.deleted | Mark account cancelled ⚠️ NO EMAIL SENT (risk C2) |
| invoice.payment_failed | Mark account past_due ⚠️ NO EMAIL SENT (risk C1) |
| invoice.payment_succeeded | ⚠️ UNKNOWN if payment recovery email sent |
| invoice.upcoming | Charge overage to Stripe ⚠️ DOUBLE-BILLING RISK (risk C3) |

### Billing Portal
- `create-billing-portal-session` edge function → Stripe hosted portal URL
- Customer can update payment method, view invoices, cancel subscription

---

## AI Voice / Vapi Flow

### Provisioning (✅ CONFIRMED)
1. `provision-vapi` edge function calls Vapi API to create assistant
2. `template-builder.ts` generates system prompt from account data (company, trade, hours, services, recording laws)
3. Trade modules embedded: plumbing, hvac, electrical, roofing, landscaping, painting, general_contractor, handyman, locksmith, pest_control
4. Prompt includes state-specific recording disclosure if `call_recording_enabled = true`
5. `sync-assistant-config` edge function can re-sync prompt to Vapi when settings change

### Call Authorization (✅ CONFIRMED — `authorize-call/index.ts`)
Called by Vapi BEFORE answering each call:
- Checks account status (active/suspended/cancelled/trial)
- Enforces trial limits (15 live calls, 3 verification calls)
- Enforces Night & Weekend time restrictions (Mon-Fri 8AM-6PM → reject)
- Enforces call-based billing caps (soft_cap / hard_cap / always_answer modes)
- Returns `{ allowed: boolean, message?, callKind: 'live' | 'verification' }`

### Call Lifecycle (✅ CONFIRMED — `vapi-webhook/index.ts`)
```
Vapi call events → POST /vapi-webhook (verify_jwt=false)
  call-started   → log to call_logs
  end-of-call-report → 
    classify call (live/verification/excluded via call-classifier.ts)
    create call_billing_ledger entry (idempotent)
    update billing_period_usage_summary
    capture PostHog analytics
  status-update  → update call status
```

### Tool Calls During Calls (✅ CONFIRMED)
- `vapi-tools-appointments` — Vapi calls this to log appointment bookings
- `vapi-tools-availability` — Vapi calls this to check available time slots

### Phone Number Provisioning (✅ CONFIRMED — `_shared/telephony.ts`)
- Provider abstraction: Twilio implemented; Vapi/Vonage/Telnyx stubbed
- Test mode: `TWILIO_PROVISION_MODE=test` uses magic number `+15005550006`
- Search → purchase flow via Twilio REST API
- Fallback: if area code unavailable, retry without area code
- Trial accounts: reuses existing number if Twilio limit reached (error 21404)

---

## Analytics & Observability

### PostHog (✅ CONFIRMED — `src/lib/analytics.ts`, `src/main.tsx`)
- Frontend: `posthog.capture()`, `identify()`, `group()`, `getFeatureFlag()`
- Autocapture: disabled (cost control)
- Session replay: 10% sampling on critical paths (onboarding) only; no network/console capture
- Server-side: Edge functions POST to `https://us.i.posthog.com/capture/` with `POSTHOG_API_KEY`
- Key events: `page_viewed`, call classification events, billing events, provisioning events
- Best-effort: PostHog failures never block primary operations

### Sentry (✅ CONFIRMED — `src/main.tsx`, `_shared/sentry.ts`)
- Frontend: `Sentry.init()` in `src/main.tsx`; 3% trace sample; session replay on errors only
- Sensitive data redaction rules: email, phone, token, card, password, API key fields
- Hardcoded fallback DSN in `src/main.tsx:16` (acceptable; env var preferred)
- Edge functions: `withSentryEdge(handler)` wrapper in `_shared/sentry.ts`
- `VITE_SENTRY_DSN`, `VITE_SENTRY_RELEASE`, `SENTRY_DSN` (backend)

### Structured Logging (✅ CONFIRMED — `_shared/logging.ts`)
- All edge functions use `logInfo/logWarn/logError` (JSON to stdout)
- Auto-masks: emails → `u***r@domain.com`, phones → `***1234`, tokens, API keys
- Trace/correlation IDs extracted from request headers and propagated
- `stepStart/stepEnd/stepError` for LLM-native flows

### ops_execution_log Table (⚠️ INFERRED)
- `createObservabilityContext()` in `_shared/observability.ts` writes events to `ops_execution_log`
- ❓ UNKNOWN: retention policy, alerting, dashboard coverage

---

## Deployment & Hosting

### Frontend — Netlify (✅ CONFIRMED — `netlify.toml`)
- Build command: `bun run build` (Vite + sitemap + prerender)
- Publish dir: `dist/`
- Static assets: 1-year immutable cache
- HTML: no-cache + security headers (X-Frame-Options: DENY, X-Content-Type-Options: nosniff)
- Prerendered marketing pages: 1-hour cache + stale-while-revalidate
- Sentry plugin: commented out (⚠️ source maps NOT uploaded to Sentry on deploy)

### Backend — Supabase Hosted
- Edge Functions: deployed via `supabase functions deploy`
- Database: Supabase PostgreSQL (managed)
- Auth: Supabase Auth service
- `supabase/config.toml` controls JWT verification per function, hooks, and project settings

---

## Environment Variables

### Frontend (exposed in build, `VITE_` prefix)
```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY / VITE_SUPABASE_PUBLISHABLE_KEY
VITE_STRIPE_PUBLISHABLE_KEY
VITE_VAPI_PUBLIC_KEY
VITE_VAPI_WIDGET_ASSISTANT_ID
VITE_POSTHOG_KEY
VITE_POSTHOG_HOST
VITE_SENTRY_DSN
VITE_SENTRY_RELEASE
VITE_ENV_TIER              # prod | staging | dev
VITE_JULES_SECRET          # password gate for /sales page
VITE_ENABLE_GOOGLE_OAUTH
VITE_SUPABASE_ENABLE_GOOGLE_OAUTH
VITE_FEATURE_*             # 16 feature flags (see Feature Flags section)
VITE_DEBUG_SIGNUP
VITE_USE_LEGACY_DIFFERENCE_INTERACTIVE
# Legacy Stripe price IDs (grandfathered accounts):
VITE_STRIPE_PRICE_STARTER_OLD
VITE_STRIPE_PRICE_PROFESSIONAL_OLD
VITE_STRIPE_PRICE_PREMIUM_OLD
```

### Backend (Supabase secrets, never exposed to browser)
```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
STRIPE_PRICE_ID_NIGHT_WEEKEND
STRIPE_PRICE_ID_LITE
STRIPE_PRICE_ID_CORE
STRIPE_PRICE_ID_PRO
STRIPE_OVERAGE_PRICE_ID_NIGHT_WEEKEND
STRIPE_OVERAGE_PRICE_ID_LITE
STRIPE_OVERAGE_PRICE_ID_CORE
STRIPE_OVERAGE_PRICE_ID_PRO
RESEND_PROD_KEY
VAPI_API_KEY
VAPI_BASE_URL
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER
TWILIO_PROVISION_MODE      # set to "test" for magic number provisioning
POSTHOG_API_KEY
POSTHOG_SIGNAL_SECRET
SENTRY_DSN
EMAIL_FROM
EMAIL_REPLY_TO
EMAIL_STREAM
SITE_URL
AUTH_MAGIC_LINK_TTL_MINUTES
AUTH_INVITE_TTL_HOURS
BILLING_CALL_BASED_V1      # server-side feature flag
TRIAL_EXPERIENCE_V1        # server-side feature flag
```

---

## Major Data Models

### accounts (✅ CONFIRMED — `src/integrations/supabase/types.ts`)
Core tenant record. Key columns:
- `id` (uuid PK)
- `company_name`, `trade`, `billing_state`, `service_area`
- `plan_key` (night_weekend | lite | core | pro)
- `subscription_status` (trialing | active | past_due | cancelled)
- `stripe_customer_id`, `stripe_subscription_id`
- `vapi_assistant_id`, `vapi_phone_number`
- `provisioning_status` (pending | processing | completed | failed)
- `account_status` (active | suspended | disabled | cancelled)
- `onboarding_completed_at` (timestamp — null = onboarding incomplete)
- `billing_call_based` (boolean — per-account billing mode override)
- `calls_used_current_period`, `overage_calls_current_period`
- `trial_live_calls_used`, `trial_live_calls_limit` (default 15)
- `verification_calls_used`, `verification_calls_limit` (default 3)
- `call_recording_enabled`
- `sales_rep_name` (for RLS sales rep access)

### profiles (✅ CONFIRMED)
One per auth user:
- `id` (uuid PK/FK → auth.users)
- `account_id` (FK → accounts)
- `name`, `email`, `phone`, `timezone`
- `is_primary`, `email_verified`, `requires_2fa`, `totp_secret`

### call_billing_ledger (✅ CONFIRMED — migration 20260329000001)
Billing source of truth, immutable audit log:
- `account_id` (FK), `provider_call_id` (UNIQUE)
- `call_kind` (live | verification | excluded), `billable` (bool)
- `duration_seconds`, `plan_version_snapshot`
- `calls_used_before`, `calls_used_after`
- `billing_period_start`, `billing_period_end`, `counted_in_usage`

### billing_period_usage_summary (✅ CONFIRMED)
Period-level aggregates per account:
- `account_id`, `plan_key`, `cycle_start`, `cycle_end`
- `used_calls`, `included_calls`, `overage_calls`, `blocked_calls`
- `notified_80_pct` (bool — prevents duplicate threshold alerts)

### plans (✅ CONFIRMED)
Plan definitions:
- `plan_key` (PK), `billing_unit` (minute | call)
- `base_price_cents`, `included_calls`, `included_minutes` (legacy)
- `overage_rate_calls_cents`, `max_overage_calls`, `plan_version`

### staff_roles (✅ CONFIRMED)
Internal staff:
- `user_id` (FK), `role` (platform_owner | platform_admin | sales | staff | support | billing | readonly)
- `enforce_2fa`

---

## Critical User Flows (Summary — see USER_FLOWS.yml for detail)

1. **Signup:** /start (lead capture) → /onboarding-chat (11-step AI chat + payment) → /setup/assistant (provisioning poll) → /activation (wow moment)
2. **Call handling:** Vapi receives call → `authorize-call` gate → Vapi answers → `vapi-webhook` logs + bills
3. **Billing upgrade:** Dashboard UpgradeModal → `create-upgrade-checkout` → Stripe Checkout → `stripe-webhook` updates plan
4. **Staff access:** `/admin` → `withAuthGuard` checks `staff_roles` → AdminControl tabs
5. **Onboarding guard:** Dashboard access checks `onboarding_completed_at IS NOT NULL` via `useOnboardingGuard` hook

