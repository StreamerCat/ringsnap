# Step-by-Step: Deploy, Cleanup, and Test

## 🚨 Current Situation

**Error**: "An account with this email already exists"

**Why**: Your first test created an auth user but failed before creating the profile/account. The email `josh.sturgeon@gmail.com` is "taken" in auth.users but has no associated profile or account (orphaned user).

**Also**: The edge function with the profile creation fix **hasn't been deployed yet**, so even after cleanup, it will fail again without deployment.

---

## ✅ Solution: 3 Steps

### **STEP 1: Deploy the Edge Function** 🚀

The profile creation fix must be deployed before testing.

#### Option A: Supabase Dashboard (Recommended)

1. Go to https://supabase.com/dashboard/project/YOUR_PROJECT_ID
2. Click **Edge Functions** in the left sidebar
3. Find and click on `free-trial-signup`
4. Click **Deploy new version** button
5. Choose one of these methods:
   - **Upload file**: Select `/supabase/functions/free-trial-signup/index.ts` from your local copy
   - **Paste code**: Copy the entire contents of the file and paste it
6. Click **Deploy**
7. Wait for "Deployed successfully" confirmation
8. **Verify**: Check the deployment timestamp - it should be very recent

#### Option B: Supabase CLI

If you have Supabase CLI installed:

```bash
cd /home/user/ringsnap
supabase functions deploy free-trial-signup
```

---

### **STEP 2: Clean Up Orphaned User** 🧹

The orphaned auth user must be deleted before you can test with the same email.

#### Method A: Supabase SQL Editor (Recommended)

1. Go to Supabase Dashboard → **SQL Editor**
2. Click **New query**
3. Copy and paste this query:

```sql
-- First, verify the orphaned user exists
SELECT 
  u.id,
  u.email,
  u.created_at,
  CASE 
    WHEN p.id IS NULL THEN '❌ No profile (orphaned)'
    ELSE '✅ Has profile'
  END as status
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE u.email = 'josh.sturgeon@gmail.com';
```

4. Click **Run** - you should see 1 row with "❌ No profile (orphaned)"
5. Now delete it with this query:

```sql
-- Delete the orphaned user
DELETE FROM auth.users WHERE email = 'josh.sturgeon@gmail.com';
```

6. Click **Run** - should show "Success. 1 row(s) affected."
7. Verify deletion:

```sql
-- Should return 0 rows
SELECT * FROM auth.users WHERE email = 'josh.sturgeon@gmail.com';
```

#### Method B: Use a Different Email

If you prefer not to delete:
- Use a completely fresh email: `josh.sturgeon+test1@gmail.com`
- Gmail treats `+anything` as the same inbox but Supabase sees it as unique
- Or use a different email entirely

---

### **STEP 3: Test the Complete Flow** ✅

Now test with the deployed edge function and clean database.

#### Prerequisites
- ✅ Edge function deployed (Step 1)
- ✅ Orphaned user deleted OR using fresh email (Step 2)
- ✅ Browser console open (F12)

#### Test Process

1. **Go to trial signup page**
2. **Fill out form**:
   - Name: Any name
   - Email: `josh.sturgeon@gmail.com` (if cleaned up) OR `josh.sturgeon+test1@gmail.com` (if using fresh)
   - Phone: `(555) 123-4567` (different from previous)
   - Company: Auto-filled or enter manually

3. **Step 2**: Click "Starter" (or any plan)
   - ✅ Should auto-advance to Step 3

4. **Step 3**: Enter payment
   - Card: `4242 4242 4242 4242`
   - Expiry: `12/25`
   - CVC: `123`
   - ZIP: `12345`
   - ✅ Check "I agree to terms"
   - Click "Start My Free Trial"

#### Expected Console Logs (Success)

