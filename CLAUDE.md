# RingSnap — AI Assistant Guide

## Project Overview

RingSnap is an AI receptionist SaaS platform for home-services contractors (plumbers, HVAC, electricians, roofing). It uses a Vapi-powered voice AI to answer calls 24/7, book appointments, and route leads. Customers sign up, provision a dedicated phone number + Vapi assistant, and forward their business line to it.

**Core stack:** React 18 + TypeScript + Vite, Tailwind CSS + shadcn/ui, Supabase (Postgres + Auth + Edge Functions), Stripe billing, Vapi voice AI, Resend email, Sentry observability, PostHog analytics.

**Deployment:** Netlify (frontend) + Supabase hosted (backend edge functions + DB).

---

## Repository Structure

```
ringsnap/
├── src/                        # React SPA (Vite)
│   ├── App.tsx                 # Root router with all routes
│   ├── pages/                  # Page-level components (one per route)
│   │   ├── Dashboard.tsx       # Operator sales dashboard (/salesdash)
│   │   ├── CustomerDashboard.tsx # Customer dashboard (/dashboard)
│   │   ├── AdminControl.tsx    # Unified admin (/admin)
│   │   ├── OnboardingChat.tsx  # AI-guided signup onboarding
│   │   ├── ProvisioningStatus.tsx # Post-signup provisioning polling
│   │   ├── Activation.tsx      # Post-provisioning "wow moment"
│   │   ├── trades/             # Trade-specific landing pages
│   │   ├── compare/            # Competitor comparison pages
│   │   ├── resources/          # Resource center pages
│   │   └── settings/           # Settings pages (integrations, etc.)
│   ├── components/             # Reusable UI components
│   │   ├── ui/                 # shadcn/ui primitives (DO NOT edit)
│   │   ├── dashboard/          # Dashboard-specific components
│   │   ├── onboarding/         # Onboarding wizard components
│   │   ├── admin/              # Admin panel components
│   │   ├── marketing/          # Marketing/landing page components
│   │   └── signup/             # Signup flow components
│   ├── lib/                    # Shared utilities and hooks
│   │   ├── supabase.ts         # Supabase browser client
│   │   ├── featureFlags.ts     # Feature flag system
│   │   ├── analytics.ts        # PostHog analytics helpers
│   │   ├── auth/               # Auth helpers (useUser, roles, session)
│   │   ├── api/                # API call wrappers (leads, trials)
│   │   └── billing/            # Billing/plan helpers
│   ├── hooks/                  # Custom React hooks
│   ├── types/                  # Shared TypeScript types
│   └── integrations/supabase/  # Auto-generated Supabase types
│       ├── client.ts           # Typed Supabase client export
│       └── types.ts            # Generated DB schema types
├── supabase/
│   ├── migrations/             # Postgres migrations (131+ files, timestamped)
│   ├── functions/              # Deno edge functions (~60 functions)
│   │   ├── _shared/            # Shared utilities across functions
│   │   │   ├── cors.ts         # CORS headers
│   │   │   ├── env.ts          # Environment variable helpers
│   │   │   ├── logging.ts      # Structured logging
│   │   │   ├── observability.ts # Tracing/observability context
│   │   │   ├── validators.ts   # Input validation helpers
│   │   │   ├── telephony.ts    # Twilio phone provisioning
│   │   │   ├── template-builder.ts # Vapi prompt template generation
│   │   │   └── ...
│   │   └── [function-name]/index.ts  # Individual edge functions
│   ├── config.toml             # Supabase project config + JWT overrides
│   └── deno.json               # Deno import map for edge functions
├── tests/
│   ├── e2e/                    # Playwright end-to-end tests
│   │   ├── smoke.spec.ts       # Fast smoke tests (CI gate)
│   │   └── *.spec.ts           # Feature-level e2e tests
│   ├── unit/                   # Vitest unit tests
│   ├── signup-critical/        # Critical signup path tests
│   └── go-live/                # Go-live integration tests
├── scripts/                    # Utility scripts (migrations, audits, etc.)
├── public/                     # Static assets
├── netlify.toml                # Netlify deployment config
├── vite.config.ts              # Vite build config
├── vitest.config.ts            # Vitest test config
├── playwright.config.ts        # Playwright e2e config
├── tailwind.config.ts          # Tailwind CSS config
└── components.json             # shadcn/ui config
```

---

## Development Workflow

### Start dev server
```bash
npm run dev          # Vite dev server on port 8080
```

### Run tests
```bash
npm test             # Vitest unit tests (run once)
npm run test:watch   # Vitest in watch mode
npm run test:e2e     # Playwright e2e tests (requires running dev server or PLAYWRIGHT_BASE_URL)
npm run test:smoke   # Smoke tests only (fast CI check)
npm run typecheck    # TypeScript type checking (no emit)
npm run lint         # ESLint
```

