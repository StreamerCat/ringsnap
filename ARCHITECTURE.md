# RingSnap — Architecture Overview

A one-page orientation to the codebase, derived from the source. For deeper detail see
[`CLAUDE.md`](./CLAUDE.md) (conventions + workflow) and
[`docs/source-of-truth/TECHNICAL_ARCHITECTURE.md`](./docs/source-of-truth/TECHNICAL_ARCHITECTURE.md)
(full technical reference).

## What it is

RingSnap is an AI receptionist SaaS for home-services contractors (plumbing, HVAC,
electrical, roofing, etc.). Each customer account is provisioned a dedicated phone number
and a [Vapi](https://vapi.ai) voice-AI assistant; the contractor forwards their business
line to it. The assistant answers calls 24/7, books appointments, and captures leads, all
managed through a web dashboard with usage-based (call-based) billing.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript, Vite (SWC), Tailwind CSS + shadcn/ui (Radix) |
| Routing / state | react-router-dom v6, TanStack Query v5, react-hook-form + Zod |
| Backend | Supabase: PostgreSQL + Auth + Edge Functions (Deno TypeScript) |
| Voice AI | Vapi (per-account assistant) |
| Telephony | Twilio (number provisioning, SMS) |
| Billing | Stripe (Checkout, subscriptions, usage/overage) |
| Email / analytics / errors | Resend, PostHog, Sentry |
| Deploy | Netlify (frontend) + Supabase hosted (DB + edge functions) |

## Repository layout

```
src/                       React SPA (Vite)
  main.tsx                 Entry: inits Sentry + PostHog, renders <App/>
  App.tsx                  Router (~74 routes; Index eager, rest React.lazy)
  pages/                   One file per route (dashboards, onboarding, marketing, trades…)
  components/ui/           shadcn/ui primitives — DO NOT EDIT
  components/{dashboard,onboarding,admin,marketing,signup,…}
  lib/                     supabase client, featureFlags, analytics, auth/, billing/, api/
  integrations/supabase/   Auto-generated DB types — DO NOT EDIT
supabase/
  functions/               81 Deno edge functions; _shared/ holds cross-cutting utils
  migrations/              131 timestamped Postgres migrations (+ rollback/)
  config.toml              Per-function verify_jwt overrides
scripts/                   Sitemap/prerender, SEO checks, migration lint, E2E agents
tests/                     Playwright e2e (smoke/full) + go-live; Vitest unit tests live in src/
netlify.toml               Frontend deploy config
```

## Entry points

- **Web SPA** — `src/main.tsx` → `src/App.tsx`. Protected routes use `withAuthGuard()` from
  `src/lib/auth/useUser.tsx`; staff routes additionally gate on role
  (`platform_owner`/`platform_admin`/`sales`/`staff`).
- **Edge functions** — `supabase/functions/<name>/index.ts`. Each handles CORS preflight,
  uses structured logging from `_shared/logging.ts`, and (when privileged) builds a
  service-role Supabase client. `verify_jwt` is set per function in `config.toml`.
- **Background / scheduled** — usage resets, reminders, alert monitors, call reconciliation
  (e.g. `reset-monthly-usage`, `reminders-dispatcher`, `monitor-alerts`, `vapi-reconcile-calls`).

## Key data entities

`accounts` (tenant root: `plan_key`, `subscription_status`, `stripe_customer_id`,
`billing_call_based`) · `profiles` / `account_members` (users ↔ accounts, RBAC) ·
`phone_numbers` + `phone_pool` (provisioned/reusable numbers) · `vapi_assistants` ·
`provisioning_jobs` (async orchestration state machine) ·
`call_billing_ledger` + `billing_period_usage_summary` (call-based usage) · `appointments`.
Multi-tenant isolation is enforced via `account_id` row-level security; JWT claims
(`role`, `account_id`, `requires_2fa`) are added by a `custom_access_token_hook`.

## Core flows

- **Signup → provisioning:** `/start` (lead capture → `capture-signup-lead`) →
  `/onboarding-chat` (`create-trial`/`free-trial-signup` creates `accounts` + `profiles`) →
  `/setup/assistant` polls status while `provision-resources` buys a Twilio number and
  creates the Vapi assistant → `/activation` shows the number + forwarding instructions.
- **Auth:** magic link (`send-/verify-magic-link`), Google OAuth (Supabase built-in),
  phone OTP, staff invite (`create-/accept-staff-invite`), password reset.
- **Call handling:** inbound call → `authorize-call` (enforces plan/overage limits) → Vapi
  answers → `vapi-webhook` logs the call and writes an idempotent `call_billing_ledger`
  entry → usage summary updated. `vapi-tools-appointments`/`-availability` back scheduling.
- **Billing:** Stripe Checkout via `create-upgrade-checkout`; `stripe-webhook` syncs
  subscription lifecycle; call-based overage accrues against per-account caps.

## Commands

```bash
npm install            # install deps (npm; bun.lockb also present)
npm run dev            # Vite dev server (port 8080)
npm run build          # vite build + sitemap + prerender (build:no-prerender to skip)
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit
npm test               # Vitest unit tests (run once)
npm run test:e2e       # Playwright e2e (needs dev server / PLAYWRIGHT_BASE_URL)
npm run test:smoke     # fast Playwright smoke project (CI gate)
```

## CI / deploy

GitHub Actions in `.github/workflows/` cover the quality gate (lint/typecheck/test),
signup-critical and go-live smoke tests, Lighthouse CI, logging guardrails, migration
diagnose/autofix, and edge-function deploys. The frontend deploys via Netlify
(`netlify.toml`); backend (edge functions + DB migrations) deploys to Supabase hosted.
