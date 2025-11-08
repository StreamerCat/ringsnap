# Edge Function Deployment Guide

## 🚨 Critical Fix Applied

**Issue**: Trial signup was creating auth users but failing to create profile records, resulting in "Profile or account not found" errors on dashboard.

**Fix**: Added profile creation to `free-trial-signup` edge function (commit `807364c`)

---

## 🚀 Required Deployment Steps

### Step 1: Deploy Updated Edge Function

The edge function code has been updated but **must be redeployed** to Supabase for the fix to take effect.

#### Option A: Deploy via Supabase Dashboard (Recommended)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Edge Functions** in the left sidebar
4. Find `free-trial-signup` function
5. Click **Deploy new version**
6. Upload the file: `supabase/functions/free-trial-signup/index.ts`
7. Or use the built-in editor to copy/paste the updated code
8. Click **Deploy**
9. Verify deployment shows success

#### Option B: Deploy via Supabase CLI

If you have Supabase CLI installed:

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the function
supabase functions deploy free-trial-signup

# Verify deployment
supabase functions list
```

---

## ✅ Verification Steps

After deployment, verify the fix is working:

### 1. Check Edge Function Logs

Before testing, open Supabase Dashboard → Edge Functions → `free-trial-signup` → Logs

### 2. Run Test Signup

Complete a trial signup with:
- **Fresh email** (never used before)
- **New phone number**
- Stripe test card: `4242 4242 4242 4242`

### 3. Expected Console Logs

You should see these logs in order:

```
✅ Plan selected: professional
📋 planType changed to: professional
📋 Validating step 2 - planType: professional
🚀 Starting trial signup submission...
💳 Creating Stripe payment method...
✅ Payment method created: pm_xxxxxxxxxxxxx
📞 Calling edge function with request body:
  - planType: professional (type: string)
✅ Trial signup successful!
🔐 Auto-logging in user...
✅ Auto-login successful! Session: active
```

### 4. Expected Edge Function Logs

In Supabase Dashboard, verify these logs appear:

```
Trial user created successfully
Stripe customer created
Stripe subscription created
Account created successfully
Profile created successfully  ← NEW! This must appear
VAPI resources provisioned successfully
```

### 5. Verify Database Records

Check Supabase Dashboard → Table Editor:

**profiles table**:
- [ ] New record with user_id
- [ ] account_id matches accounts table
- [ ] name, phone populated
- [ ] is_primary = true
- [ ] source = 'website'

**accounts table**:
- [ ] New record with owner_id
- [ ] stripe_customer_id populated
- [ ] stripe_subscription_id populated
- [ ] plan_type = selected plan
- [ ] subscription_status = 'trialing'

**Stripe Dashboard**:
- [ ] Customer created with correct email/name/phone
- [ ] Subscription created with 3-day trial
- [ ] Status = 'trialing'

### 6. Verify Dashboard Access

After successful signup:
- [ ] User redirected to `/dashboard` (not error page)
- [ ] Dashboard loads without errors
- [ ] No "Profile or account not found" error
- [ ] User data displays correctly

---

## 🐛 Troubleshooting

### Issue: "Profile creation error" in logs

**Symptom**: Edge function logs show "Profile creation error"

**Possible Causes**:
1. RLS policies blocking profile insertion
2. Database constraint violation
3. account_id doesn't exist

**Solution**:
```sql
-- Check RLS policies on profiles table
SELECT * FROM pg_policies WHERE tablename = 'profiles';

