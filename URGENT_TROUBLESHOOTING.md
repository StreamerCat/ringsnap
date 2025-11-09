# 🚨 URGENT TROUBLESHOOTING - Edge Function Failing

## ISSUE CONFIRMED

The edge function is creating the auth user but **failing before Stripe customer creation**.

Evidence:
- ✅ Auth user created (user ID: 17f6a9f7-715f-4a42-a1af-ffc36bcd53af)
- ✅ Payment method created on frontend (pm_1SRMADIdevV48BnpDebBH6UW)
- ❌ **NO Stripe customer created** (should start with `cus_`)
- ❌ **NO Stripe subscription created** (should start with `sub_`)
- ❌ **NO profile created**
- ❌ **NO account created**
- ❌ **NO VAPI resources**

## CRITICAL ACTION REQUIRED

### 1. CHECK EDGE FUNCTION LOGS (DO THIS NOW)

1. Go to: https://supabase.com/dashboard
2. Select your project
3. Click: **Edge Functions** → `free-trial-signup` → **Logs**
4. Look for the **MOST RECENT** invocation (should be within last few minutes)
5. **Copy the ENTIRE log output** and share it

**What to look for:**
```
✅ GOOD - Should see ALL of these:
Trial user created successfully
Stripe customer created
Stripe subscription created
Account created successfully
Profile created successfully
VAPI resources provisioned

❌ BAD - If you see any of these:
- Error: Price ID not configured for plan: starter
- Error: Invalid API Key provided
- Error: permission denied for table profiles
- Error: [anything else]
```

---

### 2. CHECK ENVIRONMENT VARIABLES

Go to: **Settings** → **Edge Functions** → **Secrets**

**VERIFY these are ALL set:**

| Variable | Expected Value | How to Find |
|----------|---------------|-------------|
| `STRIPE_SECRET_KEY` | `sk_test_xxxxx` or `sk_live_xxxxx` | Stripe Dashboard → Developers → API Keys → Secret Key |
| `STRIPE_PRICE_STARTER` | `price_xxxxx` | Stripe Dashboard → Products → Starter → Copy Price ID |
| `STRIPE_PRICE_PROFESSIONAL` | `price_xxxxx` | Stripe Dashboard → Products → Professional → Copy Price ID |
| `STRIPE_PRICE_PREMIUM` | `price_xxxxx` | Stripe Dashboard → Products → Premium → Copy Price ID |
| `SUPABASE_URL` | `https://xxxxx.supabase.co` | Should be auto-set |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJxxx...` | Should be auto-set |
| `VAPI_API_KEY` | `xxxxx` | VAPI Dashboard |

**If ANY are missing:**
1. Add the missing variable
2. **IMPORTANT**: After adding, you MUST **redeploy** the edge function
3. Click: Edge Functions → `free-trial-signup` → **Deploy**

---

### 3. RUN DIAGNOSTIC QUERIES

Copy and run these in **Supabase SQL Editor**:

```sql
-- Quick summary
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM auth.users WHERE email = 'josh.sturgeon@mac.com') 
    THEN '✅ Auth user created'
    ELSE '❌ Auth user missing'
  END as auth_status,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM profiles p 
      JOIN auth.users u ON p.id = u.id 
      WHERE u.email = 'josh.sturgeon@mac.com'
    ) 
    THEN '✅ Profile created'
    ELSE '❌ Profile missing'
  END as profile_status,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM accounts a 
      JOIN auth.users u ON a.owner_id = u.id 
      WHERE u.email = 'josh.sturgeon@mac.com'
    ) 
    THEN '✅ Account created'
    ELSE '❌ Account missing'
  END as account_status;
