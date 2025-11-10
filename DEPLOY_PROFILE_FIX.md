# Deploy Profile Creation Fix - Step by Step

**CRITICAL**: This fix resolves 100% signup failure. Deploy IMMEDIATELY.

**Commit**: `d0f7f07` - CRITICAL FIX: Add explicit profile and account creation to trial signup
**Status**: ✅ Code committed and pushed
**Next**: Deploy to Supabase production

---

## What This Fix Does

✅ Adds explicit account creation (no longer relies on trigger)
✅ Adds explicit profile creation (no longer relies on trigger)
✅ Adds user_roles assignment (owner role)
✅ Simplifies account update to only set Stripe fields

**Result**: Signup will complete successfully even if database trigger fails

---

## Deployment Options

### Option 1: Supabase Dashboard (Recommended - 5 minutes)

1. **Login to Supabase**
   - Go to https://supabase.com/dashboard
   - Login with your credentials
   - Select the **RingSnap** project

2. **Navigate to Edge Functions**
   - Click **Edge Functions** in the left sidebar
   - Find `free-trial-signup` in the list

3. **Deploy New Version**
   - Click on `free-trial-signup`
   - Click **Deploy** or **Deploy new version** button
   - You have two options:

   **Option A: Upload File**
   - Click "Upload file"
   - Navigate to: `/home/user/ringsnap/supabase/functions/free-trial-signup/index.ts`
   - Select and upload the file
   - Click **Deploy**

   **Option B: Copy/Paste**
   - Copy the entire contents of `supabase/functions/free-trial-signup/index.ts`
   - Paste into the code editor
   - Click **Deploy**

4. **Wait for Deployment**
   - Wait for "Deployment successful" message
   - Note the deployment timestamp
   - Verify version shows as "Latest"

---

### Option 2: Supabase CLI (If Available)

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Login
supabase login

# Link to project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the function
supabase functions deploy free-trial-signup

