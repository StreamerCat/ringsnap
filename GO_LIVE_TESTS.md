# Go Live Test Suite

This document defines a repeatable, non-production go-live suite for RingSnap's critical path:

1. Visitor signs up
2. Billing succeeds (trial or paid)
3. Account + subscription are created
4. Provisioning creates/links phone + VAPI assistant
5. Runtime flows (routing + appointment booking + auth + billing management) work

## Safety guardrails

- **Never run against production**. Use local Supabase or staging only.
- Tests use `TEST_MODE=true` and a deterministic namespace (`TEST_NAMESPACE`) for generated resources.
- Stripe/VAPI keys must be **test-mode keys**.
- If you only have production credentials/URLs, stop and do not run this suite.

## Stack discovery map (critical path)

- **Package manager**: npm (`package-lock.json`, `npm run ...` scripts).
- **Primary test tooling**: Vitest + Playwright.
- **Auth**: Supabase Auth (`supabase.auth.*` patterns in app/hooks).
- **Billing**:
  - Checkout/session creation: `supabase/functions/create-upgrade-checkout/index.ts`
  - Billing portal/session: `supabase/functions/create-billing-portal-session/index.ts`
  - Webhook ingestion: `supabase/functions/stripe-webhook/index.ts`
  - Cancel path: `supabase/functions/cancel-subscription/index.ts`
- **Signup**:
  - Trial/paid account creation: `supabase/functions/create-trial/index.ts`
  - Free trial entrypoint: `supabase/functions/free-trial-signup/index.ts`
- **Provisioning**:
  - Orchestration: `supabase/functions/provision-account/index.ts`
  - Resource creation/linking: `supabase/functions/provision-resources/index.ts`
  - Async queue expectation: `provisioning_jobs` usage in signup/provisioning flows
- **Runtime call + booking**:
  - VAPI webhook routing: `supabase/functions/vapi-webhook/index.ts`
  - Booking tool endpoint: `supabase/functions/vapi-tools-appointments/index.ts`
  - Parser used for call outcomes: `supabase/functions/vapi-webhook/call_parser.ts`
- **DB relationship source used for assertions**:
  - `account_graph_analysis.json` (level 1/2 happy-state + intended relationships)

## What this suite covers

### 1) Integration/contract checks (Vitest)
`tests/go-live/critical-path.contract.test.ts`

- Validates signup function contract keeps idempotency and async provisioning semantics.
- Validates Stripe webhook source keeps signature verification/idempotency persistence indicators.
- Validates provisioning source includes phone/assistant linking and completion status updates.
- Validates VAPI appointment tool includes required-arg handling + idempotency behavior.
- Validates ER export includes expected account/billing/provisioning relationship map.

`tests/go-live/runtime-flow.integration.test.ts`

- Validates VAPI call extraction yields booked outcomes for booking payloads.
- Validates summary-only payloads do not produce false auto-tags.

### 2) E2E smoke (Playwright)
`tests/e2e/go-live/smoke.spec.ts`

- `/start` signup entry route reachable.
- Unauthenticated dashboard gating behavior checked.
- `/billing/success` route exists (non-404).
- Appointments tab route renders shell.

## Environment setup

Copy `.env.test.example` to your local `.env.test` and fill test/staging values only.

Required keys vary by mode:

- **Mock-first mode** (default): `GO_LIVE_USE_MOCKS=true` – no live Stripe/VAPI calls required.
- **Live integration mode**: set Supabase/Stripe/VAPI test credentials and run against local/staging.

## Commands

Run the full go-live suite:

```bash
npm run test:go-live
```

Run individual sections:

```bash
npm run test:go-live:integration
npm run test:go-live:e2e
```

The orchestrator prints a readiness report with:
- ✅ Passed tests
- ❌ Failed tests + suspected root cause
- Blockers list

## CI

Workflow: `.github/workflows/go-live-smoke.yml`

Runs on PRs and `main`:
1. install deps
2. build
3. start local preview fallback (or use staging URL if provided)
4. run `npm run test:go-live`

## Cleanup / idempotency strategy

- Use `TEST_NAMESPACE` for all new live tests and generated data.
- Keep test data tagged with `TEST_MODE=true` metadata where supported.
- Prefer mocked integrations for CI to avoid leaked external resources.
- For any live external resource creation (Stripe/VAPI), run cleanup scripts keyed by namespace after test completion.