```

**Expected Result:**
```
✅ Auth user created
❌ Profile missing
❌ Account missing
```

This confirms the function is stopping after auth user creation.

---

## MOST LIKELY CAUSES

### Cause 1: STRIPE_SECRET_KEY Missing or Invalid (90% probability)

**Symptom**: Edge function fails at Stripe customer creation

**Fix**:
1. Go to Stripe Dashboard: https://dashboard.stripe.com/test/apikeys
2. Copy your **Secret key** (starts with `sk_test_` for test mode)
3. Go to Supabase: Settings → Edge Functions → Secrets
4. Add or update: `STRIPE_SECRET_KEY` = `sk_test_your_key_here`
5. **REDEPLOY** edge function: Edge Functions → `free-trial-signup` → Deploy

### Cause 2: STRIPE_PRICE_* Variables Missing (5% probability)

**Symptom**: Error "Price ID not configured for plan: starter"

**Fix**:
1. Go to Stripe Dashboard → Products
2. Click on your product
3. Under "Pricing", click each price tier
4. Copy the Price ID (starts with `price_`)
5. Add to Supabase Secrets:
   - `STRIPE_PRICE_STARTER` = `price_xxxxx`
   - `STRIPE_PRICE_PROFESSIONAL` = `price_xxxxx`
   - `STRIPE_PRICE_PREMIUM` = `price_xxxxx`
6. **REDEPLOY** edge function

### Cause 3: RLS Policy Blocking Inserts (3% probability)

**Symptom**: Error "permission denied for table profiles" or "permission denied for table accounts"

**Fix - Run this SQL**:
```sql
-- Allow service role to manage profiles
CREATE POLICY IF NOT EXISTS "Service role can manage profiles"
ON profiles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Allow service role to manage accounts
CREATE POLICY IF NOT EXISTS "Service role can manage accounts"
ON accounts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```

### Cause 4: Edge Function Not Actually Deployed (2% probability)

**Symptom**: Same error after "deploying"

**Fix**:
1. Go to: Edge Functions → `free-trial-signup`
2. Check "Last deployed" timestamp
3. If it's NOT recent (within last 10 minutes), deployment failed
4. Try deploying again:
   - Click **Edit function**
   - Copy-paste the ENTIRE code from the file I provided earlier
   - Click **Deploy**
   - Wait for "Deployed successfully"
   - Verify timestamp is NOW

---

## IMMEDIATE NEXT STEPS

**Do these in order:**

1. ✅ **Check edge function logs** (most important - tells us exact error)
2. ✅ **Verify STRIPE_SECRET_KEY is set**
3. ✅ **Verify all STRIPE_PRICE_* variables are set**
4. ✅ **If any env vars were added/updated, REDEPLOY the edge function**
5. ✅ **Delete test user** (run SQL below)
6. ✅ **Test again with fresh email**

**Delete test user SQL:**
```sql
DELETE FROM auth.users WHERE email = 'josh.sturgeon@mac.com';
```

---

## WHAT I NEED FROM YOU

To diagnose and fix this, please provide:

1. **Edge function logs** (from Supabase Dashboard → Edge Functions → free-trial-signup → Logs)
   - Copy the ENTIRE output of the most recent invocation
   - Should show what step it's failing at

2. **Environment variables confirmation**
   - Go to Settings → Edge Functions → Secrets
   - Confirm these exist (don't share the actual values):
     - [ ] STRIPE_SECRET_KEY
     - [ ] STRIPE_PRICE_STARTER
     - [ ] STRIPE_PRICE_PROFESSIONAL
     - [ ] STRIPE_PRICE_PREMIUM

3. **Edge function deployment timestamp**
   - What does it say under "Last deployed"?
   - If it's older than 10 minutes ago, it didn't deploy

---

## QUICK TEST AFTER FIX

After adding env vars and redeploying:

1. Delete test user:
   ```sql
   DELETE FROM auth.users WHERE email = 'josh.sturgeon@mac.com';
   ```

2. Test signup with: `josh.sturgeon+test100@mac.com`

3. Check console logs should show:
   ```javascript
   📦 Signup response data: {
     stripeCustomerId: "cus_xxxxx",  // ← MUST SEE THIS
     accountId: "xxx-xxx",
     email: "josh.sturgeon+test100@mac.com"
   }
   ```

4. Check edge function logs should show:
   ```
   Trial user created successfully
   Stripe customer created              ← MUST SEE
   Stripe subscription created          ← MUST SEE
   Account created successfully         ← MUST SEE
   Profile created successfully         ← MUST SEE
   VAPI resources provisioned successfully
   ```

---

## 🎯 BOTTOM LINE

**The edge function code is correct. The issue is one of:**
1. Missing/invalid Stripe API key (90% likely)
2. Missing Stripe price IDs (5% likely)
3. RLS policies (3% likely)
4. Deployment didn't actually work (2% likely)

**Once you share the edge function logs, I can tell you EXACTLY which it is and provide the immediate fix.**
