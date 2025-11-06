# RingSnap Signup Fixes - Testing Checklist

## 🚀 Quick Start

### Prerequisites (Do These First!)

#### 1. Deploy Edge Functions
You MUST deploy the updated edge functions before testing:

**Option A: Via Supabase Dashboard** (Easiest)
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Edge Functions**
4. Click on `search-vapi-numbers` → **Deploy/Redeploy**
5. Click on `create-sales-account` → **Deploy/Redeploy**
6. Wait for deployment to complete (~30 seconds each)

**Option B: Via CLI** (If installed locally)
```bash
supabase functions deploy search-vapi-numbers
supabase functions deploy create-sales-account
```

#### 2. Verify Environment Variables
Go to **Edge Functions** → **Settings** and verify these are set:

**Required**:
- ✅ `VAPI_API_KEY` - Your Vapi API key
- ✅ `VAPI_BASE_URL` - Should be `https://api.vapi.ai`
- ✅ `STRIPE_SECRET_KEY` - Your Stripe test key (starts with `sk_test_`)
- ✅ `STRIPE_PRICE_STARTER` - Stripe price ID for Starter plan
- ✅ `STRIPE_PRICE_PROFESSIONAL` - Stripe price ID for Professional plan
- ✅ `STRIPE_PRICE_PREMIUM` - Stripe price ID for Premium plan
- ✅ `RESEND_API_KEY` - Your Resend API key for emails
- ✅ `SUPABASE_URL` - Auto-set by Supabase
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Auto-set by Supabase

**Test Vapi Connection**:
```bash
curl -X POST https://api.vapi.ai/phone-number/search \
  -H "Authorization: Bearer YOUR_VAPI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"numberDesiredAreaCode":"415","limit":3,"country":"US"}'
```

Should return JSON with phone numbers, not 401/403 error.

#### 3. Start Frontend
```bash
cd /home/user/ringsnap
npm run dev
```

Visit: `http://localhost:5173`

---

## 📋 Testing Sequence

### Test 1: Trial Signup Flow (30 minutes)

**What This Tests**: Number search fix, free trial provisioning

**Follow**: `test-trial-signup.md`

**Quick Steps**:
1. Go to homepage
2. Fill signup form → Submit
3. Login → Onboarding wizard opens
4. Enter area code `415` → Should see 3 numbers
5. Select number → Continue
6. Enter business details → Continue
7. Complete wizard → Wait for provisioning
8. Verify success screen shows phone number
9. Check email for welcome message

**Success Criteria**:
- ✅ Number search returns results in < 1 second
- ✅ Provisioning completes in 5-15 seconds
- ✅ Phone number displayed on success screen
- ✅ Welcome email received
- ✅ No console errors

**Run SQL Check**:
```sql
-- In Supabase SQL Editor
SELECT
  a.vapi_phone_number,
  a.vapi_assistant_id,
  a.provisioning_status,
  p.email
FROM accounts a
JOIN profiles p ON p.account_id = a.id
WHERE p.email LIKE 'test-trial-%@example.com'
ORDER BY a.created_at DESC
LIMIT 1;
```

Expected: All fields populated, `provisioning_status` = 'completed'

---

### Test 2: Sales Signup Flow (30 minutes)

**What This Tests**: Stripe ID storage, inline provisioning, removed phone selection step

**Follow**: `test-sales-signup.md`

**Quick Steps**:
1. Go to `/sales` page
2. Step 1: Enter business info (ZIP: `80202`)
3. Step 2: Select Professional plan
4. Step 3: Enter customer details
5. Step 4: Enter test card `4242 4242 4242 4242`
6. Submit payment
7. **Should skip phone selection** → Go directly to success
8. Verify phone number shown (or "Provisioning...")
9. Check Stripe dashboard for customer
10. Check email for welcome message

**Success Criteria**:
- ✅ Payment processes successfully
- ✅ NO phone selection step (goes straight to success)
- ✅ Provisioning happens automatically
- ✅ Success screen shows phone number within 10 seconds
- ✅ Welcome email received

**Run SQL Check**:
```sql
-- In Supabase SQL Editor
SELECT
  a.stripe_customer_id,
  a.stripe_subscription_id,
  a.vapi_phone_number,
  a.vapi_assistant_id,
  a.provisioning_status,
  a.subscription_status,
  p.email
FROM accounts a
JOIN profiles p ON p.account_id = a.id
WHERE p.email LIKE 'john.test-%@testhvac.com'
ORDER BY a.created_at DESC
LIMIT 1;
```

Expected:
- ✅ `stripe_customer_id` starts with 'cus_'
- ✅ `stripe_subscription_id` starts with 'sub_'
- ✅ `vapi_phone_number` starts with '+1303'
- ✅ `vapi_assistant_id` starts with 'ast_'
- ✅ `provisioning_status` = 'completed'
- ✅ `subscription_status` = 'active'

---

### Test 3: Database Verification (10 minutes)

**Run All Queries**: `test-database-queries.sql`

