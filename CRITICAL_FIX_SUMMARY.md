# 🚨 CRITICAL FIX: Profile Creation Missing

## What Went Wrong

Your trial signup test revealed a **critical bug** in the edge function:

### Symptom
- ✅ Signup appeared successful (no frontend errors)
- ✅ Auth user was created
- ❌ **Dashboard showed: "Profile or account not found" (500 error)**
- ❌ Stripe customer was NOT created
- ❌ VAPI resources were NOT provisioned

### Root Cause
The `free-trial-signup` edge function had the following flow:

```
1. Create auth user ✓
2. Create Stripe customer ✓  
3. Create Stripe subscription ✓
4. Create account record ✓
5. Create profile record ✗ ← MISSING!
6. Provision VAPI resources ✓
7. Return success ✓
```

**The profile creation step was completely missing from the edge function.**

When the dashboard tried to load, it queried:
```sql
SELECT * FROM profiles WHERE id = 'user-id'
```

But the profile didn't exist, causing a **500 error** and preventing dashboard access.

---

## What Was Fixed

**Commit `807364c`**: Added profile creation to the edge function

### Code Added (lines 291-315)

```typescript
// Create profile record
const { error: profileError } = await supabase
  .from('profiles')
  .insert({
    id: authData.user.id,
    account_id: accountData.id,
    name: validatedData.name,
    phone: validatedData.phone,
    is_primary: true,
    source: validatedData.source || 'website',
  });

if (profileError) {
  logError('Profile creation error', {
    ...baseLogOptions,
    error: profileError,
    context: { userId: authData.user.id, accountId: accountData.id }
  });
  throw profileError;
}

logInfo('Profile created successfully', {
  ...baseLogOptions,
  context: { userId: authData.user.id, accountId: accountData.id }
});
```

### New Flow

```
1. Create auth user ✓
2. Create Stripe customer ✓
3. Create Stripe subscription ✓
4. Create account record ✓
5. Create profile record ✓ ← FIXED!
6. Provision VAPI resources ✓
7. Return success ✓
```

---

## 🚀 ACTION REQUIRED: Deploy Edge Function

**The fix has been committed but the edge function MUST be redeployed to Supabase.**

### Option 1: Supabase Dashboard (Quickest)

1. Go to https://supabase.com/dashboard
2. Select your RingSnap project
3. Click **Edge Functions** in sidebar
4. Find `free-trial-signup`
5. Click **Deploy new version**
6. Upload `/supabase/functions/free-trial-signup/index.ts`
7. Click **Deploy**
8. Wait for confirmation

### Option 2: Supabase CLI

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy free-trial-signup
```

---

## ✅ How to Verify the Fix

### Before Testing
1. **IMPORTANT**: Use a **completely fresh email** (not the one you just tested with)
2. **IMPORTANT**: Use a **new phone number** (not used in last 30 days)
3. Open browser console (F12) to monitor logs

### Step 1: Complete Trial Signup

1. Go to trial signup page
2. Fill out all fields with fresh data
3. Select a plan
4. Enter Stripe test card: `4242 4242 4242 4242`
5. Submit

### Step 2: Check Console Logs

You should see:

```
✅ Plan selected: professional
📋 planType changed to: professional
🚀 Starting trial signup submission...
💳 Creating Stripe payment method...
✅ Payment method created: pm_xxxxxxxxxxxxx
📞 Calling edge function with request body:
  - planType: professional (type: string)
✅ Trial signup successful!
🔐 Auto-logging in user...
✅ Auto-login successful! Session: active
🔄 Redirecting in 1.5 seconds...
✅ Navigating to: /dashboard
```

### Step 3: Verify Dashboard Loads

- ✅ Dashboard should load without errors
- ✅ User profile should display
- ✅ No "Profile or account not found" error

### Step 4: Check Edge Function Logs

In Supabase Dashboard → Edge Functions → `free-trial-signup` → Logs:

```
Trial user created successfully
Stripe customer created
Stripe subscription created
Account created successfully
Profile created successfully  ← THIS IS NEW!
VAPI resources provisioned successfully
```

### Step 5: Verify Database Records

Supabase Dashboard → Table Editor:

**profiles table**:
- New record should exist
- `id` = user ID
- `account_id` = account ID
- `name`, `phone` populated
- `is_primary` = true

**accounts table**:
- New record should exist
- `stripe_customer_id` populated
- `stripe_subscription_id` populated
- `plan_type` = selected plan
- `subscription_status` = 'trialing'

**Stripe Dashboard**:
- Customer created
- Subscription created with 3-day trial
- Status = 'trialing'

---

## 🐛 Troubleshooting

### If "Profile creation error" appears in logs

Check RLS policies on profiles table:

```sql
-- In Supabase SQL Editor
SELECT * FROM pg_policies WHERE tablename = 'profiles';
```

Verify service role can insert profiles (the edge function uses service role key).

### If "Price ID not configured" error

Verify environment variables in Supabase Dashboard → Settings → Edge Functions → Secrets:

- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_STARTER`
- `STRIPE_PRICE_PROFESSIONAL`
- `STRIPE_PRICE_PREMIUM`

Get price IDs from Stripe Dashboard → Products → Select product → Copy price ID

### If dashboard still shows error

1. Verify edge function was actually redeployed (check timestamp in Supabase)
2. Use **completely fresh email** for testing
3. Hard refresh browser (Cmd/Ctrl + Shift + R)
4. Check edge function logs for the actual error

---

## 📊 Summary

| Issue | Status | Action Required |
|-------|--------|----------------|
| ❌ Profile not created | ✅ Fixed in code | 🚀 Deploy edge function |
| ❌ Dashboard 500 error | ✅ Will fix after deploy | 🚀 Deploy edge function |
| ❌ Stripe not created | ✅ Will fix after deploy | 🚀 Deploy edge function |
| ❌ VAPI not provisioned | ✅ Will fix after deploy | 🚀 Deploy edge function |

---

## 📝 Git Status

**All changes committed and pushed**:

- `807364c` - Add profile creation to edge function ← **Deploy this**
- `379b205` - Add deployment guide
- `5a20a95` - Fix planType validation and error parsing
- `5c783f7` - Add QA test plan and fix summary

**Current Branch**: `claude/unified-signup-flow-implementation-011CUvwaBSfmHDbdY9vs1TJh`

---

## 🎯 Next Steps

1. **Deploy edge function** to Supabase (see instructions above)
2. **Test with fresh email/phone** (completely new, never used before)
3. **Verify all 5 verification steps** listed above
4. **Report back** with results:
   - ✅ Success: Dashboard loads, profile created, Stripe customer exists
   - ❌ Failure: Share edge function logs and browser console errors

---

## 📞 Additional Resources

- **Deployment Guide**: `DEPLOYMENT_GUIDE.md` (detailed troubleshooting)
- **QA Test Plan**: `QA_TEST_PLAN.md` (15 comprehensive tests)
- **Fix Summary**: `TRIAL_SIGNUP_FIX_SUMMARY.md` (planType validation fixes)

---

**IMPORTANT**: The edge function deployment is **required** for this fix to work. The code changes are committed but won't take effect until the function is redeployed to Supabase.
