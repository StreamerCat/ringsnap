# Hybrid Trial Testing Guide

## Overview
This guide provides step-by-step testing procedures for the hybrid trial system with expected results and verification queries.

## Prerequisites

- ✅ Database migration deployed (`20251107000000_hybrid_trial_fields.sql`)
- ✅ Edge functions deployed (create-setup-intent, confirm-payment-method, skip-card-trial)
- ✅ Environment variables set (VITE_STRIPE_PUBLISHABLE_KEY, STRIPE_SECRET_KEY)
- ✅ Frontend deployed with latest code

## Test Cards

Use these Stripe test cards:

| Card Number | Scenario | CVC | Expiry | ZIP |
|------------|----------|-----|--------|-----|
| `4242 4242 4242 4242` | Success | `123` | `12/25` | `12345` |
| `4000 0000 0000 0002` | Decline | `123` | `12/25` | `12345` |
| `4000 0000 0000 9995` | Insufficient funds | `123` | `12/25` | `12345` |
| `4000 0027 6000 3184` | 3D Secure required | `123` | `12/25` | `12345` |

---

## Test Scenario 1: Add Payment Method (Happy Path)

### Objective
Verify users can add payment method during signup and get full trial.

### Steps

1. **Open app in incognito/private window**
   - Clear all browser data
   - Navigate to: `http://localhost:5173` (or your deployed URL)

2. **Start signup**
   - Click "Sign Up" or "Start Free Trial"
   - Enter test email: `test-card-{timestamp}@example.com`
   - Enter password: `TestPass123!`
   - Click "Create Account"

3. **Verify "Secure Your Free Trial" screen appears**
   - ✅ Should see headline: "Secure Your Free Trial"
   - ✅ Should see benefits list (150 minutes, no charge, instant number)
   - ✅ Should see Stripe Payment Element (card form)
   - ✅ Should see two buttons: "Secure My Trial" (primary) and "Skip for now" (secondary)

4. **Enter payment information**
   - Card: `4242 4242 4242 4242`
   - Expiry: `12/25`
   - CVC: `123`
   - ZIP: `12345`
   - ✅ Should see card validation pass (no red errors)

5. **Submit payment**
   - Click "Secure My Trial"
   - ✅ Should see button change to "Processing..."
   - ✅ Should see success toast: "Payment method added successfully!"
   - ✅ Should transition to OnboardingWizard (phone selection step)

6. **Complete onboarding wizard**
   - Select phone number area code
   - Enter business details
   - ✅ Should complete successfully

7. **Verify dashboard**
   - ✅ Should see dashboard
   - ✅ Should NOT see "Limited Trial Banner"
   - ✅ Should see 150 minutes available

### Database Verification

```sql
-- Get the account you just created
SELECT
  a.id,
  p.email,
  a.has_payment_method,
  a.trial_status,
  a.trial_type,
  a.stripe_customer_id,
  a.stripe_subscription_id,
  a.created_at
FROM accounts a
JOIN profiles p ON p.account_id = a.id
WHERE p.email = 'test-card-{timestamp}@example.com';

-- Expected results:
-- has_payment_method: true ✅
-- trial_status: 'active' ✅
-- trial_type: 'card_required' ✅
-- stripe_customer_id: NOT NULL (starts with 'cus_') ✅
```

### Stripe Verification