```
✅ Plan selected: starter
📋 planType changed to: starter
📋 Validating step 2 - planType: starter
🚀 Starting trial signup submission...
💳 Creating Stripe payment method...
✅ Payment method created: pm_xxxxxxxxxxxxx
📞 Calling edge function with request body:
  - name: Im testing
  - email: josh.sturgeon@gmail.com
  - phone: (555) 123-4567
  - companyName: Really?
  - planType: starter (type: string)
  - paymentMethodId: pm_xxxxxxxxxxxxx
  - acceptTerms: true
  - source: hero
📦 Edge function response: {data: {…}, error: null}  ← Should have data, not error
✅ Trial signup successful!
🔐 Auto-logging in user...
✅ Auto-login successful! Session: active
🔄 Redirecting in 1.5 seconds...
✅ Navigating to: /dashboard
```

#### Expected Edge Function Logs (Supabase Dashboard)

Go to Edge Functions → `free-trial-signup` → Logs:

```
Trial user created successfully
Stripe customer created
Stripe subscription created
Account created successfully
Profile created successfully  ← THIS MUST APPEAR (new!)
VAPI resources provisioned successfully (or warning if it fails)
```

#### Expected Results

- ✅ **No errors** in browser console
- ✅ **Dashboard loads** successfully (no 500 error)
- ✅ **Stripe customer** created (check Stripe Dashboard)
- ✅ **Stripe subscription** created with 3-day trial
- ✅ **Profile exists** in Supabase profiles table
- ✅ **Account exists** in Supabase accounts table with Stripe IDs
- ✅ **VAPI resources** provisioned (phone number + assistant)

---

## 🐛 Troubleshooting

### Issue: Still getting "email already exists" after deletion

**Check**:
```sql
-- Make sure user is really deleted
SELECT * FROM auth.users WHERE email = 'josh.sturgeon@gmail.com';
```

If it still exists, try:
```sql
-- Force delete with CASCADE
DELETE FROM auth.users WHERE email = 'josh.sturgeon@gmail.com' CASCADE;
```

Or just use a different email like `josh.sturgeon+test2@gmail.com`.

---

### Issue: "Profile creation error" in edge function logs

**This means the edge function was deployed but RLS policies are blocking profile creation.**

Check policies:
```sql
-- View policies on profiles table
SELECT * FROM pg_policies WHERE tablename = 'profiles';
```

The service role (used by edge functions) should have full access. If not, add a policy:

```sql
-- Allow service role to insert profiles
CREATE POLICY "Service role can insert profiles"
ON profiles
FOR INSERT
TO service_role
WITH CHECK (true);
```

---

### Issue: "Price ID not configured for plan: starter"

**Environment variables are missing.**

1. Go to Supabase Dashboard → Settings → Edge Functions → Secrets
2. Add these variables:
   - `STRIPE_SECRET_KEY` = your Stripe secret key (starts with `sk_test_` or `sk_live_`)
   - `STRIPE_PRICE_STARTER` = Stripe price ID for starter plan (starts with `price_`)
   - `STRIPE_PRICE_PROFESSIONAL` = Stripe price ID for professional plan
   - `STRIPE_PRICE_PREMIUM` = Stripe price ID for premium plan

3. Get price IDs from: Stripe Dashboard → Products → [Your Product] → Pricing → Copy price ID

---

### Issue: Edge function still doesn't create profile

**Edge function wasn't actually deployed.**

Verify deployment:
1. Go to Supabase Dashboard → Edge Functions → `free-trial-signup`
2. Check "Last deployed" timestamp - should be within the last few minutes
3. If it's old, redeploy using Step 1 instructions above

---

## 📊 Verification Checklist

After successful signup, verify everything was created:

### In Supabase Dashboard

**Table: auth.users**
```sql
SELECT id, email, created_at, email_confirmed_at
FROM auth.users
WHERE email = 'josh.sturgeon@gmail.com';
```
- ✅ Should have 1 row
- ✅ `email_confirmed_at` should be set (not null)

