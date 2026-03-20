# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RingSnap is an AI-powered phone system for contractors (plumbers, HVAC, electricians, roofers). It uses voice AI to answer calls, capture leads, and book appointments. It's a SaaS platform with a React + Vite frontend and Supabase Edge Functions backend, with integrations for Vapi (voice AI), Twilio (phone), Stripe (billing), and Jobber (CRM).

## Commands

### Development
- `npm run dev` — Start Vite dev server on port 8080
- `npm run build` — Production build (includes sitemap + prerender)
- `npm run preview` — Preview production build

### Testing
- `npm run test` — Unit tests (Vitest)
- `npm run test:watch` — Unit tests in watch mode
- `npm run test:e2e` — E2E tests (Playwright)
- `npm run test:smoke` — Smoke tests only
- `npm run test:provisioning:e2e` — Phone/Vapi provisioning tests

### Code Quality
- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript type checking

## Architecture

### Tech Stack
- **Frontend:** React 18 + Vite + TypeScript, Tailwind CSS, shadcn/ui (Radix UI), TanStack Query, React Router v6, React Hook Form + Zod
- **Backend:** Supabase (PostgreSQL + Deno Edge Functions)
- **External:** Vapi (voice AI), Twilio (phone), Stripe (billing), Resend (email), PostHog (analytics), Sentry (errors)

### Directory Structure
- `src/pages/` — Route-level components
- `src/components/` — Feature-organized UI components (`dashboard/`, `admin/`, `onboarding/`, `onboarding-chat/`, `ui/` for primitives)
- `src/lib/` — API clients, auth hooks, billing, analytics utilities
- `src/hooks/` — Shared React hooks
- `src/integrations/supabase/` — Generated Supabase types
- `supabase/functions/` — 70+ Deno Edge Functions
- `supabase/migrations/` — SQL migrations
- `tests/` — Unit (`unit/`), E2E (`e2e/`), integration (`signup-critical/`), go-live (`go-live/`)

### Signup Flow (Two-Step)
1. **OnboardingChat** — AI voice interview via Vapi (`src/pages/OnboardingChat.tsx`)
2. **OnboardingForm** — Business info + payment collection
3. **`create-trial` Edge Function** — Atomically creates Stripe customer, account, user, profile, and enqueues provisioning jobs

### Async Provisioning
Phone and Vapi assistant setup is asynchronous and idempotent:
- `provision-phone-number` — Purchases Twilio number, allocated from pre-provisioned pool
- `provision-vapi` — Creates AI assistant configuration
- Frontend polls `provisioning_status` field or uses Supabase Realtime

### Key Database Entities
- `accounts` — Main company/account record (subscription_status, signup_channel, provisioning_status)
- `account_phones` — Provisioned phone numbers per account
- `vapi_assistants` — AI voice assistant config
- `calls` — Call logs with transcripts
- `provisioning_jobs` — Async task queue with retry logic
- `staff_roles` — Internal team permissions (platform_owner, platform_admin, sales, support)

### Key Conventions
- **Signup channels:** `self_service`, `sales_guided`, `enterprise`
- **Subscription status:** `trial`, `active`, `past_due`, `canceled`
- **Plans:** `starter`, `lite`, `core`, `pro`
- **Idempotency keys** on all mutations to prevent duplicate operations
- **RLS policies** enforce data access at database level
- **Correlation IDs** for request tracing across Edge Functions
- **Sensitive data redaction** — emails, phone numbers, tokens masked in logs and Sentry

### Frontend Patterns
- Protected routes use `withAuthGuard()` HOC; role checks via `hasRoleAccess()`
- API calls go through `supabase.functions.invoke()` to Edge Functions
- Data fetching uses TanStack Query with standard stale/refetch patterns
- Route-level code splitting via lazy imports for performance
- Feature flags stored as JSON in account record

### Environment Variables
Frontend uses `VITE_` prefix: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_VAPI_PUBLIC_KEY`, `VITE_POSTHOG_KEY`, `VITE_SENTRY_DSN`.

Backend Edge Functions use: `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `VAPI_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `RESEND_PROD_KEY`.

See `.env.example` for full list.

## Critical Files
- `src/App.tsx` — Main router
- `src/pages/OnboardingChat.tsx` — AI interview step 1
- `src/pages/CustomerDashboard.tsx` — Main app interface
- `supabase/functions/create-trial/index.ts` — Account creation
- `supabase/functions/vapi-webhook/index.ts` — Call handling
- `supabase/migrations/20251120000001_unified_signup_schema.sql` — Core schema
- `.env.example` — Configuration template