-- Verify service role can insert profiles
-- Run in Supabase SQL Editor with service role:
INSERT INTO profiles (id, account_id, name, phone, is_primary, source)
VALUES (
  'test-user-id',
  'test-account-id',
  'Test User',
  '555-555-5555',
  true,
  'website'
);
-- Then delete the test record
DELETE FROM profiles WHERE id = 'test-user-id';
```

### Issue: "Price ID not configured" error

**Symptom**: Edge function fails with "Price ID not configured for plan: professional"

**Cause**: Stripe price IDs not set in environment variables

**Solution**:
1. Go to Supabase Dashboard → Settings → Edge Functions → Secrets
2. Verify these environment variables are set:
   - `STRIPE_SECRET_KEY` = your Stripe secret key
   - `STRIPE_PRICE_STARTER` = Stripe price ID for starter plan
   - `STRIPE_PRICE_PROFESSIONAL` = Stripe price ID for professional plan
   - `STRIPE_PRICE_PREMIUM` = Stripe price ID for premium plan

3. Get price IDs from Stripe Dashboard → Products → Select product → Copy price ID

### Issue: Still getting "Profile or account not found"

**Symptom**: Dashboard still shows error after deployment

**Possible Causes**:
1. Edge function not redeployed yet
2. Testing with old user account (created before fix)
3. Cache issue

**Solution**:
1. Verify edge function deployment timestamp in Supabase Dashboard
2. Use **completely fresh email** for testing (not previously used)
3. Hard refresh browser (Cmd/Ctrl + Shift + R)
4. Check browser console for actual error details

### Issue: VAPI provisioning fails

**Symptom**: Signup succeeds but no phone number/assistant created

**Note**: This is a **warning**, not a failure. The signup will complete successfully even if VAPI provisioning fails.

**Check**:
1. Verify `provision-resources` edge function exists and is deployed
2. Check VAPI API credentials in environment variables
3. Review `provision-resources` function logs for errors

---

## 📊 What Changed

### Before Fix ❌
```
1. Create auth user ✓
2. Create Stripe customer ✓
3. Create Stripe subscription ✓
4. Create account record ✓
5. Create profile record ✗ (MISSING)
6. Provision VAPI resources ✓
7. Return success ✓
```

**Result**: User logged in but dashboard fails with "Profile or account not found"

### After Fix ✅
```
1. Create auth user ✓
2. Create Stripe customer ✓
3. Create Stripe subscription ✓
4. Create account record ✓
5. Create profile record ✓ (FIXED)
6. Provision VAPI resources ✓
7. Return success ✓
```

**Result**: User logged in and dashboard loads successfully

---

## 🔍 Code Changes

**File**: `supabase/functions/free-trial-signup/index.ts`

**Added after line 289** (after account creation):

```typescript
// Create profile record
const { error: profileError } = await supabase
  .from('profiles')
  .insert({
    id: authData.user.id,
    account_id: accountData.id,
    name: validatedData.name,
    phone: validatedData.phone,
    is_primary: true, // First user is primary
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

---

## ✅ Deployment Checklist

- [ ] Edge function code updated (commit `807364c`)
- [ ] Edge function deployed to Supabase
- [ ] Deployment verified in Supabase Dashboard
- [ ] Test signup completed with fresh email
- [ ] Edge function logs show "Profile created successfully"
- [ ] Database shows profile record created
- [ ] Dashboard loads without errors
- [ ] Stripe customer and subscription created
- [ ] VAPI resources provisioned (optional but recommended)

---

## 📞 Next Steps

After successful deployment and verification:

1. **Clean up test users** (if needed):
   ```sql
   -- Delete test signup from earlier failed attempts
   DELETE FROM auth.users WHERE email = 'test@example.com';
   ```

2. **Monitor production signups**:
   - Watch edge function logs for any profile creation errors
   - Monitor Stripe Dashboard for subscription creation
   - Check for any RLS policy issues

3. **Update QA test plan** results in `QA_TEST_PLAN.md`

---

## 🆘 Need Help?

If issues persist after deployment:

1. **Check edge function logs** in Supabase Dashboard
2. **Check browser console** for frontend errors
3. **Verify environment variables** are set correctly
4. **Test with completely fresh email** (not previously used)
5. **Provide these details** when reporting issues:
   - Edge function logs (full error messages)
   - Browser console logs
   - Email used for testing
   - Database records (profiles, accounts tables)
   - Stripe customer/subscription IDs (if created)
