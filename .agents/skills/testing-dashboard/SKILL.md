---
name: testing-ringsnap-dashboard
description: Test customer dashboard changes on RingSnap Netlify preview deployments. Use when verifying UI changes to Inbox, Settings, Billing, or other dashboard tabs.
---

# Testing RingSnap Customer Dashboard

## Prerequisites

### Devin Secrets Needed
- `SUPABASE_SERVICE_ROLE_KEY` — org-level secret for creating test accounts via Supabase Admin API
- `RINGSNAP_TEST_EMAIL` — repo-scoped secret with test account email
- `RINGSNAP_TEST_PASSWORD` — repo-scoped secret with test account password

### Preview Deployment
- PR preview deployments are on Netlify: `https://deploy-preview-{PR_NUMBER}--ringsnap.netlify.app`
- Preview connects to **production Supabase** (`rmyvvbqnccpfeyowidrq.supabase.co`), not a separate staging instance
- Vercel previews may also exist but Netlify is the primary

## Creating a Test Account

The preview uses production Supabase, so test accounts must exist there. The account creation requires 3 records:

### 1. Auth User (via Admin API)
```bash
curl -X POST "https://rmyvvbqnccpfeyowidrq.supabase.co/auth/v1/admin/users" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"email": "EMAIL", "password": "PASSWORD", "email_confirm": true}'
```
Note: A profile record is auto-created by a database trigger with default values.

### 2. Account Record
```bash
curl -X POST "https://rmyvvbqnccpfeyowidrq.supabase.co/rest/v1/accounts" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"company_name": "Test Co", "plan_type": "professional", "subscription_status": "trial", "onboarding_completed": true, "trade": "plumbing", "timezone": "America/New_York", "provisioning_status": "completed", "account_status": "active"}'
```

**Important constraints:**
- `plan_type` must be one of: `starter`, `professional`, `premium`, `night_weekend`, `lite`, `core`, `pro`. The migration `20260320000001_fix_plan_type_constraint.sql` may not be applied to production — use legacy values (`professional` maps to `core` via `normalizeLegacyPlanKey`).
- `onboarding_completed_at` must be set separately via PATCH (not in the initial INSERT) to avoid issues.

### 3. Update Profile + Set onboarding_completed_at
```bash
# Update profile to link to account
curl -X PATCH "https://rmyvvbqnccpfeyowidrq.supabase.co/rest/v1/profiles?id=eq.AUTH_USER_ID" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"account_id": "ACCOUNT_ID", "name": "Test User", "is_primary": true, "onboarding_status": "active"}'

# Set onboarding_completed_at on account
curl -X PATCH "https://rmyvvbqnccpfeyowidrq.supabase.co/rest/v1/accounts?id=eq.ACCOUNT_ID" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"onboarding_completed_at": "2026-01-01T00:00:00Z"}'
```

**Important constraints:**
- `onboarding_status` on profiles must be one of: `not_started`, `collecting`, `ready_to_provision`, `provisioning`, `active`, `provision_failed`. Do NOT use `completed`.
- Profile `id` must match the auth user ID.
- `onboarding_completed_at` must be non-null on the account or the dashboard will redirect to `/activation`.

### 4. Account Member (optional but recommended)
```bash
curl -X POST "https://rmyvvbqnccpfeyowidrq.supabase.co/rest/v1/account_members" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"account_id": "ACCOUNT_ID", "user_id": "AUTH_USER_ID", "role": "owner"}'
```

## Dashboard Testing

### Login
- Navigate to `https://deploy-preview-{PR}--ringsnap.netlify.app/auth/login`
- Enter test email and password
- Should redirect to `/dashboard` (not `/activation`)

### Tab Navigation
The dashboard has 6 tabs: Inbox, Schedule, Phones, Team, Settings, Billing.
- URL pattern: `/dashboard?tab=inbox`, `/dashboard?tab=settings`, etc.
- Settings tab is the longest — scroll down to see all cards.

### Call-Based vs Minute-Based Plans
- All v2 plans (`night_weekend`, `lite`, `core`, `pro`) have `billingUnit: 'call'`
- Legacy plans (`starter`, `professional`, `premium`) normalize to v2 keys via `normalizeLegacyPlanKey()`
- `isCallBased = currentPlan?.billingUnit === 'call'` controls terminology in Settings
- To test minute-based display, you'd need an account that doesn't resolve to a v2 plan (edge case)

### Trial vs Active Subscription
- `isTrialing = account.trial_active === true || account.subscription_status === 'trial'`
- Trial: cancel dialog says "Cancel Trial?" and warns about immediate end
- Active: cancel dialog says "Cancel Subscription?" and mentions end-of-period

## Gotchas

- **Password typing:** The `type` action in computer tool doesn't resolve shell variables. Extract the literal password value first using `printf '%s' "${VAR}" | cat -v` before typing.
- **Netlify banner:** Close the Netlify collaboration banner at the bottom of preview deployments for cleaner screenshots.
- **Profile auto-creation:** Supabase auth triggers auto-create a profile row with default values. You must UPDATE it (not INSERT) to link it to your account.
- **plan_key vs plan_type:** The accounts table has both columns. `plan_key` may default to `night_weekend`. The dashboard reads `account.plan_key || account.plan_type` to resolve the plan.
