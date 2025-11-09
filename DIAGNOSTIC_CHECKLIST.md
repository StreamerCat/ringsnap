# Stripe & VAPI Diagnostic Checklist

## Issue: Stripe and VAPI functions not working

### Step 1: Verify Edge Function Deployment

**Check deployment timestamp:**
1. Go to Supabase Dashboard → Edge Functions → free-trial-signup
2. Look at deployment timestamp
3. Should be very recent (today)
4. If old timestamp → edge function NOT deployed

**Deploy if needed:**
```bash
cd /home/user/ringsnap
supabase functions deploy free-trial-signup
```

Or copy/paste from `supabase/functions/free-trial-signup/index.ts` into Supabase Dashboard

### Step 2: Verify Environment Variables

**Go to: Supabase Dashboard → Edge Functions → Environment Variables**

Check these are set:
- [ ] `STRIPE_SECRET_KEY` - starts with `sk_test_` or `sk_live_`
- [ ] `STRIPE_PRICE_STARTER` - starts with `price_`
- [ ] `STRIPE_PRICE_PROFESSIONAL` - starts with `price_`
- [ ] `STRIPE_PRICE_PREMIUM` - starts with `price_`
- [ ] `SUPABASE_URL` - your project URL
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - service role key

**Missing variables = edge function will fail**

### Step 3: Check Edge Function Logs

**Location:** Supabase Dashboard → Edge Functions → free-trial-signup → Logs

**After signup attempt, look for:**

✅ **Success Path** (should see all these):
```
Trial user created successfully
Initializing Stripe
Creating Stripe customer
Stripe customer created
Creating Stripe subscription
Stripe subscription created
Creating account record
Account created successfully
Creating profile record
Profile created successfully
Starting VAPI provisioning in background
Returning success response
```

❌ **Failure Indicators:**
- Logs stop at "Initializing Stripe" → Stripe key missing
- Logs stop at "Creating Stripe customer" → Stripe API error
- Logs stop at "Creating Stripe subscription" → Price ID missing/wrong
- Logs stop at "Creating account record" → Database error
- Logs stop at "Creating profile record" → Database/RLS error
- No logs at all → Edge function not deployed or request not reaching it

### Step 4: Check Database Records

**Run in Supabase SQL Editor:**

```sql
-- Check signup attempts
SELECT
  created_at,
  email,
  success,
  blocked_reason
FROM signup_attempts
ORDER BY created_at DESC
LIMIT 3;
```

**Expected:**
- `success: true` for successful signup
- `success: false` + `blocked_reason` for failures

```sql
-- Check what was created
SELECT
  auth.users.id as user_id,
  auth.users.email,
  auth.users.created_at as user_created,
  a.id as account_id,
  a.stripe_customer_id,
  a.stripe_subscription_id,
  a.plan_type,
  p.id as profile_id,
  p.name,
  p.phone
FROM auth.users
LEFT JOIN profiles p ON p.id = auth.users.id
LEFT JOIN accounts a ON a.id = p.account_id
ORDER BY auth.users.created_at DESC
LIMIT 1;
```

**Interpretation:**
- `user_id` exists but `stripe_customer_id` null → Stripe failed
- `user_id` exists but `account_id` null → Account creation failed
- `user_id` exists but `profile_id` null → Profile creation failed
- All NULL → User creation failed

### Step 5: Check Stripe Dashboard

**Go to:** Stripe Dashboard → Customers

**Search for recent customer** (by email used in signup)

**If customer exists:**
- ✅ Stripe integration working
- Check if subscription exists on customer
- If no subscription → subscription creation failed

**If customer doesn't exist:**
- ❌ Stripe integration not working
- Check environment variables
- Check edge function logs for Stripe errors

### Step 6: Check Browser Console

**During signup, check console for:**

**Successful signup shows:**
```
✅ Trial signup successful!
📦 Edge function response: { data: {...}, error: null }
```

**Failed signup shows:**
```
❌ Edge function error: {...}
FunctionsFetchError: Failed to send a request
or
Error response from edge function
```

### Step 7: Common Issues & Fixes

#### Issue: "Price ID not configured for plan"
**Cause:** Missing `STRIPE_PRICE_*` environment variables
**Fix:** Add price IDs to edge function environment variables

#### Issue: Stripe customer not created
**Cause:** Invalid `STRIPE_SECRET_KEY`
**Fix:** Verify key in Stripe Dashboard → Developers → API Keys

#### Issue: Timeout still occurring
**Cause:** Edge function not deployed with async fix
**Fix:** Deploy edge function again

#### Issue: "Profile or account not found" (500)
**Cause:** RLS policies blocking insert
**Fix:** Check RLS policies on `accounts` and `profiles` tables

#### Issue: VAPI not provisioning
**Cause:** `provision-resources` edge function issue (separate from this fix)
**Fix:** Check `provision-resources` edge function logs

### Step 8: Test with Fresh Data

**Use completely fresh test data:**
- New email (never used before)
- New phone number
- Test card: `4242 4242 4242 4242`
- Any expiry date in future
- Any 3-digit CVC

**Avoid:**
- Reusing email addresses
- Reusing phone numbers (rate limited)
- Real credit cards in test mode

### Step 9: Verify RLS Policies

**Check accounts table RLS:**
```sql
-- Service role should be able to insert accounts
SELECT * FROM pg_policies
WHERE tablename = 'accounts';
```

**Check profiles table RLS:**
```sql
-- Service role should be able to insert profiles
SELECT * FROM pg_policies
WHERE tablename = 'profiles';
```

**Note:** Edge functions use service role key, which should bypass RLS. If RLS is blocking, there's a configuration issue.

### Step 10: Network Issues

**Check if Supabase can reach external APIs:**
- Stripe API (api.stripe.com)
- VAPI API

**Firewall/network restrictions could block:**
- Outbound HTTPS to Stripe
- Outbound HTTPS to VAPI

---

## Quick Debug Script

Run this after a signup attempt:

```sql
-- Get latest signup details
WITH latest_signup AS (
  SELECT email, created_at
  FROM signup_attempts
  ORDER BY created_at DESC
  LIMIT 1
)
SELECT
  'signup_attempt' as source,
  sa.email,
  sa.success,
  sa.blocked_reason,
  sa.created_at
FROM signup_attempts sa
JOIN latest_signup ls ON sa.email = ls.email AND sa.created_at = ls.created_at

UNION ALL

SELECT
  'user' as source,
  auth.users.email,
  CASE WHEN auth.users.id IS NOT NULL THEN true ELSE false END as exists,
  NULL as reason,
  auth.users.created_at
FROM latest_signup ls
LEFT JOIN auth.users ON auth.users.email = ls.email

UNION ALL

SELECT
  'account' as source,
  auth.users.email,
  CASE WHEN a.id IS NOT NULL THEN true ELSE false END as exists,
  a.stripe_customer_id,
  a.created_at
FROM latest_signup ls
LEFT JOIN auth.users ON auth.users.email = ls.email
LEFT JOIN accounts a ON a.owner_id = auth.users.id

UNION ALL

SELECT
  'profile' as source,
  auth.users.email,
  CASE WHEN p.id IS NOT NULL THEN true ELSE false END as exists,
  p.phone,
  p.created_at
FROM latest_signup ls
LEFT JOIN auth.users ON auth.users.email = ls.email
LEFT JOIN profiles p ON p.id = auth.users.id
ORDER BY created_at DESC;
```

This shows exactly what was created and what failed.
