# Hybrid Trial Deployment Guide

## Overview
This guide provides step-by-step instructions to deploy the hybrid trial system to production.

## Prerequisites

- [x] All code committed to branch `claude/audit-signup-onboarding-architecture-011CUsJCxti72HJy9QVN4MYX`
- [ ] Access to Supabase Dashboard
- [ ] Access to Stripe Dashboard
- [ ] Supabase CLI installed (`npm install -g supabase`)

## Phase 1: Environment Variables

### 1.1 Stripe Configuration

1. **Get Stripe Keys:**
   - Go to [Stripe Dashboard](https://dashboard.stripe.com/)
   - Navigate to Developers → API keys
   - Copy your **Publishable key** (starts with `pk_test_` for test mode)
   - Copy your **Secret key** (starts with `sk_test_` for test mode)

2. **Add to Supabase Edge Functions:**
   ```bash
   # In Supabase Dashboard:
   # Settings → Edge Functions → Secrets

   STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx
   ```

3. **Add to Frontend (.env):**
   ```bash
   # In your .env file:
   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxx
   ```

4. **Update .env.example:**
   ```bash
   # Add these lines to .env.example
   VITE_STRIPE_PUBLISHABLE_KEY="your-stripe-publishable-key"
   STRIPE_SECRET_KEY="your-stripe-secret-key"
   ```

### 1.2 Email Configuration (Optional - Phase 2)

For activation and reminder emails (can be added later):

```bash
# In Supabase Edge Function Secrets:
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM="RingSnap <support@getringsnap.com>"
```

## Phase 2: Database Migration

### 2.1 Test Migration Locally (Recommended)

```bash
# Start local Supabase
supabase start

# Run migration
supabase db push

# Verify tables and columns
supabase db diff

# Check accounts table structure
psql postgresql://postgres:postgres@localhost:54322/postgres \
  -c "\\d+ accounts"

# Check trial_events table
psql postgresql://postgres:postgres@localhost:54322/postgres \
  -c "\\d+ trial_events"
```

### 2.2 Deploy to Production

**Option A: Via Supabase Dashboard (Recommended)**

1. Go to Supabase Dashboard
2. Navigate to SQL Editor
3. Open `supabase/migrations/20251107000000_hybrid_trial_fields.sql`
4. Copy the entire contents
5. Paste into SQL Editor
6. Click "Run"
7. Verify success (should see "Success. No rows returned")

**Option B: Via Supabase CLI**

```bash
# Link to your project
supabase link --project-ref your-project-ref

# Push migration
supabase db push
```

### 2.3 Verify Migration Success

Run these queries in Supabase SQL Editor:

```sql
-- Check new columns exist
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'accounts'
  AND column_name IN ('has_payment_method', 'trial_status', 'trial_type');

-- Should return 3 rows

-- Check trial_events table exists
SELECT COUNT(*) FROM trial_events;

-- Should return 0 (empty table)

-- Check log_trial_event function exists
SELECT routine_name
FROM information_schema.routines
WHERE routine_name = 'log_trial_event';

-- Should return 1 row
```

## Phase 3: Deploy Edge Functions

### 3.1 Deploy via Supabase CLI

```bash
# Deploy create-setup-intent
supabase functions deploy create-setup-intent

# Deploy confirm-payment-method
supabase functions deploy confirm-payment-method

# Deploy skip-card-trial
supabase functions deploy skip-card-trial
```

### 3.2 Verify Functions Deployed

1. Go to Supabase Dashboard → Edge Functions
2. Verify you see:
   - ✅ create-setup-intent
   - ✅ confirm-payment-method
   - ✅ skip-card-trial
3. Check each function has status "Active"

### 3.3 Test Functions (Quick Smoke Test)

```bash
# Get your Supabase anon key and URL
SUPABASE_URL="https://your-project.supabase.co"
ANON_KEY="your-anon-key"

# Test create-setup-intent (will fail auth, but confirms function exists)
curl -X POST "${SUPABASE_URL}/functions/v1/create-setup-intent" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"accountId": "test"}'

# Expected: 401 error (function exists but needs real auth)
# Bad: 404 error (function not deployed)
```

## Phase 4: Frontend Deployment

### 4.1 Update Environment Variables

```bash
# Ensure .env has the Stripe publishable key
echo "VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxx" >> .env

# Restart dev server
npm run dev
```

### 4.2 Build and Deploy

```bash
# Build for production
npm run build

# Deploy to your hosting (Vercel/Netlify/etc)
# Example for Vercel:
vercel --prod

# Make sure to set VITE_STRIPE_PUBLISHABLE_KEY in your hosting platform's env vars
```

## Phase 5: Testing

### 5.1 Test Trial Signup with Payment

1. **Clear browser cache** and open app in incognito
2. Navigate to signup page
3. Create new account
4. Should see "Secure Your Free Trial" screen
5. Enter test card: `4242 4242 4242 4242`
6. Expiry: `12/25`, CVC: `123`, ZIP: `12345`
7. Click "Secure My Trial"
8. Should see success message and wizard
9. **Verify in database:**
   ```sql
   SELECT
     id,
     email,
     has_payment_method,
     trial_status,
     trial_type,
     stripe_customer_id
   FROM accounts
   ORDER BY created_at DESC
   LIMIT 1;
   ```
   Should show: `has_payment_method = true`, `trial_type = 'card_required'`

### 5.2 Test Trial Signup without Payment

1. **Clear browser cache** and open app in incognito
2. Create new account
3. On "Secure Your Free Trial" screen, click "Skip for now"
4. Should see success toast: "Trial started!"
5. Complete wizard
6. Should see dashboard with **Limited Trial Banner**
7. **Verify in database:**
   ```sql
   SELECT
     id,
     email,
     has_payment_method,
     trial_status,
     trial_type
   FROM accounts
   ORDER BY created_at DESC
   LIMIT 1;
   ```
   Should show: `has_payment_method = false`, `trial_type = 'cardless'`, `trial_status = 'pending_card'`

### 5.3 Test Cardless User Upgrade

1. Using the cardless account from 5.2, log in
2. Should see "Limited Trial Banner" on dashboard
3. Click "Unlock Full Trial" button
4. Payment dialog should open
5. Enter test card: `4242 4242 4242 4242`
6. Click "Secure My Trial"
7. Banner should disappear
8. **Verify in database:**
   ```sql
   SELECT
     id,
     has_payment_method,
     trial_status,
     trial_type
   FROM accounts
   WHERE email = 'your-test-email@example.com';
   ```
   Should show: `has_payment_method = true`

### 5.4 Verify Analytics Events

```sql
-- Check events are being logged
SELECT
  te.event_type,
  te.created_at,
  a.trial_type,
  p.email
FROM trial_events te
JOIN accounts a ON a.id = te.account_id
JOIN profiles p ON p.account_id = a.id
ORDER BY te.created_at DESC
LIMIT 10;
```

Expected events:
- `trial_started` (when card added or skipped)
- `payment_method_added` (when card added initially or later)
- `trial_promoted` (when cardless user upgrades)

## Phase 6: Monitoring

### 6.1 Set Up Dashboard Queries

Save these queries in Supabase Dashboard:

**Trial Funnel (Last 7 Days):**
```sql
SELECT
  trial_type,
  COUNT(*) as signups,
  SUM(CASE WHEN has_payment_method THEN 1 ELSE 0 END) as with_payment,
  ROUND(
    SUM(CASE WHEN has_payment_method THEN 1 ELSE 0 END) * 100.0 / COUNT(*),
    2
  ) as payment_rate
FROM accounts
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY trial_type;
```

**Cardless Users Needing Follow-Up:**
```sql
SELECT
  a.id,
  p.email,
  a.created_at,
  EXTRACT(EPOCH FROM (NOW() - a.created_at))/3600 as hours_ago
FROM accounts a
JOIN profiles p ON p.account_id = a.id
WHERE a.trial_type = 'cardless'
  AND a.has_payment_method = false
  AND a.trial_status = 'pending_card'
ORDER BY a.created_at DESC;
```

### 6.2 Check Stripe Dashboard

1. Go to Stripe Dashboard → Customers
2. Verify customers are being created
3. Go to Payments → Payment methods
4. Verify payment methods are being attached

## Phase 7: Rollback Plan (If Needed)

If critical issues arise:

### 7.1 Disable New Signups
```sql
-- Temporarily disable new trials (emergency brake)
UPDATE accounts
SET trial_type = 'card_required'
WHERE trial_type = 'cardless' AND created_at > NOW() - INTERVAL '1 hour';
```

### 7.2 Rollback Migration (Nuclear Option)
```sql
-- Remove trial columns (data loss warning!)
ALTER TABLE accounts
  DROP COLUMN IF EXISTS has_payment_method,
  DROP COLUMN IF EXISTS trial_status,
  DROP COLUMN IF EXISTS trial_type;

DROP TABLE IF EXISTS trial_events CASCADE;
DROP FUNCTION IF EXISTS log_trial_event;
```

**Note:** Only use in extreme cases. Better to fix forward.

## Success Criteria

✅ Migration ran successfully
✅ All 3 edge functions deployed and active
✅ Stripe test cards work for adding payment
✅ Skip flow creates cardless trial
✅ Limited trial banner appears for cardless users
✅ Cardless users can upgrade via banner
✅ Analytics events are logging correctly
✅ Database queries return expected data

## Post-Deployment Tasks

1. **Monitor error logs** for 24 hours
   - Supabase Dashboard → Edge Functions → Logs
   - Check for any errors in create-setup-intent, confirm-payment-method, skip-card-trial

2. **Set up email reminders** (Phase 2)
   - Implement email sending in skip-card-trial function
   - Create email templates
   - Test email delivery

3. **A/B test messaging**
   - Test different headlines for payment screen
   - Test 30 vs 60 minute cardless limit
   - Track conversion rates

4. **Create alerts**
   - Alert if payment method attachment rate < 50%
   - Alert if edge function error rate > 5%
   - Alert if cardless upgrade rate < 10%

## Troubleshooting

### Issue: "Stripe is not defined" error

**Solution:** Check VITE_STRIPE_PUBLISHABLE_KEY is set in .env and restart dev server

### Issue: Setup Intent creation fails

**Solution:**
1. Verify STRIPE_SECRET_KEY is set in Supabase Edge Function secrets
2. Check key format: should start with `sk_test_` or `sk_live_`
3. Check Supabase function logs for detailed error

### Issue: Payment method not attaching

**Solution:**
1. Check browser console for Stripe errors
2. Verify confirm-payment-method function deployed
3. Check Supabase function logs
4. Test with different card (try `4000 0000 0000 0077`)

### Issue: Banner not showing

**Solution:**
1. Check account: `SELECT trial_type, has_payment_method FROM accounts WHERE email = '...'`
2. Should be: `trial_type = 'cardless'` AND `has_payment_method = false`
3. Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+F5)

## Support

- **Documentation:** `docs/hybrid-trial.md`
- **Testing Guide:** `TESTING-CHECKLIST.md`
- **Stripe Docs:** https://stripe.com/docs/payments/save-and-reuse
- **Supabase Docs:** https://supabase.com/docs/guides/functions

---

**Last Updated:** 2025-11-07
**Version:** 1.0.0
