# GTM Smoke Checklist

A comprehensive verification checklist for RingSnap go-to-market readiness.

## Table of Contents
1. [Manual QA Script](#manual-qa-script)
2. [Database Verification Queries](#database-verification-queries)
3. [Observability Verification](#observability-verification)
4. [Sentry Alert Configuration](#sentry-alert-configuration)
5. [Rollback Plan](#rollback-plan)
6. [How to Debug Signup Issues](#how-to-debug-signup-issues)

---

## Manual QA Script

### Prerequisites
- Two fresh email addresses (never used in the system)
- Test Stripe card: `4242 4242 4242 4242` (any future exp, any CVC)
- Access to Supabase dashboard
- Access to Sentry dashboard

### Flow 1: Full Free Trial Signup

1. **Navigate to signup**
   - Go to `https://getringsnap.com/start`
   - Verify page loads without console errors

2. **Complete Step 1 (Email)**
   - Enter email address
   - Verify `capture-signup-lead` is called (check Network tab)
   - Verify response contains `lead_id`

3. **Complete Step 2 (Phone)**
   - Enter phone number and area code
   - Verify lead is updated with phone

4. **Complete Step 3 (Company)**
   - Enter company name and select trade
   - Enter test payment card

5. **Submit and verify**
   - [ ] User is auto-logged in
   - [ ] Redirected to onboarding or provisioning status page
   - [ ] No errors in console

### Flow 2: Provisioning Verification

1. **Wait for provisioning**
   - Watch provisioning status UI
   - Should complete within 2 minutes

2. **Verify completion**
   - [ ] Status shows "completed" or "active"
   - [ ] RingSnap number is displayed
   - [ ] Dashboard is accessible
   - [ ] Call logs tab loads (may be empty)

### Flow 3: Billing Verification

1. **Navigate to billing**
   - Go to Dashboard → Settings → Billing

2. **Verify billing portal**
   - [ ] "Manage Billing" button works
   - [ ] Stripe Customer Portal opens
   - [ ] Plan is displayed correctly

---

## Database Verification Queries

Run these queries in Supabase SQL Editor to verify account state.

### New Account Verification

```sql
-- Replace with actual email
WITH target_account AS (
  SELECT a.id, a.company_name, a.provisioning_status, a.subscription_status
  FROM accounts a
  JOIN profiles p ON p.account_id = a.id
  JOIN auth.users u ON u.id = p.id
  WHERE u.email = 'test@example.com'
)
SELECT * FROM target_account;
```

### Phone Number Verification

```sql
-- Verify account has primary phone number
SELECT 
  pn.id,
  pn.phone_number,
  pn.status,
  pn.is_primary,
  pn.vapi_phone_id
FROM phone_numbers pn
JOIN accounts a ON a.id = pn.account_id
JOIN profiles p ON p.account_id = a.id
JOIN auth.users u ON u.id = p.id
WHERE u.email = 'test@example.com'
  AND pn.is_primary = true
  AND pn.status = 'active';
```

### Assistant Verification

```sql
-- Verify account has linked assistant
SELECT 
  ast.id,
  ast.vapi_assistant_id,
  ast.status,
  ast.is_primary
FROM assistants ast
JOIN accounts a ON a.id = ast.account_id
JOIN profiles p ON p.account_id = a.id
JOIN auth.users u ON u.id = p.id
WHERE u.email = 'test@example.com';
```

### Provisioning Status Transitions

```sql
-- Check expected status transitions
SELECT 
  a.id,
  a.provisioning_status,
  a.provisioning_error,
  a.onboarding_completed,
  a.created_at,
  a.updated_at
FROM accounts a
JOIN profiles p ON p.account_id = a.id
JOIN auth.users u ON u.id = p.id
WHERE u.email = 'test@example.com';
```

### System Events for Trace ID

```sql
-- Query events by trace_id
SELECT 
  created_at,
  event_name,
  level,
  error_code,
  error_message,
  metadata
FROM system_events
WHERE trace_id = 'your-trace-id-here'
ORDER BY created_at ASC;
```

---

## Observability Verification

### Sentry Events Check

1. Go to Sentry → Issues
2. Filter by `environment:production`
3. Verify recent errors have:
   - [ ] `trace_id` tag present
   - [ ] `account_id` or `user_id` where applicable
   - [ ] Proper error classification

### System Events Check

```sql
-- Recent system events
SELECT 
  created_at,
  event_name,
  level,
  account_id,
  error_code
FROM system_events
ORDER BY created_at DESC
LIMIT 50;

-- Error events in last 24 hours
SELECT 
  event_name,
  count(*),
  array_agg(DISTINCT error_code) as error_codes
FROM system_events
WHERE level IN ('error', 'warn')
  AND created_at > now() - interval '24 hours'
GROUP BY event_name
ORDER BY count DESC;
```

---

## Sentry Alert Configuration

### Required Alerts

1. **Signup Error Spike**
   - Condition: Error count > 5 in 10 minutes
   - Filter: `event_name:*signup*` OR `event_name:*trial*`
   - Action: Email + Slack (if configured)

2. **Provisioning Failures**
   - Condition: Error count > 3 in 30 minutes
   - Filter: `error_code:VAPI_*` OR `error_code:POOL_EMPTY`
   - Action: Email (critical)

3. **Stripe Webhook Failures**
   - Condition: Any error with `error_code:STRIPE_SIGNATURE_FAIL`
   - Action: Email immediately

### Alert Configuration Steps

1. In Sentry, go to **Alerts** → **Create Alert**
2. Select **Issue Alert**
3. Set conditions:
   - "When an issue is first seen" OR
   - "When issue frequency exceeds X in Y minutes"
4. Add filters for relevant tags/error codes
5. Set action: Email to `team@getringsnap.com`

---

## Rollback Plan

### Feature Flags

The observability changes are additive and don't require feature flags. To disable:

1. **System Events**: Set `OBS_EVENTS_ENABLED=false` in Edge Function secrets
2. **Sentry**: Errors still go to console logs if Sentry fails

### Database Rollback

All migrations are additive. To rollback if needed:

```sql
-- WARNING: Only run if necessary
-- Drop system_events table
DROP TABLE IF EXISTS system_events;

-- Remove step tracking columns
ALTER TABLE signup_leads DROP COLUMN IF EXISTS last_step;
ALTER TABLE signup_leads DROP COLUMN IF EXISTS trace_id;
```

### Function Rollback

If edge functions cause issues:
1. Revert to previous commit: `git revert <commit>`
2. Redeploy functions: `supabase functions deploy`

---

## How to Debug Signup Issues

### Step 1: Get the Trace ID

1. Check browser localStorage for `ringsnap_trace_id`
2. Or check Network tab for `x-trace-id` header

### Step 2: Query System Events

```sql
SELECT * FROM system_events
WHERE trace_id = 'YOUR_TRACE_ID'
ORDER BY created_at ASC;
```

### Step 3: Check Sentry

1. Go to Sentry → Discover
2. Search: `trace_id:YOUR_TRACE_ID`
3. Review stack traces and breadcrumbs

### Step 4: Check Function Logs

1. Go to Supabase Dashboard → Edge Functions
2. Select the relevant function (free-trial-signup, provision-resources, etc.)
3. View logs, filter by correlation ID

### Common Error Codes

| Error Code | Meaning | Resolution |
|------------|---------|------------|
| `POOL_EMPTY` | No phone numbers in pool | Seed pool or provision new numbers |
| `VAPI_PHONE_CREATE_FAILED` | VAPI phone creation failed | Check VAPI API status, rate limits |
| `VAPI_ASSISTANT_CREATE_FAILED` | VAPI assistant creation failed | Check VAPI API key, model limits |
| `VAPI_LINK_FAILED` | Failed to link assistant to phone | Retry provisioning |
| `STRIPE_SIGNATURE_FAIL` | Webhook signature invalid | Check webhook secret configuration |

### Escalation Path

1. Check this doc first
2. Query system_events and Sentry
3. Check Supabase function logs
4. If still unresolved, check VAPI and Stripe dashboards directly
