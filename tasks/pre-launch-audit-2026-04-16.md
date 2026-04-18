# RingSnap Pre-Launch Audit — 2026-04-16

**Scope:** Full codebase audit across infrastructure/security, test health, code quality, billing lifecycle, dead code, and database.  
**Branch:** `claude/pre-launch-audit-sSLoP`  
**Commit:** `6da0324`

---

## Executive Summary

RingSnap is in good shape for launch. The core signup, provisioning, billing, and call-authorization flows are structurally sound. The main pre-launch risks are:

1. **Silent billing failures** — payment failures and subscription cancellations produce no customer-facing email or SMS. Users go silent on you (or dispute charges) when payments fail.
2. **invoice.upcoming double-billing risk** — Stripe overage reporting and counter resets happen in two separate DB calls; a webhook retry between them could charge overage twice.
3. **43 unguarded console.log calls** — production logs contain internal routing details, lead IDs, and debug traces that should not reach customer browsers.
4. **RLS intentionally disabled** on three provisioning tables — must confirm this is a deliberate architectural choice, not an oversight.

Everything in the test suite is now green (245/245, 1 intentional skip). All other findings are documented below with severity ratings.

---

## Changes Delivered (Already Committed)

| File | Change | Why |
|------|--------|-----|
| `vitest.config.ts` | Added `exclude` array | Prevented vitest from picking up 25 Playwright/Deno/integration tests, causing false failures |
| `src/pages/__tests__/Start.test.tsx` | Fixed supabase mock `maybeSingle` | React 18 re-render race caused `clearStoredLeadId()` to fire after `storeLeadId()`, making localStorage assertion fail |
| `src/components/__tests__/mobileNav.test.tsx` | Updated test 3 | "Hear It Live" was removed from `topLevelNavItems`; test now asserts current links |
| `src/components/__tests__/marketingNavigation.test.tsx` | Removed stale "Features" assertion | `ContractorFooter` never had a `/#features` link |
| `src/lib/analytics.ts` | Removed 3 unused eslint-disable directives | Confirmed unused via `eslint --report-unused-disable-directives` |
| `public/sitemap.xml` | Updated `lastmod` dates | Automated date stamp to today |

**Test result after all changes:** 20 files · 245 passed · 1 skipped · 0 failed

---

## Findings by Category

### CRITICAL — Fix Before Launch

#### C1: Payment Failed — No Customer Email  
**File:** `supabase/functions/stripe-webhook/index.ts` — `invoice.payment_failed` handler  
**Risk:** Customer's card fails, account moves to `past_due`, but no email is sent. The user has no idea. They will eventually lose service silently or dispute the charge.  
**Fix:** Add a Resend call in the `invoice.payment_failed` handler. Subject: "Action required: update your payment method." Include a link to the Stripe billing portal (`/billing` → `create-billing-portal-session`).

#### C2: Subscription Cancelled — No Customer Email  
**File:** `supabase/functions/stripe-webhook/index.ts` — `customer.subscription.deleted` handler  
**Risk:** When a subscription is cancelled (user-initiated or Stripe-forced after dunning), the account DB is updated but no confirmation email is sent. Customer has no record of the cancellation.  
**Fix:** Send a cancellation confirmation email via Resend in the `customer.subscription.deleted` handler.

#### C3: invoice.upcoming — Overage Double-Billing Risk on Webhook Retry  
**File:** `supabase/functions/stripe-webhook/index.ts` — `invoice.upcoming` handler  
**Risk:** Handler calls `stripe.subscriptionItems.createUsageRecord()` (Stripe charge) then calls Supabase `.update()` to reset counters. If the webhook times out between these two steps and Stripe retries, the idempotency guard catches the retry and skips it — but the Stripe charge was already submitted once. If the **first run** fails after the Stripe call but before the counter reset, the counters stay high, and the next legitimate `invoice.upcoming` fires again and double-charges.  
**Fix:** Create a single `report_and_reset_overage(account_id, usage_record_id)` RPC that:
1. Records the usage to a `stripe_usage_reports` table (idempotent by unique key)
2. Checks the table before calling Stripe
3. Resets counters atomically in the same transaction