### Build
```bash
npm run build                # Full build: Vite + sitemap + prerender
npm run build:no-prerender   # Build without prerendering (faster)
npm run build:dev            # Dev-mode build
```

### Provisioning / E2E agents
```bash
npm run test:provisioning:e2e   # Mock provisioning flow validation
RUN_LIVE_PROVISIONING_TESTS=true npm run test:provisioning:e2e  # CAUTION: real Twilio/Vapi calls
```

---

## Key Conventions

### TypeScript
- `@/` path alias resolves to `src/` — use it for all internal imports
- TypeScript is configured permissively: `noImplicitAny: false`, `strictNullChecks: false`, `noUnusedLocals: false`. Don't tighten these without discussion.
- Generated Supabase types live in `src/integrations/supabase/types.ts` — do not manually edit; regenerate with `supabase gen types`.

### React patterns
- Pages are in `src/pages/`, one file per route
- All pages except `Index` use `React.lazy()` for code splitting (see `App.tsx`)
- Protected routes use `withAuthGuard(Component)` from `@/lib/auth/useUser`
- Auth state: use `useUser()` hook from `@/lib/auth/useUser`
- Data fetching: use `@tanstack/react-query` for server state
- Forms: use `react-hook-form` + `zod` for validation
- Toasts/notifications: use `sonner` (`import { toast } from 'sonner'`)

### UI components
- **Always** use shadcn/ui primitives from `src/components/ui/` for common UI — do NOT recreate buttons, dialogs, inputs, etc.
- `src/components/ui/` files are generated/managed by shadcn — avoid editing them directly
- Styling: Tailwind CSS utility classes. Use `cn()` from `@/lib/utils` for conditional class merging
- Icons: `lucide-react` only

### Supabase client
- **Browser client** (SPA): `import { supabase } from '@/lib/supabase'` — uses anon/publishable key
- **Edge functions**: create a service-role client inside each function using `SUPABASE_SERVICE_ROLE_KEY`
- Never use service-role key in frontend code

### Edge functions
- Written in Deno TypeScript, live in `supabase/functions/[name]/index.ts`
- Always handle `OPTIONS` preflight and return `corsHeaders` from `../_shared/cors.ts`
- Use structured logging via `logInfo`/`logError`/`logWarn` from `../_shared/logging.ts`
- JWT verification is configured per-function in `supabase/config.toml` (`verify_jwt = false/true`)
- Import shared utilities via relative paths: `import { ... } from '../_shared/cors.ts'`
- Deno imports are mapped in `supabase/deno.json` (e.g., `"@supabase/supabase-js"`)

### Database migrations
- Migration files: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`
- Naming convention: use descriptive snake_case descriptions after the timestamp
- The session-start hook runs `scripts/lint-migrations.mjs` which checks:
  - Valid filename format
  - No duplicate version prefixes
  - No `COMMENT ON` with string concatenation (`||`)
  - No `CREATE INDEX` with STABLE functions in WHERE predicates
  - No invalid UUID table sequence grants
- Rollback scripts go in `supabase/migrations/rollback/`

### Feature flags
- Defined in `src/lib/featureFlags.ts` with full JSDoc
- All flags are env-var controlled (`VITE_FEATURE_*`)
- Default values: new features default **ON** in dev/staging, **OFF** in prod unless specified
- Check `featureFlags.flagName` pattern — do NOT add raw `import.meta.env` checks inline
- Each flag has a JSDoc comment explaining its purpose and kill-switch behavior

### RBAC / Roles
- Staff roles: `platform_owner`, `platform_admin`, `sales`, `staff`
- Use `hasRoleAccess(userRole, allowedRoles)` from `@/lib/auth/roles`
- Platform owners and admins bypass all role checks automatically

### Analytics
- Route tracking: `useRouteTracking(pathname)` fires `page_viewed` PostHog events automatically via `RouteTracker` in `App.tsx`
- Custom events: use PostHog directly — `import posthog from 'posthog-js'`
- Error tracking: Sentry — use `@sentry/react` and `@/lib/sentry-tracking`

---

## Environment Variables

### Frontend (`.env` — prefix `VITE_`)
```
VITE_SUPABASE_URL=               # Supabase project URL
VITE_SUPABASE_PUBLISHABLE_KEY=   # Supabase anon/publishable key
VITE_SUPABASE_ANON_KEY=          # Legacy alias for publishable key
VITE_STRIPE_PUBLISHABLE_KEY=     # Stripe publishable key
VITE_VAPI_PUBLIC_KEY=            # Vapi public key (chat widget)
VITE_VAPI_WIDGET_ASSISTANT_ID=   # Vapi assistant ID for chat widget
VITE_ENV_TIER=prod|staging|dev   # Controls feature flag defaults
VITE_SENTRY_DSN=                 # Sentry DSN for error tracking
VITE_SENTRY_RELEASE=             # Sentry release tag
VITE_POSTHOG_KEY=                # PostHog project API key
VITE_POSTHOG_HOST=               # PostHog host (default: app.posthog.com)