**Table: profiles**
```sql
SELECT id, account_id, name, phone, is_primary, source, created_at
FROM profiles
WHERE id IN (SELECT id FROM auth.users WHERE email = 'josh.sturgeon@gmail.com');
```
- ✅ Should have 1 row
- ✅ `account_id` should be a UUID
- ✅ `name` should be "Im testing"
- ✅ `phone` should be "(555) 123-4567"
- ✅ `is_primary` should be `true`
- ✅ `source` should be "hero"

**Table: accounts**
```sql
SELECT 
  id, 
  name, 
  owner_id, 
  stripe_customer_id, 
  stripe_subscription_id, 
  plan_type, 
  subscription_status,
  trial_start_date,
  trial_end_date
FROM accounts
WHERE owner_id IN (SELECT id FROM auth.users WHERE email = 'josh.sturgeon@gmail.com');
```
- ✅ Should have 1 row
- ✅ `stripe_customer_id` should start with `cus_`
- ✅ `stripe_subscription_id` should start with `sub_`
- ✅ `plan_type` should be "starter"
- ✅ `subscription_status` should be "trialing"
- ✅ `trial_end_date` should be 3 days from now

### In Stripe Dashboard

1. Go to https://dashboard.stripe.com/test/customers
2. Search for: `josh.sturgeon@gmail.com`
3. ✅ Customer should exist
4. Click on customer
5. ✅ Should have 1 active subscription
6. ✅ Subscription status: "Trialing"
7. ✅ Trial end date: 3 days from now
8. ✅ Payment method attached

### In Application

1. ✅ Dashboard loads without errors
2. ✅ User profile displays correctly
3. ✅ Account settings show correct plan
4. ✅ Trial countdown shows "X days remaining"
5. ✅ No "Profile or account not found" error

---

## 📝 Quick Reference

### Cleanup SQL (copy-paste ready)
```sql
-- Delete orphaned user
DELETE FROM auth.users WHERE email = 'josh.sturgeon@gmail.com';

-- Verify deletion
SELECT * FROM auth.users WHERE email = 'josh.sturgeon@gmail.com';
-- Should return 0 rows
```

### Verification SQL (copy-paste ready)
```sql
-- Check complete signup
SELECT 
  'auth.users' as table_name, 
  count(*) as count,
  string_agg(email, ', ') as emails
FROM auth.users 
WHERE email = 'josh.sturgeon@gmail.com'
UNION ALL
SELECT 
  'profiles', 
  count(*),
  string_agg(name, ', ')
FROM profiles 
WHERE id IN (SELECT id FROM auth.users WHERE email = 'josh.sturgeon@gmail.com')
UNION ALL
SELECT 
  'accounts', 
  count(*),
  string_agg(name, ', ')
FROM accounts 
WHERE owner_id IN (SELECT id FROM auth.users WHERE email = 'josh.sturgeon@gmail.com');
```

Expected output:
```
auth.users  | 1 | josh.sturgeon@gmail.com
profiles    | 1 | Im testing
accounts    | 1 | [company name]
```

---

## ✅ Success Criteria

You'll know it worked when:

1. ✅ **No errors** in browser console during signup
2. ✅ **Edge function logs** show "Profile created successfully"
3. ✅ **Dashboard loads** immediately after signup
4. ✅ **All 3 database tables** have records (auth.users, profiles, accounts)
5. ✅ **Stripe Dashboard** shows customer and subscription
6. ✅ **VAPI resources** created (check phone_numbers and assistants tables)

---

## 🆘 Still Having Issues?

If you complete all 3 steps and still see errors, provide:

1. **Edge function logs** (full output from Supabase Dashboard)
2. **Browser console logs** (copy the entire error section)
3. **SQL query results** (run the verification SQL above)
4. **Stripe Dashboard** screenshot (customer/subscription)
5. **Edge function deployment timestamp** (from Supabase Dashboard)

This will help diagnose any remaining issues.