#### C4: 43 Unguarded console.log in Production  
**Files:** `src/pages/Start.tsx`, `src/pages/OnboardingChat.tsx`, `src/pages/MagicCallback.tsx`, `src/pages/CustomerDashboard.tsx`, `src/pages/AuthCallback.tsx`, `src/lib/correlationId.ts`  
**Risk:** Exposes lead IDs, routing logic, correlation IDs, and debug state to browser dev tools. Low exploitability but high information-leakage risk.  
**Fix:** Gate all production console.log calls behind `if (IS_DEV)` or remove them. `IS_DEV` already exists in `src/lib/analytics.ts`.

---

### HIGH — Fix in Next Sprint

#### H1: Trial Started — No Welcome Email  
**File:** `supabase/functions/finalize-trial/index.ts` and `create-trial/index.ts`  
**Current:** Only an onboarding SMS is sent (via VAPI) with forwarding instructions.  
**Risk:** No written record of the trial start. If the SMS fails or the user misses it, they have no reference for their trial end date or plan selection.  
**Fix:** Add a "Your trial has started" email via `send-welcome-email` function immediately after trial creation.

#### H2: Payment Recovery — No Handler  
**File:** `supabase/functions/stripe-webhook/index.ts`  
**Current:** No handler for `invoice.payment_succeeded` when the event follows a prior `invoice.payment_failed`. No dunning recovery email.  
**Risk:** User updates their payment method and the retry succeeds, but they never receive confirmation that the issue was resolved.  
**Fix:** In `invoice.payment_succeeded`, check if `subscription_status` was `past_due` before the event and send a "payment recovered" email if so, then clear the `past_due` state.

#### H3: RLS Disabled on Provisioning Tables  
**File:** `supabase/migrations/20251107123000_provisioning_tables.sql`  
**Tables:** `vapi_assistants`, `vapi_numbers`, `provisioning_jobs`  
**Current:** `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` is explicit.  
**Risk:** If these tables are ever accessible via the anon key (e.g., a Supabase client misconfiguration), all rows are visible.  
**Action Required:** Confirm intentional. If yes, ensure Supabase client config for these tables only uses service-role key (which bypasses RLS anyway). Document the architectural decision in the migration file as a comment.

#### H4: Single Top-Level ErrorBoundary  
**File:** `src/App.tsx` line 122  
**Current:** One `ErrorBoundary` wraps the entire app. All 57 lazy-loaded routes fall under it.  
**Risk:** A render error in the admin panel or a non-critical settings page will crash the entire app, including the customer dashboard.  
**Fix:** Add route-group error boundaries at minimum: one for `/admin`, one for `/dashboard`, one for `/auth/*` to contain crashes.

---

### MEDIUM — Plan Before Next Cycle

#### M1: No SMS for Payment Failures  
**Current:** Usage alerts (70%, 90%, ceiling) send both email + SMS. Payment failures only send email.  
**Fix:** Add a Twilio SMS in the `invoice.payment_failed` handler alongside the email. Brief message: "RingSnap: Payment failed for your account. Update at [link]."

#### M2: Trial Verification Call Budget Drain  
**File:** `supabase/functions/authorize-call/index.ts`  
**Issue:** Verification calls (first 3 from allowlisted numbers) are separate from the 15-call live trial. A user who repeatedly calls in to test setup (but verification fails) does not drain the live trial budget — but the UX is confusing if verification calls and live calls aren't clearly differentiated.  
**Fix:** Add a toast/notification in the frontend when `trial_type: 'verification'` calls are used vs. `trial_type: 'live'`.

#### M3: accounts Table Column Bloat (70+ columns)  
**File:** `supabase/migrations/*` — `accounts` table  
**Issue:** The accounts table has accumulated 70+ columns over 135 migrations, including trial counters, call-based counters, legacy minute counters, feature flags, integration tokens, and billing state all mixed together.  
**Fix (not urgent):** Extract into child tables: `account_billing_state`, `account_trial_state`, `account_usage_counters`. Do this as a planned migration after launch, not before.

#### M4: IP Header Spoofing in Rate Limiting  
**File:** `supabase/functions/_shared/rate-limiting.ts` (inferred from audit context)  
**Issue:** Rate limiting based on `x-forwarded-for` is trivially bypassable by spoofing the header.  
**Fix:** Verify rate-limiting function uses Supabase's actual peer IP (from `request.headers.get('x-real-ip')` or similar authenticated header) rather than trusting `x-forwarded-for` alone.