# Verify deployment
supabase functions list
```

---

## Verification Steps (CRITICAL)

### Step 1: Check Deployment Timestamp

1. Go to Supabase Dashboard → Edge Functions → `free-trial-signup`
2. Verify the deployment timestamp is AFTER your deployment
3. Confirm status shows as "Active"

### Step 2: Test Signup Flow

**IMPORTANT**: Use completely fresh credentials (never used before)

1. **Open your RingSnap app** in incognito browser
2. **Navigate to trial signup page**
3. **Enter test data**:
   - Name: `Test User CTO`
   - Email: `test.cto.fix+[RANDOM]@example.com` (use random number)
   - Phone: `(555) 999-XXXX` (use new number)
   - Company: `CTO Test Inc`

4. **Select plan**: Choose "Professional"
5. **Enter payment**:
   - Card: `4242 4242 4242 4242`
   - Expiry: `12/25`
   - CVC: `123`
   - ZIP: `12345`
6. **Check "I agree to Terms"**
7. **Click "Start My Free Trial"**

### Step 3: Monitor Browser Console

Open DevTools (F12) and watch console. You should see:

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

**Red Flags** (if you see these, deployment failed):
- ❌ `Profile not found after signup`
- ❌ `Failed to load profile after signup`
- ❌ `Account not linked to profile after signup`

### Step 4: Check Edge Function Logs

1. Go to Supabase Dashboard → Edge Functions → `free-trial-signup`
2. Click **Logs** tab
3. Find logs for your test signup (use email to search)
4. Verify you see **ALL** these messages in order:

```
✅ Trial user created successfully
✅ Creating account record
✅ Account created successfully
✅ Creating profile record
✅ Profile created successfully
✅ Assigning owner role to user
✅ Owner role assigned successfully
✅ Initializing Stripe
✅ Stripe customer created
✅ Creating Stripe subscription
✅ Stripe subscription created
✅ Updating account with Stripe subscription info
✅ Account updated with Stripe info successfully
✅ Starting VAPI provisioning in background
```

### Step 5: Verify Database Records

1. **Go to Supabase Dashboard → Table Editor**

2. **Check `profiles` table**:
   - New record should exist with your test email
   - `id` should match user ID
   - `account_id` should be populated (UUID)
   - `name`, `phone` should match your input
   - `is_primary` should be `true`
   - `source` should be `website`

3. **Check `accounts` table**:
   - New record should exist
   - `id` should match the `account_id` from profiles
   - `stripe_customer_id` should be populated (starts with `cus_`)
   - `stripe_subscription_id` should be populated (starts with `sub_`)
   - `plan_type` should be `professional`
   - `subscription_status` should be `trial`
   - `trial_start_date` should be today
   - `trial_end_date` should be 3 days from now

4. **Check `user_roles` table**:
   - New record should exist
   - `user_id` should match user ID
   - `role` should be `owner`

5. **Check Stripe Dashboard**:
   - Go to https://dashboard.stripe.com/customers
   - Find customer with your test email
   - Verify subscription exists
   - Status should be `trialing`
   - Trial end date should be 3 days from now

### Step 6: Verify Dashboard Access

1. After signup, you should be redirected to `/dashboard`
2. Dashboard should load without errors
3. User profile info should display
4. Account info should display
5. **NO "Profile or account not found" error**

---

## Troubleshooting

### Issue: "Profile not found" still appears

**Possible causes**:
1. Edge function not deployed (check timestamp)
2. Old version cached (wait 1-2 minutes, try again)
3. Deployment failed silently

**Solutions**:
- Verify deployment timestamp in Supabase dashboard
- Re-deploy the function
- Check edge function logs for deployment errors
- Try in new incognito window with fresh email

### Issue: "Account creation error" in logs

**Possible cause**: RLS policy blocking account insert

**Solution**:
```sql
-- Run this in Supabase SQL Editor to verify service role can insert
SELECT has_table_privilege('service_role', 'public.accounts', 'INSERT');
-- Should return: true
```

If false, check RLS policies on `accounts` table.

### Issue: "Profile creation error" in logs

**Possible cause**: Duplicate profile (from trigger) or RLS policy

**Solution**:
1. Check if trigger is creating duplicate profile:
```sql
-- Check for duplicates
SELECT id, account_id, created_at
FROM profiles
WHERE phone = '(555) 999-XXXX'  -- your test phone
ORDER BY created_at DESC;
```

2. If duplicate exists, the trigger is still running. This is OK - the error will be caught and signup will continue.

3. If no profile exists at all, check RLS policies:
```sql
SELECT has_table_privilege('service_role', 'public.profiles', 'INSERT');
-- Should return: true
```

### Issue: Stripe customer not created

**Possible cause**: Stripe API key not configured

**Solution**:
1. Go to Supabase Dashboard → Project Settings → Edge Functions → Secrets
2. Verify `STRIPE_SECRET_KEY` is set
3. Verify it starts with `sk_live_` (production) or `sk_test_` (test mode)
4. Get key from: https://dashboard.stripe.com/apikeys

### Issue: "Price ID not configured" error

**Solution**:
1. Go to Supabase Dashboard → Project Settings → Edge Functions → Secrets
2. Verify these are set:
   - `STRIPE_PRICE_STARTER`
   - `STRIPE_PRICE_PROFESSIONAL`
   - `STRIPE_PRICE_PREMIUM`
3. Get price IDs from Stripe Dashboard → Products → [Select product] → Pricing → Copy price ID

---

## Rollback Plan (If Needed)

If deployment causes issues, you can rollback:

1. **Via Supabase Dashboard**:
   - Go to Edge Functions → `free-trial-signup`
   - Click **Deployments** tab
   - Find previous working version
   - Click **Restore** on that version

2. **Via Git**:
   - Identify previous working commit
   - `git checkout [previous-commit] supabase/functions/free-trial-signup/index.ts`
   - Re-deploy via dashboard

---

## Success Criteria

✅ Deployment timestamp updated in Supabase
✅ Test signup completes without errors
✅ Browser console shows success messages
✅ Edge function logs show all success steps
✅ Profile record exists in database
✅ Account record exists with Stripe IDs
✅ User_roles record exists with owner role
✅ Stripe customer and subscription created
✅ Dashboard loads without "Profile not found" error

---

## Post-Deployment

After successful deployment:

1. ✅ Mark blocker #1 as RESOLVED
2. ✅ Move to blocker #2: QA Testing (see `QA_TEST_PLAN.md`)
3. ✅ Monitor edge function logs for 1-2 hours
4. ✅ Watch for any error patterns
5. ✅ Test 2-3 more signups with different plans

---

## Contact

If deployment fails or you need help:
- Check edge function logs for specific error messages
- Review `CRITICAL_FIX_SUMMARY.md` for additional context
- Verify all environment variables are set correctly

---

**Deployed by**: [Your name]
**Deployment date**: [Date/time]
**Deployment verified**: [ ] Yes / [ ] No
**Test signup successful**: [ ] Yes / [ ] No
**Production ready**: [ ] Yes / [ ] No