1. Go to [Stripe Dashboard → Customers](https://dashboard.stripe.com/test/customers)
2. Find customer by email: `test-card-{timestamp}@example.com`
3. ✅ Customer should exist
4. ✅ Customer should have payment method attached
5. ✅ Payment method should be set as default

### Analytics Verification

```sql
-- Check trial events were logged
SELECT
  event_type,
  event_data,
  created_at
FROM trial_events
WHERE account_id = (
  SELECT account_id FROM profiles WHERE email = 'test-card-{timestamp}@example.com'
)
ORDER BY created_at;

-- Expected events:
-- 1. payment_method_added ✅
```

---

## Test Scenario 2: Skip Payment (Cardless Trial)

### Objective
Verify users can skip payment and get limited trial with upgrade prompt.

### Steps

1. **Open app in incognito/private window**
   - Clear all browser data
   - Navigate to app

2. **Start signup**
   - Enter test email: `test-skip-{timestamp}@example.com`
   - Enter password: `TestPass123!`
   - Create account

3. **Verify "Secure Your Free Trial" screen appears**
   - ✅ Should see payment form
   - ✅ Should see "Skip for now" option at bottom

4. **Skip payment**
   - Click "Skip for now — I'll add it later"
   - ✅ Should see button change to "Starting limited trial..."
   - ✅ Should see toast: "Trial started! Check your email for next steps."
   - ✅ Should transition to OnboardingWizard

5. **Complete onboarding wizard**
   - Select phone number
   - Enter business details
   - ✅ Should complete successfully

6. **Verify dashboard shows limited banner**
   - ✅ Should see dashboard
   - ✅ **Should see "Limited Trial Banner" at top**
   - ✅ Banner should say: "You're using 0 of 30 limited trial minutes"
   - ✅ Banner should have "Unlock Full Trial" button
   - ✅ Banner should have X (dismiss) button

### Database Verification

```sql
-- Get the account
SELECT
  a.id,
  p.email,
  a.has_payment_method,
  a.trial_status,
  a.trial_type,
  a.stripe_customer_id,
  a.created_at
FROM accounts a
JOIN profiles p ON p.account_id = a.id
WHERE p.email = 'test-skip-{timestamp}@example.com';

-- Expected results:
-- has_payment_method: false ✅
-- trial_status: 'pending_card' ✅
-- trial_type: 'cardless' ✅
-- stripe_customer_id: NULL or has value (customer may be created for future use) ⚠️
```

### Analytics Verification

```sql
-- Check trial events
SELECT
  event_type,
  event_data,
  created_at
FROM trial_events
WHERE account_id = (
  SELECT account_id FROM profiles WHERE email = 'test-skip-{timestamp}@example.com'
)
ORDER BY created_at;

-- Expected events:
-- 1. trial_started with event_data: {"trial_type": "cardless"} ✅
```

---

## Test Scenario 3: Cardless User Upgrades Later

### Objective
Verify cardless users can add payment method later and get upgraded to full trial.

### Prerequisites
- Complete Test Scenario 2 first
- Stay logged in as the cardless user

### Steps

1. **Verify limited banner is visible**
   - ✅ Should see banner at top of dashboard
   - ✅ Banner should say "Limited Trial Active"

2. **Click upgrade button**
   - Click "Unlock Full Trial" button on banner
   - ✅ Payment dialog should open
   - ✅ Should see same "Secure Your Free Trial" screen

3. **Enter payment information**
   - Card: `4242 4242 4242 4242`
   - Expiry: `12/25`
   - CVC: `123`
   - ZIP: `12345`

4. **Submit payment**
   - Click "Secure My Trial"
   - ✅ Should see "Processing..."
   - ✅ Should see success toast
   - ✅ Dialog should close
   - ✅ **Banner should disappear immediately**

5. **Verify dashboard**
   - ✅ Limited trial banner should be gone
   - ✅ Should now show 150 minutes available

### Database Verification

```sql
-- Check account was upgraded
SELECT
  a.id,
  p.email,
  a.has_payment_method,
  a.trial_status,
  a.trial_type,
  a.stripe_customer_id
FROM accounts a
JOIN profiles p ON p.account_id = a.id
WHERE p.email = 'test-skip-{timestamp}@example.com';

-- Expected results:
-- has_payment_method: true ✅ (changed from false)
-- trial_status: 'active' ✅ (may still be 'pending_card', but has_payment_method matters)
-- trial_type: 'cardless' ✅ (stays cardless, but has_payment_method changes)
-- stripe_customer_id: NOT NULL ✅
```

### Stripe Verification

1. Go to Stripe Dashboard → Customers
2. Find customer by email
3. ✅ Customer should now have payment method attached

### Analytics Verification

```sql
-- Check upgrade event logged
SELECT
  event_type,
  event_data,
  created_at
FROM trial_events
WHERE account_id = (
  SELECT account_id FROM profiles WHERE email = 'test-skip-{timestamp}@example.com'
)
ORDER BY created_at DESC
LIMIT 1;

-- Expected latest event:
-- event_type: 'payment_method_added' ✅
-- (may also have 'trial_promoted' if implemented)
```

---

## Test Scenario 4: Payment Failure Handling

### Objective
Verify error handling when payment fails and user can retry or skip.

### Steps

1. **Open app in incognito window**
2. **Start signup with new account**
   - Email: `test-fail-{timestamp}@example.com`
3. **On payment screen, use declining card**
   - Card: `4000 0000 0000 0002`
   - Expiry: `12/25`, CVC: `123`, ZIP: `12345`
4. **Click "Secure My Trial"**
   - ✅ Should see error message (red alert)
   - ✅ Error should say "Your card was declined"
   - ✅ Form should still be visible (can retry)
   - ✅ "Skip for now" button should still work

5. **Retry with valid card**
   - Change card to: `4242 4242 4242 4242`
   - Click "Secure My Trial" again
   - ✅ Should succeed this time

### Database Verification

```sql
-- Account should show successful payment
SELECT
  a.has_payment_method,
  a.trial_status,
  a.trial_type
FROM accounts a
JOIN profiles p ON p.account_id = a.id
WHERE p.email = 'test-fail-{timestamp}@example.com';

-- Expected:
-- has_payment_method: true ✅
-- trial_status: 'active' ✅
-- trial_type: 'card_required' ✅
```

---

## Test Scenario 5: 3D Secure Card

### Objective
Verify 3D Secure authentication flow works correctly.

### Steps

1. **Start signup**
   - Email: `test-3ds-{timestamp}@example.com`
2. **Use 3D Secure test card**
   - Card: `4000 0027 6000 3184`
   - Expiry: `12/25`, CVC: `123`, ZIP: `12345`
3. **Click "Secure My Trial"**
   - ✅ Should open Stripe 3D Secure modal
   - ✅ Click "Complete" in the modal
   - ✅ Should see success and continue to wizard

### Database Verification

```sql
-- Should succeed like normal card
SELECT has_payment_method, trial_type
FROM accounts a
JOIN profiles p ON p.account_id = a.id
WHERE p.email = 'test-3ds-{timestamp}@example.com';

-- Expected:
-- has_payment_method: true ✅
-- trial_type: 'card_required' ✅
```

---

## Test Scenario 6: Existing User (Backward Compatibility)

### Objective
Verify existing accounts work correctly after migration.

### Database Verification

```sql
-- Check existing accounts were backfilled correctly
SELECT
  id,
  email,
  has_payment_method,
  trial_status,
  trial_type,
  stripe_customer_id IS NOT NULL as has_stripe_id,
  subscription_status,
  trial_end_date
FROM accounts
WHERE created_at < '2025-11-07'  -- Before hybrid trial deployment
ORDER BY created_at DESC
LIMIT 10;

-- Expected:
-- All accounts should have:
-- - has_payment_method: true if stripe_customer_id exists, false otherwise ✅
-- - trial_status: 'converted' if subscription_status='active', 'expired' if past trial_end_date, 'active' otherwise ✅
-- - trial_type: 'card_required' (all existing users get full access) ✅
```

---

## Test Scenario 7: Edge Function Direct Testing

### Objective
Test edge functions directly via curl (without UI).

### Prerequisites
- Get your Supabase URL and anon key from dashboard
- Have a valid user auth token

### Steps

#### 7.1 Test create-setup-intent

```bash
# Get auth token first (login via UI, check network tab for Bearer token)
AUTH_TOKEN="your-auth-token"
ACCOUNT_ID="your-account-id"
SUPABASE_URL="https://your-project.supabase.co"

curl -X POST "${SUPABASE_URL}/functions/v1/create-setup-intent" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"accountId\": \"${ACCOUNT_ID}\"}"

# Expected response:
# {"clientSecret": "seti_xxx_secret_xxx", "customerId": "cus_xxx"}
```

#### 7.2 Test skip-card-trial

```bash
curl -X POST "${SUPABASE_URL}/functions/v1/skip-card-trial" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"accountId\": \"${ACCOUNT_ID}\"}"

# Expected response:
# {"ok": true, "message": "Cardless trial started", "trial_type": "cardless"}
```

---

## Test Scenario 8: Banner Dismissal

### Objective
Verify limited trial banner can be dismissed.

### Steps

1. **Login as cardless user** (from Scenario 2)
2. **Verify banner is visible**
3. **Click X button** in top-right of banner
   - ✅ Banner should disappear
4. **Refresh page**
   - ⚠️ Banner should reappear (dismissal is session-only, not persisted)

---

## Test Scenario 9: Banner Warning State

### Objective
Verify banner shows warning when usage is high.

### Manual Database Edit

```sql
-- Simulate high usage for cardless user
UPDATE accounts
SET trial_type = 'cardless',
    has_payment_method = false
WHERE id = 'your-cardless-account-id';

-- TODO: Need to track minutes_used in database or elsewhere
-- For now, can test by passing minutesUsed prop directly
```

### Expected Behavior
- When `minutesUsed / minutesLimit >= 0.7` (70%+):
  - ✅ Banner should turn red (destructive variant)
  - ✅ Should show warning: "⚠️ You've used 70% of your limited minutes"
  - ✅ "Unlock Full Trial" button should be red

---

## Common Issues and Solutions

### Issue: Payment form not loading

**Symptoms:**
- Blank screen instead of Stripe payment form
- Console error: "Stripe is not defined"

**Solutions:**
1. Check VITE_STRIPE_PUBLISHABLE_KEY is set in .env
2. Restart dev server (`npm run dev`)
3. Hard refresh browser (Cmd+Shift+R)
4. Check browser console for errors

### Issue: "Failed to create Setup Intent"

**Symptoms:**
- Error toast appears immediately
- No payment form shown

**Solutions:**
1. Check Supabase function logs for create-setup-intent
2. Verify STRIPE_SECRET_KEY is set in Supabase Edge Function secrets
3. Check Stripe Dashboard → Logs for API errors
4. Verify accountId is valid UUID

### Issue: Payment succeeds but banner still shows

**Symptoms:**
- Card added successfully
- Toast says success
- But limited trial banner still visible

**Solutions:**
1. Check database: `SELECT has_payment_method FROM accounts WHERE id = '...'`
2. If false, check Supabase logs for confirm-payment-method function
3. Hard refresh browser to clear cached account data
4. Check Stripe Dashboard to verify payment method was attached

### Issue: No analytics events

**Symptoms:**
- `trial_events` table is empty after testing

**Solutions:**
1. Check if log_trial_event function exists:
   ```sql
   SELECT routine_name FROM information_schema.routines WHERE routine_name = 'log_trial_event';
   ```
2. Test function manually:
   ```sql
   SELECT log_trial_event(
     'test-account-id'::uuid,
     'test_event',
     '{"test": true}'::jsonb
   );
   ```
3. Check Supabase function logs for errors

---

## Success Criteria

✅ **All 9 test scenarios pass without errors**

### Specific Checks:
- ✅ Card payment flow completes successfully
- ✅ Skip payment creates cardless trial
- ✅ Limited banner appears for cardless users
- ✅ Cardless users can upgrade via banner
- ✅ Banner disappears after upgrade
- ✅ Payment failures show clear errors and allow retry
- ✅ 3D Secure cards work correctly
- ✅ Existing accounts remain functional
- ✅ Edge functions respond correctly
- ✅ Database records are correct
- ✅ Stripe customers are created properly
- ✅ Analytics events are logged

---

## Performance Checks

### Page Load Time
- Payment screen should load in < 2 seconds
- Stripe Payment Element should appear in < 3 seconds

### API Response Time
- create-setup-intent: < 2 seconds
- confirm-payment-method: < 3 seconds
- skip-card-trial: < 1 second

### Database Query Performance
```sql
-- Should return in < 50ms
EXPLAIN ANALYZE
SELECT *
FROM accounts
WHERE trial_type = 'cardless' AND has_payment_method = false;

-- Check if indexes are being used
-- Should see "Index Scan" not "Seq Scan"
```

---

## Cleanup

After testing, you may want to delete test accounts:

```sql
-- Delete test accounts
DELETE FROM accounts
WHERE id IN (
  SELECT account_id
  FROM profiles
  WHERE email LIKE 'test-%@example.com'
);

-- Verify cleanup
SELECT COUNT(*) FROM profiles WHERE email LIKE 'test-%@example.com';
-- Should return 0
```

---

**Last Updated:** 2025-11-07
**Version:** 1.0.0
