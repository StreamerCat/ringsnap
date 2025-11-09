# 🚨 EMERGENCY FIX - Deploy Now

## THE PROBLEM

You've tested 2-3 times and gotten the SAME error every time:
- ✅ Signup appears successful
- ❌ No Stripe customer created
- ❌ No VAPI resources provisioned  
- ❌ Dashboard shows "Profile or account not found" (500 error)

**Root Cause**: The edge function **WITH THE FIX** has NOT been deployed to Supabase yet.

You're still running the OLD version that's missing profile creation.

---

## THE FIX - Do This NOW

### STEP 1: Deploy Edge Function (5 minutes)

**Go to Supabase Dashboard:**

1. Open: https://supabase.com/dashboard
2. Select your RingSnap project
3. Click **Edge Functions** in left sidebar
4. Click on `free-trial-signup`
5. Click **Deploy** or **Deploy new version**

**Choose deployment method:**

**Method A - Copy/Paste (Fastest)**:
1. Click **Edit function** or open the code editor
2. Delete ALL existing code
3. Copy the ENTIRE contents of `/home/user/ringsnap/supabase/functions/free-trial-signup/index.ts`
4. Paste into the editor
5. Click **Deploy**
6. Wait for "Deployed successfully"

**Method B - File Upload**:
1. Click **Upload function**
2. Select file: `/home/user/ringsnap/supabase/functions/free-trial-signup/index.ts`
3. Click **Deploy**
4. Wait for "Deployed successfully"

**VERIFY DEPLOYMENT**:
- Check timestamp: Should show "Deployed X seconds ago"
- If it shows "Deployed 3 hours ago" or older, it DIDN'T deploy - try again

---

### STEP 2: Clean Up Test Users (2 minutes)

**Go to Supabase SQL Editor:**

1. Click **SQL Editor** in left sidebar
2. Click **New query**
3. Paste this SQL:

```sql
-- Delete all test users from failed signups
DELETE FROM auth.users 
WHERE email IN (
  'josh.sturgeon@gmail.com',
  'josh.sturgeon+test1@gmail.com'
);

-- Verify deletion
SELECT email FROM auth.users 
WHERE email LIKE '%josh.sturgeon%';
-- Should return 0 rows
```

4. Click **Run**
5. Should show "Success. 2 row(s) affected." or similar

---

### STEP 3: Test Immediately (5 minutes)

**Use fresh email**: `josh.sturgeon+test99@gmail.com`

**Complete signup:**
1. Name: Test User
2. Email: `josh.sturgeon+test99@gmail.com`
3. Phone: `(555) 999-8888` 
4. Select any plan
5. Card: `4242 4242 4242 4242`
6. Expiry: `12/25`
7. CVC: `123`
8. Check terms
9. Submit

**Watch console for these NEW logs:**

```
✅ Trial signup successful!
📦 Signup response data: {
  email: "josh.sturgeon+test99@gmail.com",
  hasPassword: true,
  accountId: "xxx-xxx-xxx",
  stripeCustomerId: "cus_xxxxxxxxxxxxx"  ← MUST SEE THIS
}
🔐 Auto-logging in user...
✅ Auto-login successful! Session: active
```

**If you see `stripeCustomerId: "cus_xxx"`, it worked!**

---

### STEP 4: Verify in Supabase Edge Function Logs

**Go to Edge Functions → free-trial-signup → Logs**

You MUST see these logs in order:

```
Trial user created successfully
Stripe customer created           ← NEW!
Stripe subscription created       ← NEW!
Account created successfully
Profile created successfully      ← NEW! CRITICAL!
VAPI resources provisioned successfully
```

**If you DON'T see "Profile created successfully", the deployment FAILED.**

---

### STEP 5: Verify in Stripe Dashboard

**Go to**: https://dashboard.stripe.com/test/customers

1. Search: `josh.sturgeon+test99@gmail.com`
2. **MUST SEE**: Customer with that email
3. Click customer
4. **MUST SEE**: Active subscription with status "Trialing"

**If customer doesn't exist, the edge function deployment FAILED.**

---

### STEP 6: Verify Dashboard Access

After signup:
- ✅ Should redirect to `/dashboard` (NOT `/trial-confirmation`)
- ✅ Dashboard loads without errors
- ✅ User profile displays
- ✅ No "Profile or account not found" error

---

## IF IT STILL FAILS

### Check Edge Function Logs for Errors

**Go to**: Edge Functions → free-trial-signup → Logs

Look for errors like:

**Error 1: "Price ID not configured"**
```
Error: Price ID not configured for plan: starter
```

**FIX**: Add environment variables:
1. Settings → Edge Functions → Secrets
2. Add:
   - `STRIPE_SECRET_KEY` = `sk_test_...` (from Stripe Dashboard → Developers → API Keys)
   - `STRIPE_PRICE_STARTER` = `price_...` (from Stripe Dashboard → Products)
   - `STRIPE_PRICE_PROFESSIONAL` = `price_...`
   - `STRIPE_PRICE_PREMIUM` = `price_...`

**Error 2: "Profile creation error"**
```
Profile creation error: permission denied for table profiles
```

**FIX**: RLS policy blocking service role. Run this SQL:

```sql
-- Allow service role to insert profiles
CREATE POLICY IF NOT EXISTS "Service role can manage profiles"
ON profiles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```

**Error 3: "Stripe error: Invalid API Key"**
```
Stripe error: Invalid API Key provided
```

**FIX**: 
1. Settings → Edge Functions → Secrets
2. Update `STRIPE_SECRET_KEY` with correct key from Stripe Dashboard
3. Redeploy edge function after updating

