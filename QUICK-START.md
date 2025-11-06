# Quick Start Guide - Hybrid Trial Deployment

## TL;DR

All code is written and committed. Follow these steps to deploy:

1. **Set Stripe Keys** (5 minutes)
2. **Run Migration** (2 minutes)
3. **Deploy Functions** (3 minutes)
4. **Test** (15 minutes)

---

## Step 1: Get Stripe Keys

### Test Mode (Recommended First)

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)
2. Copy **Publishable key**: starts with `pk_test_...`
3. Copy **Secret key**: starts with `sk_test_...`

### Add to Project

**Frontend (.env file):**
```bash
echo "VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxx" >> .env
npm run dev  # Restart dev server
```

**Backend (Supabase Dashboard):**
1. Go to: Settings → Edge Functions → Secrets
2. Add secret: `STRIPE_SECRET_KEY` = `sk_test_xxxxxxxxxxxxx`
3. Click "Save"

---

## Step 2: Deploy Migration

### Option A: Supabase Dashboard (Easiest)

1. Go to: SQL Editor in Supabase Dashboard
2. Open file: `supabase/migrations/20251107000000_hybrid_trial_fields.sql`
3. Copy entire contents
4. Paste into SQL Editor
5. Click "Run" ▶️
6. Should see: ✅ "Success. No rows returned"

### Option B: Supabase CLI

```bash
# If you have Supabase CLI installed
supabase link --project-ref your-project-ref
supabase db push
```

### Verify Migration

Run this in SQL Editor:

```sql
-- Should return 3 rows
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'accounts'
  AND column_name IN ('has_payment_method', 'trial_status', 'trial_type');

-- Should return 0 (empty table)
SELECT COUNT(*) FROM trial_events;
```

✅ **Migration successful if both queries work!**

---

## Step 3: Deploy Edge Functions

```bash
# Deploy all 3 functions
supabase functions deploy create-setup-intent
supabase functions deploy confirm-payment-method
supabase functions deploy skip-card-trial
```

### Verify Deployment

1. Go to: Edge Functions in Supabase Dashboard
2. Should see 3 new functions with status "Active"

---

## Step 4: Test End-to-End

### Test 1: Add Payment (Happy Path)

1. **Open app in incognito window**
2. **Sign up** with test email: `test@example.com`
3. **On payment screen**, enter test card:
   - Card: `4242 4242 4242 4242`
   - Expiry: `12/25`
   - CVC: `123`
   - ZIP: `12345`
4. **Click "Secure My Trial"**
5. ✅ Should see: "Payment method added successfully!"
6. ✅ Should proceed to onboarding wizard
7. ✅ No "Limited Trial Banner" on dashboard

**Verify in database:**
```sql
SELECT has_payment_method, trial_type
FROM accounts a
JOIN profiles p ON p.account_id = a.id
WHERE p.email = 'test@example.com';

-- Expected: has_payment_method = true, trial_type = 'card_required'
```

### Test 2: Skip Payment (Cardless)

1. **Open app in incognito window**
2. **Sign up** with different email
3. **On payment screen**, click "Skip for now"
4. ✅ Should see: "Trial started!"
5. ✅ Should proceed to wizard
6. ✅ **Should see "Limited Trial Banner" on dashboard**

**Verify in database:**
```sql
SELECT has_payment_method, trial_type
FROM accounts a
JOIN profiles p ON p.account_id = a.id
WHERE p.email = 'your-skip-email@example.com';

-- Expected: has_payment_method = false, trial_type = 'cardless'
```

### Test 3: Cardless Upgrade

1. **Using cardless account from Test 2**
2. **Click "Unlock Full Trial"** on banner
3. **Enter test card** (same as Test 1)
4. **Click "Secure My Trial"**
5. ✅ Banner should disappear
6. ✅ Should now have full access

---

## Quick Troubleshooting

### "Stripe is not defined"
- Check: VITE_STRIPE_PUBLISHABLE_KEY in .env
- Restart: `npm run dev`

### "Failed to create Setup Intent"
- Check: STRIPE_SECRET_KEY in Supabase Edge Function secrets
- Check: Supabase function logs for errors

### Payment succeeds but banner still shows
- Check database: `SELECT has_payment_method FROM accounts WHERE id = '...'`
- Hard refresh browser: Cmd+Shift+R (Mac) or Ctrl+Shift+F5 (Windows)

### Banner not showing for cardless user
- Check: Should be `trial_type = 'cardless'` AND `has_payment_method = false`
- Hard refresh browser

---

## Full Documentation

For complete details, see:

- **[DEPLOYMENT-GUIDE.md](./DEPLOYMENT-GUIDE.md)** - Complete deployment instructions (7 phases)
- **[test-hybrid-trial.md](./test-hybrid-trial.md)** - 9 detailed test scenarios
- **[verify-deployment.sql](./verify-deployment.sql)** - Automated verification script
- **[docs/hybrid-trial.md](./docs/hybrid-trial.md)** - Complete technical architecture (500+ lines)
- **[AUDIT-SUMMARY.md](./AUDIT-SUMMARY.md)** - Summary of all changes made

---

## What's Next After Testing?

### Phase 2 (Optional):
1. **Email Integration**
   - Add RESEND_API_KEY to Supabase secrets
   - Implement email sending in skip-card-trial function
   - Test activation and reminder emails

2. **Monitoring**
   - Set up dashboard for trial funnel metrics
   - Track conversion rates (card vs cardless)
   - Monitor upgrade rate from cardless

3. **A/B Testing**
   - Test 30 vs 60 minute cardless limit
   - Test different payment screen headlines
   - Optimize upgrade messaging

---

## Need Help?

**Check logs:**
- Supabase Dashboard → Edge Functions → Logs
- Browser Console (F12)
- Stripe Dashboard → Logs

**Common files:**
- Frontend payment UI: `src/components/onboarding/SecureTrialStep.tsx`
- Payment hook: `src/hooks/useSetupIntent.ts`
- Backend Setup Intent: `supabase/functions/create-setup-intent/index.ts`
- Backend confirm: `supabase/functions/confirm-payment-method/index.ts`
- Backend skip: `supabase/functions/skip-card-trial/index.ts`

---

## Success Checklist

- ✅ Stripe keys set (frontend + backend)
- ✅ Migration deployed
- ✅ 3 edge functions deployed and active
- ✅ Test 1: Card payment works
- ✅ Test 2: Skip creates cardless trial
- ✅ Test 3: Cardless user can upgrade
- ✅ Database records correct
- ✅ Stripe customers created
- ✅ Analytics events logging

**If all checked:** 🎉 Deployment successful!

---

**Last Updated:** 2025-11-07
**Estimated Time:** ~25 minutes for complete deployment and testing