# Feature flags (all optional, see src/lib/featureFlags.ts for defaults)
VITE_FEATURE_TWO_STEP_SIGNUP=true
VITE_FEATURE_UPGRADE_MODAL=true
VITE_FEATURE_ACTIVATION_ONBOARDING=true
VITE_FEATURE_PRICING_CALL_BASED_V1=true
VITE_FEATURE_BILLING_CALL_BASED_V1=true
VITE_FEATURE_TRIAL_EXPERIENCE_V1=true
VITE_DEBUG_SIGNUP=false
```

### Edge functions (Supabase secrets)
```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
VAPI_API_KEY
STRIPE_SECRET_KEY
RESEND_PROD_KEY
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
SENTRY_DSN
POSTHOG_API_KEY
```

### Provisioning E2E tests
```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
RUN_LIVE_PROVISIONING_TESTS=true   # Opt-in for live mode (incurs cost)
```

---

## Key Flows

### Signup / Provisioning flow
1. `/start` → Lead capture (name + email) → `capture-signup-lead` edge function
2. `/onboarding-chat` → AI-guided chat → `create-trial` or `free-trial-signup` edge function → creates `accounts` + `profiles` records
3. `/setup/assistant` (ProvisioningStatus) → polls provisioning status from DB
4. Backend: `provision-resources` edge function → purchases Twilio number → creates Vapi assistant → updates DB
5. `/activation` → Shows provisioned phone number + test call CTA + forwarding instructions

### Authentication
- Magic link auth (email OTP) via `send-magic-link` / `verify-magic-link` edge functions
- Phone OTP via `send-verification-code` / `verify-code`
- Google OAuth via Supabase built-in
- Staff invite flow: `create-staff-invite` → `/auth/staff-invite` page

### Billing
- Stripe Checkout for subscriptions
- `create-upgrade-checkout` / `create-billing-portal-session` edge functions
- `stripe-webhook` handles subscription lifecycle events
- Call-based pricing (2026-03-29): accounts have `billing_call_based` column; `authorize-call` enforces limits

### Call handling
- Vapi webhook → `vapi-webhook` edge function → logs call, updates usage
- `authorize-call` validates call is allowed (within plan limits)
- `vapi-tools-appointments` / `vapi-tools-availability` handle Vapi function calls for scheduling

---

## Testing

### Unit tests (Vitest)
- Config: `vitest.config.ts`, env: jsdom
- Setup file: `src/components/onboarding/__tests__/setup.ts`
- Test files: `*.test.ts(x)` or `__tests__/` directories throughout `src/`

### E2E tests (Playwright)
- Config: `playwright.config.ts`
- Tests in: `tests/e2e/`
- Projects: `smoke` (fast, CI gate), `chromium` (default), `full` (all specs)
- Base URL: `http://localhost:8080` (or `PLAYWRIGHT_BASE_URL` env var)
- CI: workers=1, retries=2; local: parallel

### Migration linting (session-start hook)
The `scripts/lint-migrations.mjs` script runs automatically at session start and validates all migrations. Fix any lint errors before committing new migrations.

---

## Architecture Notes

### Phone number pool
- `phone_pool` table stores provisioned numbers available for reuse
- `manage-phone-lifecycle` / `provision-phone-number` manage allocation
- Pool allocation is checked before purchasing new numbers to reduce cost

### Vapi assistant management
- Each account gets a dedicated Vapi assistant with a customized system prompt
- `sync-assistant-config` edge function rebuilds prompt when settings change
- `template-builder.ts` in `_shared/` generates the Vapi system prompt from account data

### Observability
- Structured logging: all edge functions use `logInfo`/`logError`/`logWarn` from `_shared/logging.ts`
- Trace IDs propagated via request headers
- Observability context (`createObservabilityContext`) writes events to `ops_execution_log` table
- Sentry for error tracking (both frontend and edge functions)

### Admin
- `/admin` (AdminControl) is the unified admin center with tabs: overview, staff, monitoring, etc.
- Legacy routes `/admin/monitoring` and `/admin/users` redirect to new admin
- Platform owner/admin role required (enforced by `withAuthGuard` + role check)

---

## Gotchas

- **Do not edit `src/components/ui/`** — these are shadcn/ui generated components
- **Do not edit `src/integrations/supabase/types.ts`** — auto-generated from DB schema
- Edge functions are **Deno**, not Node.js — use `Deno.env.get()`, not `process.env`
- Migration filenames must follow `YYYYMMDDHHMMSS_description.sql` format exactly
- `supabase/config.toml` controls `verify_jwt` per function — check this when adding new public endpoints
- The `_shared/` folder in edge functions is NOT a function itself — never deploy it as a standalone function
- E2E test accounts use names starting with `E2E Test` as a safety guardrail for cleanup
- TypeScript is lenient (`skipLibCheck: true`, no strict null checks) — don't add strict checks to existing files