**Key Queries**:
1. Latest trial accounts - verify phone numbers
2. Latest sales accounts - verify Stripe IDs
3. Check for missing Stripe IDs - should be ZERO
4. Check failed provisioning - investigate any failures
5. Check provisioning success rate - should be > 95%

---

## ✅ What Success Looks Like

### Trial Flow Success:
```
User enters area code 415
  ↓ (< 1 second)
3 phone numbers appear
  ↓
User selects number, completes wizard
  ↓ (5-15 seconds)
Success screen with phone number
  ↓
Welcome email arrives
  ↓
Database: vapi_phone_number ✅, vapi_assistant_id ✅
```

### Sales Flow Success:
```
User completes payment with card 4242...
  ↓ (< 3 seconds)
Payment processes, success message
  ↓ (NO PHONE SELECTION STEP)
Success screen immediately
  ↓ (5-15 seconds in background)
Phone number appears on screen
  ↓
Welcome email arrives
  ↓
Database: stripe_customer_id ✅, stripe_subscription_id ✅,
         vapi_phone_number ✅, vapi_assistant_id ✅
```

---

## ❌ Common Failures & Fixes

### Failure: "No numbers available" for area code 415
**Symptom**: Trial signup can't find numbers
**Cause**: Edge function not deployed or Vapi API key invalid
**Fix**:
1. Redeploy `search-vapi-numbers` edge function
2. Check Vapi API key is set correctly
3. Test Vapi API directly with curl command above

### Failure: Stripe IDs are NULL in database
**Symptom**: Payment succeeds but stripe_customer_id is NULL
**Cause**: `create-sales-account` not deployed with fix
**Fix**:
1. Redeploy `create-sales-account` edge function
2. Clear browser cache
3. Retry signup

### Failure: Phone number is NULL after sales signup
**Symptom**: Payment succeeds but no phone provisioned
**Cause**: Provisioning didn't run or failed
**Fix**:
1. Check Edge Function logs for `provision-resources`
2. Check `accounts.provisioning_error` column
3. Verify Vapi API key
4. Check Vapi account has available numbers

### Failure: Still shows phone selection step in sales flow
**Symptom**: Extra step after payment
**Cause**: Frontend not rebuilt with new code
**Fix**:
1. Stop dev server
2. Clear cache: `rm -rf node_modules/.vite`
3. Restart: `npm run dev`
4. Hard refresh browser: Ctrl+Shift+R (or Cmd+Shift+R on Mac)

---

## 📊 Quick Health Check

Run this SQL to see overall system health:

```sql
-- Provisioning success rate (last 100 signups)
SELECT
  provisioning_status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage
FROM accounts
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY provisioning_status;
```

**Good Health**:
- `completed`: > 95%
- `failed`: < 5%
- `provisioning`: < 1% (should complete quickly)

**Poor Health**:
- `failed`: > 10% → Investigate logs
- `provisioning`: > 5% → Check if stuck

---

## 🔍 Debugging Tools

### 1. Supabase Edge Function Logs
**Location**: Supabase Dashboard → Edge Functions → [Function Name] → Logs

**Look For**:
- `search-vapi-numbers`: "Vapi search succeeded" with count
- `create-sales-account`: "Stripe customer created", "Provisioning succeeded"
- `provision-resources`: "VAPI phone number created", "Assistant created"

### 2. Browser Console
**Access**: F12 → Console tab

**Look For**:
- Network errors (red)
- Supabase function invoke errors
- Stripe errors

### 3. Stripe Dashboard
**Location**: [Stripe Dashboard](https://dashboard.stripe.com/test/customers)

**Check**:
- Customer created with correct email
- Subscription active
- Metadata populated

### 4. Vapi Dashboard
**Location**: [Vapi Dashboard](https://dashboard.vapi.ai)

**Check**:
- Phone numbers purchased
- Assistants created
- Proper configuration

---

## 📞 Support

If you encounter issues:

1. **Check logs first**:
   - Edge Function logs in Supabase
   - Browser console
   - Database queries

2. **Common fixes**:
   - Redeploy edge functions
   - Clear browser cache
   - Verify environment variables
   - Check API keys valid

3. **Need help**:
   - Share edge function logs
   - Share browser console errors
   - Share SQL query results
   - Describe exact steps taken

---

## ✨ Summary

**What Was Fixed**:
1. ✅ Vapi number search (wrong API field name)
2. ✅ Sales Stripe ID storage (IDs not saved)
3. ✅ Sales provisioning (didn't run at all)
4. ✅ Sales wizard flow (removed extra step)

**Time Required**:
- Deploy: 5 minutes
- Trial test: 30 minutes
- Sales test: 30 minutes
- Total: ~1 hour

**Expected Outcome**:
- Both signup flows work end-to-end
- Number search returns results
- Payments link to database
- Provisioning happens automatically
- Users get phone numbers immediately

---

## 🎯 Next Actions

After testing passes:

- [ ] Mark this PR ready for review
- [ ] Deploy to production
- [ ] Monitor provisioning success rate
- [ ] Set up alerts for failures
- [ ] Document for team

Let's test! Start with **Trial Signup** first (easier), then **Sales Signup** (more complex).
