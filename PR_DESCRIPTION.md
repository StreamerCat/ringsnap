## Summary

Fixes critical timeout issue in trial signup flow by making VAPI provisioning asynchronous.

## Problem

The trial signup edge function was timing out with "FunctionsFetchError: Failed to send a request" because it was **blocking for 1-2 minutes** waiting for VAPI resources to provision. This caused:
- Edge function timeout (exceeds 60-second limit)
- Users stuck on "Processing..." spinner
- Signup failures even when Stripe payment succeeded

## Solution

Changed VAPI provisioning from **synchronous (blocking)** to **asynchronous (fire-and-forget)**:

**Before (BLOCKING)**:
```typescript
const provisionResponse = await supabase.functions.invoke('provision-resources', {...});
// ☝️ Waits 1-2 minutes for VAPI = TIMEOUT
```

**After (ASYNC)**:
```typescript
supabase.functions.invoke('provision-resources', {...})
  .then((response) => { /* log success */ })
  .catch((error) => { /* log error */ });
// ☝️ Triggers but doesn't wait = NO TIMEOUT
```

## Changes Made

### 1. Async VAPI Provisioning (Lines 346-384)
- Removed `await` from `provision-resources` edge function call
- Changed to fire-and-forget pattern with `.then()/.catch()`
- Edge function no longer waits for VAPI completion
- VAPI provisioning happens in background

### 2. Enhanced Logging
Added detailed logging at each step:
- `Initializing Stripe` (line 200)
- `Creating Stripe customer` (line 211)
- `Stripe customer created` (line 232)
- `Creating Stripe subscription` (line 250)
- `Stripe subscription created` (line 271)
- `Creating account record` (line 281)
- `Account created successfully` (line 310)
- `Creating profile record` (line 316)
- `Profile created successfully` (line 341)
- `Starting VAPI provisioning in background` (line 348)
- `Returning success response` (line 395)

This allows pinpointing exactly where any issues occur.

## New Flow

1. ✅ Create auth user (instant)
2. ✅ Create Stripe customer + subscription with 3-day trial (1-2 seconds)
3. ✅ Create account record (instant)
4. ✅ Create profile record (instant)
5. ✅ **Trigger VAPI provisioning in background** (fire-and-forget)
6. ✅ **Return success immediately** (5-15 second total)
7. 🔄 VAPI finishes provisioning 1-2 minutes later

## Deployment Instructions

**CRITICAL: After merging, you MUST deploy the edge function to Supabase**

### Option 1: Supabase CLI
```bash
cd /home/user/ringsnap
supabase functions deploy free-trial-signup
```

### Option 2: Supabase Dashboard
1. Go to **Supabase Dashboard** → **Edge Functions**
2. Find `free-trial-signup`
3. Click **Deploy new version**
4. Copy entire contents from `supabase/functions/free-trial-signup/index.ts`
5. Paste into editor
6. Click **Deploy**

### Verify Deployment
Check deployment timestamp in Supabase Dashboard → Edge Functions → free-trial-signup

## Expected Results

✅ No more timeout errors
✅ Signup completes in 5-15 seconds (not 1-2 minutes)
✅ Stripe customer + subscription created immediately
✅ User redirected to dashboard/confirmation page
✅ VAPI provisions in background (check after 2-3 mins)

## Testing

### 1. Test Signup Flow
1. Go to trial signup page
2. Fill out form with test data
3. Use test card: `4242 4242 4242 4242`
4. Submit form
5. **Should complete within 15 seconds**

### 2. Verify in Stripe Dashboard
- Customer should be created
- Subscription should exist with status `trialing`
- Trial period: 3 days

### 3. Verify in Supabase Database
```sql
-- Check most recent signup
SELECT
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

Expected: All fields populated

### 4. Check Edge Function Logs
**Supabase Dashboard → Edge Functions → free-trial-signup → Logs**

Should see all log messages in order:
```
✓ Trial user created successfully
✓ Initializing Stripe
✓ Creating Stripe customer
✓ Stripe customer created
✓ Creating Stripe subscription
✓ Stripe subscription created
✓ Creating account record
✓ Account created successfully
✓ Creating profile record
✓ Profile created successfully
✓ Starting VAPI provisioning in background
✓ Returning success response
```

### 5. Verify VAPI Provisioning (After 2-3 minutes)
```sql
SELECT
  account_id,
  vapi_phone_number_id,
  vapi_assistant_id,
  provisioning_status
FROM accounts
ORDER BY created_at DESC
LIMIT 1;
```

Expected: VAPI fields populated after background provisioning completes

## Troubleshooting

### If signup still times out:
1. Verify edge function was deployed (check timestamp)
2. Check edge function logs - where do they stop?
3. Verify environment variables are set

### Required Environment Variables
In Supabase Dashboard → Edge Functions → Environment Variables:
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_STARTER`
- `STRIPE_PRICE_PROFESSIONAL`
- `STRIPE_PRICE_PREMIUM`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Files Changed

- `supabase/functions/free-trial-signup/index.ts` - Async VAPI + enhanced logging
- `ASYNC_VAPI_FIX_DEPLOYMENT.md` - Deployment guide
- `PR_DESCRIPTION.md` - This file

## Test Plan

- [ ] Trial signup completes without timeout
- [ ] Signup completes in under 15 seconds
- [ ] Stripe customer created
- [ ] Stripe subscription created with 3-day trial
- [ ] Account record created in database
- [ ] Profile record created in database
- [ ] User redirected to dashboard/confirmation page
- [ ] No console errors in browser
- [ ] VAPI resources provision in background (verify after 2-3 mins)
- [ ] All edge function logs appear in order