#### M5: OAuth Tokens — Confirm Encryption At Rest  
**File:** Supabase `integrations` or `oauth_tokens` tables  
**Issue:** Previous audit context noted Google Calendar and Jobber OAuth access_tokens may be stored unencrypted in Postgres. The subagent confirmed no client-side exposure, but did not confirm Postgres column-level encryption.  
**Action:** Run `\d+ integrations` or the relevant table in Supabase and verify token columns use `pgp_sym_encrypt` or equivalent. If not, encrypt before launch.

---

### LOW — Housekeeping

#### L1: No Automatic Cleanup of Stale DB Rows  
**Tables affected:** `auth_tokens`, `rate_limits`, `system_events`  
**Issue:** No cron job or Postgres TTL to expire old rows. Will accumulate unbounded over time.  
**Fix:** Add a nightly `DELETE FROM auth_tokens WHERE expires_at < now() - interval '7 days'` via Supabase cron or pg_cron.

#### L2: Setup-Status Route Commented Out  
**File:** `src/App.tsx`  
**Issue:** `/setup-status` route is commented out. If any code deep-links to it, users get a 404.  
**Action:** Either restore the route or search for all navigation calls to `/setup-status` and remove them.

---

## Validation Results

### Test Suite
```
20 test files · 245 passed · 1 skipped (intentional) · 0 failed
```

### Lint
```
eslint src/lib/analytics.ts → 0 problems
```

### Build
```
npm run build:no-prerender → clean (prerender skipped: Chromium unavailable in CI environment; non-blocking)
```

---

## DB Optimization Plan

**Short-term (pre-launch):**
- Add index on `signup_leads(email)` if not present — lead lookup in resume flow is unbounded scan
- Confirm `signup_leads(completed_at)` index exists — used in authorize-call and resume checks
- Verify `accounts(subscription_status)` index for Stripe webhook status checks

**Medium-term (post-launch, month 1):**
- Decompose `accounts` table into child tables (see M3 above)
- Add row-level partitioning on `call_logs` by `created_at` once volume exceeds 100k rows
- Archive `ops_execution_log` entries older than 90 days to cold storage or delete

---

## Lifecycle Messaging Map

| Event | Email | SMS | Status |
|-------|-------|-----|--------|
| Trial started | ✗ | ✓ (VAPI SMS) | Gap: no email |
| Trial 80% used | ✓ | ✓ | ✓ Complete |
| Trial expiring 24h | ✓ | ✓ | ✓ Complete |
| Trial expiring 6h | ✓ | ✓ | ✓ Complete |
| Trial expired (no upgrade) | ✓ | ✓ | ✓ Complete |
| Trial limit reached (15 calls) | ✓ | ✓ | ✓ Complete |
| Plan 70%/80% used | ✓ | ✓ | ✓ Complete |
| Plan 90% used | ✓ | ✓ | ✓ Complete |
| Plan 100% / overage | ✓ | ✓ | ✓ Complete |
| Plan ceiling hit | ✓ | ✓ | ✓ Complete |
| **Payment failed** | ✗ | ✗ | **CRITICAL GAP** |
| **Payment recovered** | ✗ | ✗ | **CRITICAL GAP** |
| Upgrade confirmed | ✓ | ✗ | ✓ (email only, ok) |
| **Subscription cancelled** | ✗ | ✗ | **HIGH GAP** |
| Staff invite | ✓ | ✗ | ✓ Complete |
| Magic link auth | ✓ | ✗ | ✓ Complete |
| Appointment reminder | ✗ | ✓ | ✓ (SMS sufficient) |

---

## Next Feature Roadmap

Based on the audit, the highest-leverage next features (post-launch) in priority order:

1. **Billing lifecycle emails** (C1, C2, H2) — Three email templates, all wiring into existing stripe-webhook handlers. Highest retention impact.
2. **invoice.upcoming atomic transaction** (C3) — One RPC migration + handler refactor. Prevents potential double-billing.
3. **Production console.log cleanup** (C4) — Grep-and-gate behind IS_DEV. 1-hour task.
4. **Route-group error boundaries** (H4) — 2 hours, prevents admin panel crash from taking down the customer dashboard.
5. **Trial welcome email** (H1) — One email template + one Resend call in finalize-trial.
6. **accounts table decomposition** (M3) — Plan as a post-launch migration sprint; 2-3 weeks.
7. **DB cleanup cron jobs** (L1) — 30-minute migration; prevents unbounded table growth.

---

*Generated by pre-launch audit on 2026-04-16. All fixes in this audit committed to `claude/pre-launch-audit-sSLoP` (commit `6da0324`).*