---

## VERIFICATION SQL QUERIES

After successful signup, run these in SQL Editor:

### Check Everything Was Created

```sql
-- Replace with your test email
\set test_email 'josh.sturgeon+test99@gmail.com'

-- Check auth user
SELECT 
  'auth.users' as table_name,
  id,
  email,
  email_confirmed_at
FROM auth.users 
WHERE email = 'josh.sturgeon+test99@gmail.com';

-- Check profile
SELECT 
  'profiles' as table_name,
  id,
  account_id,
  name,
  phone,
  is_primary
FROM profiles 
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'josh.sturgeon+test99@gmail.com'
);

-- Check account with Stripe IDs
SELECT 
  'accounts' as table_name,
  id,
  name,
  stripe_customer_id,
  stripe_subscription_id,
  plan_type,
  subscription_status,
  trial_end_date
FROM accounts 
WHERE owner_id IN (
  SELECT id FROM auth.users WHERE email = 'josh.sturgeon+test99@gmail.com'
);

-- Check VAPI phone number
SELECT 
  'phone_numbers' as table_name,
  id,
  phone_number,
  vapi_phone_id,
  status
FROM phone_numbers
WHERE account_id IN (
  SELECT a.id FROM accounts a
  WHERE a.owner_id IN (
    SELECT id FROM auth.users WHERE email = 'josh.sturgeon+test99@gmail.com'
  )
);

-- Check VAPI assistant
SELECT 
  'assistants' as table_name,
  id,
  name,
  vapi_assistant_id,
  status
FROM assistants
WHERE account_id IN (
  SELECT a.id FROM accounts a
  WHERE a.owner_id IN (
    SELECT id FROM auth.users WHERE email = 'josh.sturgeon+test99@gmail.com'
  )
);
```

**Expected Results**:
- auth.users: 1 row
- profiles: 1 row (with account_id)
- accounts: 1 row (with stripe_customer_id and stripe_subscription_id)
- phone_numbers: 1 row (with vapi_phone_id)
- assistants: 1 row (with vapi_assistant_id)

**If ANY table returns 0 rows, something failed.**

---

## TROUBLESHOOTING CHECKLIST

- [ ] Edge function deployed? (Check timestamp in Supabase Dashboard)
- [ ] Test users deleted? (Run verification SQL)
- [ ] Environment variables set? (STRIPE_SECRET_KEY, STRIPE_PRICE_* )
- [ ] Fresh email used? (Not previously used)
- [ ] Edge function logs checked? (Look for actual errors)
- [ ] Stripe Dashboard checked? (Customer exists?)
- [ ] Database checked? (Profile and account exist?)

---

## CRITICAL ENVIRONMENT VARIABLES

**MUST BE SET** in Supabase Dashboard → Settings → Edge Functions → Secrets:

```
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_STARTER=price_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_PROFESSIONAL=price_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_PREMIUM=price_xxxxxxxxxxxxxxxxxxxxx
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxxxxxxxxxxxxxxxxxxxxxxxxxx
VAPI_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**To find Stripe Price IDs**:
1. Go to Stripe Dashboard
2. Click **Products**
3. Click your product
4. Under **Pricing**, click each price
5. Copy the ID (starts with `price_`)

---

## PRODUCTION READINESS CHECKLIST

Once signup works, verify:

### Functional Requirements
- [ ] Trial signup creates all resources (user, profile, account, Stripe, VAPI)
- [ ] Auto-login works after signup
- [ ] Dashboard loads successfully
- [ ] Stripe customer has payment method attached
- [ ] Stripe subscription has 3-day trial
- [ ] VAPI phone number provisioned
- [ ] VAPI assistant created
- [ ] No errors in browser console
- [ ] No errors in edge function logs

### Error Handling
- [ ] Duplicate email shows friendly error
- [ ] Rate limiting works (max 3 trials per IP)
- [ ] Phone reuse blocked (30-day window)
- [ ] Disposable emails blocked
- [ ] Invalid card shows Stripe error
- [ ] Network errors show retry message

### Security
- [ ] RLS policies enabled on all tables
- [ ] Service role used in edge function
- [ ] Stripe API keys are secret (not exposed to frontend)
- [ ] VAPI API key is secret
- [ ] Password returned only once (in signup response)
- [ ] Email confirmation enabled

### Data Integrity
- [ ] Profile always created when account created
- [ ] Account always has owner_id
- [ ] Stripe IDs always saved to account
- [ ] Trial dates set correctly (3 days from now)
- [ ] Subscription status = 'trialing'
- [ ] is_primary = true for first user

### UX
- [ ] Plan selection auto-advances
- [ ] Form validation works
- [ ] Loading states show during submission
- [ ] Success message shows before redirect
- [ ] Dashboard shows correct trial countdown
- [ ] All error messages are user-friendly

---

## EXPECTED TIMELINE

- **Deploy edge function**: 2-3 minutes
- **Clean up test users**: 1-2 minutes
- **Test signup**: 3-5 minutes
- **Verify all systems**: 5-10 minutes
- **Total**: 15-20 minutes to production-ready

---

## CONTACT IF STILL BROKEN

If after deployment it STILL doesn't work, provide:

1. **Edge function deployment timestamp** (screenshot)
2. **Complete edge function logs** (last 50 lines)
3. **Browser console logs** (full output)
4. **SQL query results** (from verification queries above)
5. **Stripe Dashboard** (screenshot of customers page)
6. **Environment variables** (just confirm they're set, don't share values)

This will help identify the exact failure point.
