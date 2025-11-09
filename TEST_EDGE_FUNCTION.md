# Test Edge Function - Quick Diagnostic

## Problem: Stripe and VAPI not working

To diagnose the issue, please provide the following information:

## 1. Check Edge Function Logs (MOST IMPORTANT)

**Go to:** Supabase Dashboard → Edge Functions → free-trial-signup → Logs

**After attempting a signup**, copy and paste ALL the log messages you see here.

The logs will tell us exactly where it's failing:
- No logs = Edge function not deployed or not being called
- Logs stop at "Initializing Stripe" = Missing STRIPE_SECRET_KEY
- Logs stop at "Creating Stripe customer" = Stripe API error
- Logs stop at "Creating Stripe subscription" = Missing price IDs
- Logs stop at "Creating account record" = Database error
- Logs show "Returning success response" = Everything worked!

## 2. Verify Environment Variables

**Go to:** Supabase Dashboard → Project Settings → Edge Functions → Manage secrets

Check these exist (just confirm yes/no for each):
- [ ] `STRIPE_SECRET_KEY` exists?
- [ ] `STRIPE_PRICE_STARTER` exists?
- [ ] `STRIPE_PRICE_PROFESSIONAL` exists?
- [ ] `STRIPE_PRICE_PREMIUM` exists?
- [ ] `SUPABASE_URL` exists?
- [ ] `SUPABASE_SERVICE_ROLE_KEY` exists?

**If ANY are missing, that's your problem!**

## 3. Check Deployment Timestamp

**Go to:** Supabase Dashboard → Edge Functions → free-trial-signup

What's the deployment timestamp shown?
- Should be from today (after you deployed the fix)
- If it's old, the edge function wasn't deployed

## 4. Check Browser Console Errors

When you submit the signup form, what errors appear in browser console?

Copy and paste:
- All error messages
- The full "FunctionsFetchError" if present
- Any network errors

## 5. Check Database

Run this SQL in Supabase SQL Editor:

```sql
-- Check what was created in most recent signup
SELECT
  'User' as type,
  auth.users.email,
  auth.users.created_at,
  'Created' as status
FROM auth.users
ORDER BY created_at DESC
LIMIT 1;

SELECT
  'Account' as type,
  a.name as email,
  a.created_at,
  CASE
    WHEN a.stripe_customer_id IS NOT NULL THEN 'Has Stripe customer ✓'
    ELSE 'Missing Stripe customer ✗'
  END as status
FROM accounts a
ORDER BY a.created_at DESC
LIMIT 1;

SELECT
  'Profile' as type,
  p.name as email,
  p.created_at,
  'Created' as status
FROM profiles p
ORDER BY p.created_at DESC
LIMIT 1;
```

What do these return?

## 6. Test Stripe API Key

The Stripe secret key should start with:
- `sk_test_` for test mode
- `sk_live_` for live mode

Verify in Stripe Dashboard → Developers → API keys that you copied the correct key.

## Common Root Causes

### Issue: No Edge Function Logs
**Cause:** Edge function not deployed or request not reaching it
**Fix:** Deploy the edge function again

### Issue: Logs stop at "Initializing Stripe"
**Cause:** `STRIPE_SECRET_KEY` missing or invalid
**Fix:** Add/update Stripe secret key in edge function environment variables

### Issue: Logs stop at "Creating Stripe subscription"
**Cause:** Missing price IDs (STRIPE_PRICE_STARTER, etc.)
**Fix:** Add price IDs from Stripe Dashboard → Products to environment variables

### Issue: Still timing out
**Cause:** Edge function not deployed with async fix
**Fix:** Redeploy edge function

### Issue: "Profile or account not found"
**Cause:** Database insert failed after user creation
**Fix:** Check edge function logs for actual error

## Quick Test Without Signup Form

You can test the edge function directly using this curl command:

```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/free-trial-signup \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "phone": "+15551234567",
    "planType": "starter",
    "paymentMethodId": "pm_card_visa"
  }'
```

Replace:
- `YOUR_PROJECT` with your Supabase project ID
- `YOUR_ANON_KEY` with your anon key

This will show the raw response and help diagnose if it's an edge function issue or frontend issue.

---

## What I Need From You

Please provide:
1. **Edge function logs** (copy/paste everything from Logs section)
2. **Environment variables status** (which ones exist)
3. **Deployment timestamp** (when was it last deployed)
4. **Browser console errors** (full error messages)
5. **Database query results** (what records exist)

With this information, I can pinpoint the exact issue and provide a fix!
