# URGENT: Deploy Async VAPI Fix

## What Was Fixed

The edge function was timing out because it was **waiting for VAPI provisioning** (1-2 minutes), causing the entire signup request to fail with "Failed to fetch" errors.

**The fix**: VAPI provisioning now runs asynchronously in the background. The edge function returns success immediately after creating:
- ✅ Auth user
- ✅ Stripe customer
- ✅ Stripe subscription (3-day trial)
- ✅ Account record
- ✅ Profile record
- 🔄 VAPI provisioning (triggered but not awaited)

## Deploy Instructions

### Option 1: Supabase CLI (Recommended)

```bash
cd /home/user/ringsnap
supabase functions deploy free-trial-signup
```

### Option 2: Supabase Dashboard

1. Go to Supabase Dashboard
2. Navigate to **Edge Functions**
3. Find `free-trial-signup` function
4. Click **Deploy new version**
5. Copy the **entire contents** of `/home/user/ringsnap/supabase/functions/free-trial-signup/index.ts`
6. Paste into the editor
7. Click **Deploy**

## What Changed

**File**: `/home/user/ringsnap/supabase/functions/free-trial-signup/index.ts`

**Lines 317-355**: Removed `await` from VAPI provisioning call

**Before** (BLOCKING - caused timeout):
```typescript
const provisionResponse = await supabase.functions.invoke('provision-resources', {...});
```

**After** (ASYNC - no timeout):
```typescript
supabase.functions.invoke('provision-resources', {...})
  .then((provisionResponse) => { /* log success */ })
  .catch((error) => { /* log error */ });
```

## Expected Behavior After Deployment

### User Experience:
1. User fills out signup form
2. User enters payment details
3. Clicks "Start My Free Trial"
4. **Processing spinner shows for 5-15 seconds** (not 1-2 minutes)
5. ✅ **Success! Redirects to dashboard** or confirmation page
6. VAPI resources provision in background (1-2 minutes)

### Console Logs (Success Path):
```
✅ Trial user created successfully
✅ Stripe customer created
✅ Stripe subscription created
✅ Account created successfully
✅ Profile created successfully
ℹ️ Starting VAPI provisioning in background
✅ Trial signup successful!
```

### What Gets Created Immediately:
- Auth user in Supabase Auth
- Stripe customer
- Stripe subscription (status: `trialing`, 3-day trial)
- Account record in database
- Profile record in database
- Signup attempt logged

### What Happens in Background (1-2 minutes later):
- VAPI phone number provisioned
- VAPI assistant created
- User receives email/SMS when ready

## Testing After Deployment

### Test 1: Happy Path
1. Start fresh signup with new email
2. Select a plan
3. Enter test card: `4242 4242 4242 4242`
4. Submit
5. **Expected**: Success within 15 seconds, no timeout

### Test 2: Verify Stripe
1. Check Stripe Dashboard
2. **Expected**: Customer and subscription created
3. Subscription status: `trialing`
4. Trial end: 3 days from now

### Test 3: Verify Database
Run these queries in Supabase SQL Editor:

```sql
-- Get the most recent signup
SELECT
  a.id as account_id,
  a.stripe_customer_id,
  a.stripe_subscription_id,
  a.plan_type,
  a.subscription_status,
  p.name,
  p.phone,
  auth.users.email
FROM accounts a
JOIN profiles p ON p.account_id = a.id
JOIN auth.users ON auth.users.id = p.id
ORDER BY a.created_at DESC
LIMIT 1;
```

**Expected**: Record with all fields populated

### Test 4: Verify VAPI (After 2-3 minutes)
```sql
-- Check if VAPI resources were created
SELECT
  account_id,
  vapi_phone_number_id,
  vapi_assistant_id,
  provisioning_status
FROM accounts
ORDER BY created_at DESC
LIMIT 1;
```

**Expected** (after waiting 2-3 minutes):
- `vapi_phone_number_id`: populated
- `vapi_assistant_id`: populated
- `provisioning_status`: 'active'

## Troubleshooting

### If still getting timeout:
1. Verify deployment timestamp in Supabase Dashboard
2. Check Edge Function logs for errors
3. Verify environment variables are set

### If Stripe not created:
Check these environment variables in Supabase Dashboard → Functions → Environment Variables:
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_STARTER`
- `STRIPE_PRICE_PROFESSIONAL`
- `STRIPE_PRICE_PREMIUM`

### If VAPI not provisioning:
Check `provision-resources` edge function logs (this runs async now)

## Success Criteria

✅ Signup completes in 5-15 seconds (not timing out)
✅ No "Failed to fetch" errors in console
✅ Stripe customer + subscription created
✅ Account + profile created in database
✅ User redirected to dashboard or confirmation page
✅ VAPI resources provision in background (check after 2-3 mins)

---

**Deploy now and test immediately!**
