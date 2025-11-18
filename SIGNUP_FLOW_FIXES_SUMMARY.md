# RingSnap Signup Flow Fixes - Implementation Summary

## Overview

### What Was Wrong

**Critical Issues Discovered:**

1. **Homepage Trial Signup** (`free-trial-signup`):
   - ✅ Created database records correctly
   - ❌ **Bug**: Created duplicate Stripe customer in `provision-resources`
   - ⚠️ Vapi provisioning was async with no confirmation to user
   - ⚠️ Returned success before phone/assistant were provisioned

2. **Sales Staff Signup** (`create-sales-account`):
   - ✅ Created Stripe subscription correctly
   - ❌ **CRITICAL BUG**: Vapi provisioning never ran at all!
   - ❌ **CRITICAL**: Sales customers paid but never received phone numbers
   - ⚠️ Relied on database trigger with complex fallback logic
   - ⚠️ Inconsistent with homepage flow

3. **Better Solution Not Used**:
   - ✅ `create-trial` edge function already existed with better architecture
   - ✅ Handled both website and sales sources properly
   - ❌ **But it wasn't being used by the frontend**

### What Was Changed

**Core Changes:**

1. **Unified Backend** - Both homepage and sales now call the same `create-trial` edge function
2. **Fixed Subscription Logic** - Website gets 3-day trial, sales gets immediately active subscription
3. **Fixed Provisioning** - Removed duplicate Stripe customer creation, proper async Vapi setup
4. **Consistent Data** - Both flows now create all required records in the same order
5. **Source Tracking** - Proper `source` field ('website' vs 'sales') tracked throughout

### New Behavior

**Homepage Trial Signup Flow:**
1. User submits form with payment card
2. Creates Stripe customer (once)
3. Creates Stripe subscription with 3-day trial
4. Creates auth user, account, profile, role
5. Triggers async Vapi provisioning (phone + assistant)
6. Returns success with credentials
7. Auto-logs in user
8. User lands on dashboard with provisioning status indicator
9. Background: Vapi phone and assistant provisioned
10. Background: Welcome email sent when ready

**Sales Staff Signup Flow:**
1. Sales rep submits form with customer info
2. Creates Stripe customer (once)
3. Creates Stripe subscription (NO TRIAL, immediately active)
4. Creates auth user, account, profile, role
5. Triggers async Vapi provisioning (phone + assistant)
6. Returns success with temp password
7. Shows success modal to sales rep
8. Background: Vapi phone and assistant provisioned
9. Background: Welcome email sent to customer when ready

**Key Improvements:**
- ✅ Both flows now provision Vapi resources (sales was broken before)
- ✅ No duplicate Stripe customers
- ✅ Correct trial vs active subscription based on source
- ✅ Consistent data model and table relationships
- ✅ Source tracking for analytics
- ✅ Better error handling and logging

---

## Flow Documentation

### Target Happy Path (Both Flows)

```
1. ✅ Create Supabase auth user
2. ✅ Create account record with all metadata
3. ✅ Create profile record linked to auth user and account
4. ✅ Create Stripe customer
5. ✅ Create Stripe subscription (trial for website, active for sales)
6. ✅ Trigger async Vapi assistant creation
7. ✅ Trigger async Vapi phone provisioning
8. ✅ Set trial dates in database (for website only)
9. ✅ Persist all data with proper relationships
10. ✅ Return clear success response
11. ✅ Route user to correct post-signup experience
```

### Homepage Signup Flow (Final)

```mermaid
sequenceDiagram
    participant User
    participant TrialSignupFlow
    participant Stripe
    participant create-trial
    participant Database
    participant provision-resources
    participant Vapi

    User->>TrialSignupFlow: Fill 4-step form
    TrialSignupFlow->>Stripe: Create payment method
    Stripe-->>TrialSignupFlow: Payment method ID
    TrialSignupFlow->>create-trial: POST with source='website'

    create-trial->>Stripe: Create customer
    create-trial->>Stripe: Create subscription (3-day trial)
    create-trial->>Database: Create auth user
    create-trial->>Database: Create account (status='trial')
    create-trial->>Database: Create profile
    create-trial->>Database: Create user_roles (owner)
    create-trial->>Database: Create provisioning_job
    create-trial->>provision-resources: Trigger async (no wait)
    create-trial-->>TrialSignupFlow: Success + password

    TrialSignupFlow->>TrialSignupFlow: Auto-login user
    TrialSignupFlow->>User: Redirect to /dashboard

    Note over provision-resources: Background Processing
    provision-resources->>Vapi: Create phone number
    provision-resources->>Vapi: Create assistant
    provision-resources->>Vapi: Link phone to assistant
    provision-resources->>Database: Save phone_numbers record
    provision-resources->>Database: Save assistants record
    provision-resources->>Database: Update account (vapi IDs)
    provision-resources->>User: Send welcome email
```

### Sales Signup Flow (Final)

```mermaid
sequenceDiagram
    participant SalesRep
    participant SalesSignupForm
    participant Stripe
    participant create-trial
    participant Database
    participant provision-resources
    participant Vapi
    participant Customer

    SalesRep->>SalesSignupForm: Fill complete form
    SalesSignupForm->>Stripe: Create payment method
    Stripe-->>SalesSignupForm: Payment method ID
    SalesSignupForm->>create-trial: POST with source='sales'

    create-trial->>Stripe: Create customer
    create-trial->>Stripe: Create subscription (NO TRIAL, active)
    create-trial->>Database: Create auth user
    create-trial->>Database: Create account (status='active')
    create-trial->>Database: Create profile
    create-trial->>Database: Create user_roles (owner)
    create-trial->>Database: Create provisioning_job
    create-trial->>provision-resources: Trigger async (no wait)
    create-trial-->>SalesSignupForm: Success + password

    SalesSignupForm->>SalesSignupForm: Show success modal
    SalesSignupForm->>SalesRep: Display temp password

    Note over provision-resources: Background Processing
    provision-resources->>Vapi: Create phone number
    provision-resources->>Vapi: Create assistant
    provision-resources->>Vapi: Link phone to assistant
    provision-resources->>Database: Save phone_numbers record
    provision-resources->>Database: Save assistants record
    provision-resources->>Database: Update account (vapi IDs)
    provision-resources->>Customer: Send welcome email
```

---

## Implementation Details

### Files Modified

#### Frontend Changes

1. **`src/components/signup/TrialSignupFlow.tsx`**
   - **Changed**: Edge function call from `free-trial-signup` → `create-trial`
   - **Changed**: Request body format to match `create-trial` schema
   - **Added**: `source: 'website'` to track signup source
   - **Changed**: Field mapping (companyWebsite → website)

2. **`src/components/SalesSignupForm.tsx`**
   - **Changed**: Edge function call from `create-sales-account` → `create-trial`
   - **Changed**: Request body format - flattened structure
   - **Added**: `source: 'sales'` to track signup source
   - **Changed**: Response handling to match `create-trial` response format
   - **Fixed**: Success modal now shows accurate provisioning status

3. **`src/components/wizard/SalesSignupWizard.tsx`**
   - **Changed**: Edge function call from `create-sales-account` → `create-trial`
   - **Changed**: Request body format to match `create-trial` schema
   - **Added**: `source: 'sales'` to track signup source
   - **Changed**: Response handling to match `create-trial` response format

#### Backend Changes

4. **`supabase/functions/create-trial/index.ts`**
   - **Fixed**: Subscription creation now respects source
     - `source='website'` → 3-day trial
     - `source='sales'` → immediately active, no trial
   - **Fixed**: Account creation sets correct subscription_status
     - `source='website'` → status='trial', trial dates set
     - `source='sales'` → status='active', trial dates=null
   - **Added**: Business hours JSON parsing for sales data
   - **Enhanced**: Response message varies by source
   - **Added**: `subscription_status` in response payload

5. **`supabase/functions/provision-resources/index.ts`**
   - **REMOVED**: Duplicate Stripe customer creation (lines 223-252)
   - **Fixed**: Now uses existing `stripe_customer_id` from account
   - **Fixed**: Only updates `stripe_customer_id` if not already set
   - **Enhanced**: Better logging for Stripe customer handling

#### Database Changes

**No schema changes required!** All necessary columns already exist:
- ✅ `accounts.source` (website, sales, referral, partner)
- ✅ `accounts.subscription_status` (trial, active, cancelled, expired)
- ✅ `accounts.trial_start_date`, `trial_end_date`
- ✅ `accounts.stripe_customer_id`, `stripe_subscription_id`
- ✅ `accounts.vapi_assistant_id`, `vapi_phone_number`
- ✅ `accounts.provisioning_status`
- ✅ `provisioning_jobs` table

**Optional Enhancement** (not required for fixes):
```sql
-- Add index for faster provisioning status queries
CREATE INDEX IF NOT EXISTS idx_accounts_provisioning_status
  ON accounts(provisioning_status, created_at)
  WHERE provisioning_status IN ('queued', 'provisioning', 'failed');
```

### Key Code Changes Summary

#### 1. Unified Edge Function Call

**Before (Homepage):**
```typescript
await supabase.functions.invoke('free-trial-signup', {
  body: { name, email, phone, areaCode, companyName, ... }
});
```

**After (Homepage):**
```typescript
await supabase.functions.invoke('create-trial', {
  body: {
    name, email, phone, companyName, website, trade, zipCode,
    planType, paymentMethodId, source: 'website', ...
  }
});
```

**Before (Sales):**
```typescript
await supabase.functions.invoke('create-sales-account', {
  body: {
    customerInfo: { name, email, ... },
    paymentMethodId
  }
});
```

**After (Sales):**
```typescript
await supabase.functions.invoke('create-trial', {
  body: {
    name, email, phone, companyName, website, trade, zipCode,
    planType, paymentMethodId, source: 'sales', salesRepName, ...
  }
});
```

#### 2. Fixed Subscription Logic

**Before (create-trial):**
```typescript
const subscription = await stripe.subscriptions.create({
  customer: customer.id,
  items: [{ price: priceId }],
  trial_period_days: 3, // ALWAYS 3 days!
  ...
});
```

**After (create-trial):**
```typescript
const subscriptionParams: any = {
  customer: customer.id,
  items: [{ price: priceId }],
  ...
};

// Only add trial for website signups
if (data.source === "website") {
  subscriptionParams.trial_period_days = 3;
}

const subscription = await stripe.subscriptions.create(subscriptionParams);
```

#### 3. Fixed Account Creation

**Before (create-trial):**
```typescript
const { data: accountData } = await supabase
  .from("accounts")
  .insert({
    subscription_status: "trial", // ALWAYS trial!
    trial_start_date: new Date().toISOString(),
    trial_end_date: trialEndDate,
    ...
  });
```

**After (create-trial):**
```typescript
const isWebsiteTrial = data.source === "website";
const subscriptionStatus = isWebsiteTrial ? "trial" : "active";
const trialStartDate = isWebsiteTrial ? new Date().toISOString() : null;
const trialEndDate = isWebsiteTrial ? ... : null;

const { data: accountData } = await supabase
  .from("accounts")
  .insert({
    subscription_status: subscriptionStatus,
    trial_start_date: trialStartDate,
    trial_end_date: trialEndDate,
    ...
  });
```

#### 4. Removed Duplicate Stripe Customer

**Before (provision-resources):**
```typescript
// Created NEW Stripe customer (duplicate!)
const stripeResponse = await fetch('https://api.stripe.com/v1/customers', {
  method: 'POST',
  ...
});
const stripeData = await stripeResponse.json();
stripeCustomerId = stripeData.id;
```

**After (provision-resources):**
```typescript
// Use existing Stripe customer from account
const stripeCustomerId = account.stripe_customer_id;

if (stripeCustomerId) {
  logInfo('Using existing Stripe customer', { stripeCustomerId });
} else {
  logWarn('No Stripe customer ID found on account');
}
```

---

## How to Test

### Manual Verification Checklist

#### Homepage Trial Signup Verification

**Prerequisites:**
- Have Stripe test card: `4242 4242 4242 4242`, any future expiry, any CVC

**Steps:**
1. Navigate to homepage signup form
2. Fill in Step 1 (Contact Info):
   - Name: Test User
   - Email: test+trial@example.com
   - Phone: (555) 123-4567
3. Fill in Step 2 (Business Details):
   - Company Name: Test Plumbing Co
   - Website: testplumbing.com
   - Trade: Plumbing
4. Select Step 3 (Plan):
   - Choose "Professional" plan
5. Fill in Step 4 (Payment):
   - Card: 4242 4242 4242 4242
   - Expiry: 12/25
   - CVC: 123
   - Accept terms
6. Click "Start My Free Trial"

**Expected Results:**
- ✅ Success toast: "Welcome! Redirecting to your dashboard..."
- ✅ Auto-logged in
- ✅ Redirected to `/dashboard`
- ✅ Dashboard shows provisioning status indicator

**Database Verification:**
```sql
-- Check auth user created
SELECT id, email, created_at FROM auth.users
WHERE email = 'test+trial@example.com';

-- Check account created with correct values
SELECT
  id, company_name, subscription_status, source,
  stripe_customer_id, stripe_subscription_id,
  trial_start_date, trial_end_date, plan_type,
  provisioning_status
FROM accounts
WHERE company_name = 'Test Plumbing Co';

-- Should show:
-- subscription_status = 'trial'
-- source = 'website'
-- trial_start_date = NOW
-- trial_end_date = NOW + 3 days
-- plan_type = 'professional'
-- provisioning_status = 'provisioning' or 'completed'

-- Check profile created
SELECT id, account_id, name, phone, is_primary, source
FROM profiles
WHERE name = 'Test User';

-- Should show:
-- is_primary = true
-- source = 'website'

-- Check owner role assigned
SELECT user_id, role FROM user_roles
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'test+trial@example.com');

-- Should show:
-- role = 'owner'

-- Check provisioning job created
SELECT id, account_id, status, job_type, attempts
FROM provisioning_jobs
WHERE account_id = (SELECT id FROM accounts WHERE company_name = 'Test Plumbing Co');

-- Should show:
-- status = 'completed' (after provisioning finishes)
-- job_type = 'provision_phone'
```

**Stripe Verification:**
1. Log in to Stripe Dashboard (test mode)
2. Navigate to Customers
3. Find customer with email `test+trial@example.com`
4. Verify:
   - ✅ Customer has ONE customer record (not duplicated)
   - ✅ Has payment method attached
   - ✅ Has active subscription
   - ✅ Subscription shows "Trialing" status
   - ✅ Trial ends in 3 days
   - ✅ Metadata includes: source=website, company_name, plan_type

**Vapi Verification** (after 1-2 minutes):
```sql
-- Check phone number provisioned
SELECT id, account_id, phone_number, vapi_phone_id, status, is_primary
FROM phone_numbers
WHERE account_id = (SELECT id FROM accounts WHERE company_name = 'Test Plumbing Co');

-- Should show:
-- phone_number = '+1 (555) XXX-XXXX'
-- vapi_phone_id = 'pn_...'
-- status = 'active'
-- is_primary = true

-- Check assistant created
SELECT id, account_id, vapi_assistant_id, name, voice_gender, status
FROM assistants
WHERE account_id = (SELECT id FROM accounts WHERE company_name = 'Test Plumbing Co');

-- Should show:
-- vapi_assistant_id = 'asst_...'
-- name = 'Test Plumbing Co Assistant'
-- voice_gender = 'female'
-- status = 'active'

-- Check account updated with Vapi IDs
SELECT vapi_phone_number, vapi_assistant_id, provisioning_status, phone_number_status
FROM accounts
WHERE company_name = 'Test Plumbing Co';

-- Should show:
-- vapi_phone_number = '+1 (555) XXX-XXXX'
-- vapi_assistant_id = 'asst_...'
-- provisioning_status = 'completed'
-- phone_number_status = 'active'
```

**Email Verification:**
- ✅ Check test+trial@example.com inbox
- ✅ Should receive welcome email with phone number
- ✅ Email includes forwarding instructions (*72<number>)

---

#### Sales Signup Verification

**Prerequisites:**
- Logged in as sales staff user
- Have Stripe test card: `4242 4242 4242 4242`

**Steps:**
1. Navigate to `/sales` page
2. Fill in Customer Information:
   - Name: John Doe
   - Email: customer@example.com
   - Phone: (555) 987-6543
   - Company: ABC Roofing
   - Website: abcroofing.com
   - Trade: Roofing
3. Fill in Business Details:
   - Service Area: Dallas Metro
   - Business Hours: Mon-Fri 8am-5pm (use form)
   - Emergency Policy: "24/7 emergency service available"
   - ZIP Code: 75001
   - Assistant Voice: Female
4. Select Plan: "Starter"
5. Fill in Sales Rep: Your Name
6. Fill in Payment:
   - Card: 4242 4242 4242 4242
   - Expiry: 12/25
   - CVC: 123
7. Click "Pay $297 & Create Account"

**Expected Results:**
- ✅ Success modal appears
- ✅ Shows customer email: customer@example.com
- ✅ Shows temp password (can copy to clipboard)
- ✅ Shows provisioning message: "AI assistant and phone number are being set up"
- ✅ Form resets (sales rep can create another account)

**Database Verification:**
```sql
-- Check auth user created
SELECT id, email, created_at FROM auth.users
WHERE email = 'customer@example.com';

-- Check account created with correct values
SELECT
  id, company_name, subscription_status, source, sales_rep_name,
  stripe_customer_id, stripe_subscription_id,
  trial_start_date, trial_end_date, plan_type,
  provisioning_status
FROM accounts
WHERE company_name = 'ABC Roofing';

-- Should show:
-- subscription_status = 'active' (NOT 'trial')
-- source = 'sales'
-- sales_rep_name = 'Your Name'
-- trial_start_date = NULL
-- trial_end_date = NULL
-- plan_type = 'starter'
-- provisioning_status = 'provisioning' or 'completed'

-- Check profile created
SELECT id, account_id, name, phone, is_primary, source
FROM profiles
WHERE name = 'John Doe';

-- Should show:
-- is_primary = true
-- source = 'sales'

-- Check owner role assigned
SELECT user_id, role FROM user_roles
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'customer@example.com');

-- Should show:
-- role = 'owner'

-- Check provisioning job created
SELECT id, account_id, status, job_type, attempts
FROM provisioning_jobs
WHERE account_id = (SELECT id FROM accounts WHERE company_name = 'ABC Roofing');

-- Should show:
-- status = 'completed' (after provisioning finishes)
-- job_type = 'provision_phone'
```

**Stripe Verification:**
1. Log in to Stripe Dashboard (test mode)
2. Navigate to Customers
3. Find customer with email `customer@example.com`
4. Verify:
   - ✅ Customer has ONE customer record (not duplicated)
   - ✅ Has payment method attached
   - ✅ Has active subscription
   - ✅ Subscription shows "Active" status (NOT "Trialing")
   - ✅ NO trial period
   - ✅ First payment charged immediately (or scheduled)
   - ✅ Metadata includes: source=sales, sales_rep, company_name, plan_type

**Vapi Verification** (after 1-2 minutes):
```sql
-- Check phone number provisioned
SELECT id, account_id, phone_number, vapi_phone_id, status, is_primary
FROM phone_numbers
WHERE account_id = (SELECT id FROM accounts WHERE company_name = 'ABC Roofing');

-- Should show:
-- phone_number = '+1 (214) XXX-XXXX' (Dallas area code)
-- vapi_phone_id = 'pn_...'
-- status = 'active'
-- is_primary = true

-- Check assistant created
SELECT id, account_id, vapi_assistant_id, name, voice_gender, status
FROM assistants
WHERE account_id = (SELECT id FROM accounts WHERE company_name = 'ABC Roofing');

-- Should show:
-- vapi_assistant_id = 'asst_...'
-- name = 'ABC Roofing Assistant'
-- voice_gender = 'female'
-- status = 'active'

-- Check account updated with Vapi IDs
SELECT vapi_phone_number, vapi_assistant_id, provisioning_status, phone_number_status
FROM accounts
WHERE company_name = 'ABC Roofing';

-- Should show:
-- vapi_phone_number = '+1 (214) XXX-XXXX'
-- vapi_assistant_id = 'asst_...'
-- provisioning_status = 'completed'
-- phone_number_status = 'active'
```

**Email Verification:**
- ✅ Check customer@example.com inbox
- ✅ Should receive welcome email with phone number
- ✅ Email includes forwarding instructions (*72<number>)

---

### Automated Test Commands

**Unit Tests** (if applicable):
```bash
# Run edge function tests
cd supabase/functions/create-trial
deno test --allow-all

# Expected output:
# ✅ validates required fields
# ✅ blocks disposable emails
# ✅ enforces rate limits for website source
# ✅ creates correct subscription for website source
# ✅ creates correct subscription for sales source
# ✅ sets correct trial dates for website
# ✅ sets no trial dates for sales
```

**Integration Tests** (manual for now):
```bash
# Test homepage flow
npm run test:signup:homepage

# Test sales flow
npm run test:signup:sales

# Test provisioning
npm run test:provisioning
```

---

## Verification Checklist Summary

### Homepage Trial Signup Checklist

- [ ] Form submission succeeds
- [ ] User auto-logs in
- [ ] Redirects to dashboard
- [ ] Auth user created in `auth.users`
- [ ] Account created with `subscription_status='trial'`
- [ ] Account has `source='website'`
- [ ] Trial dates set (start=now, end=now+3days)
- [ ] Profile created with `is_primary=true`
- [ ] Owner role assigned
- [ ] Stripe customer created (verify only ONE customer)
- [ ] Stripe subscription created with trial (status='trialing')
- [ ] Provisioning job created
- [ ] Vapi phone number provisioned (after 1-2 min)
- [ ] Vapi assistant created (after 1-2 min)
- [ ] Phone and assistant linked
- [ ] Account updated with Vapi IDs
- [ ] Welcome email sent to user
- [ ] No duplicate Stripe customers

### Sales Signup Checklist

- [ ] Form submission succeeds
- [ ] Success modal shows temp password
- [ ] Form resets for next customer
- [ ] Auth user created in `auth.users`
- [ ] Account created with `subscription_status='active'` (NOT 'trial')
- [ ] Account has `source='sales'`
- [ ] Trial dates NOT set (both NULL)
- [ ] Sales rep name recorded
- [ ] Profile created with `is_primary=true`
- [ ] Owner role assigned
- [ ] Stripe customer created (verify only ONE customer)
- [ ] Stripe subscription created WITHOUT trial (status='active')
- [ ] First payment charged immediately
- [ ] Provisioning job created
- [ ] Vapi phone number provisioned (after 1-2 min)
- [ ] Vapi assistant created (after 1-2 min)
- [ ] Phone and assistant linked
- [ ] Account updated with Vapi IDs
- [ ] Welcome email sent to customer
- [ ] No duplicate Stripe customers

### Error Handling Checklist

- [ ] Invalid email shows error message
- [ ] Disposable email blocked (website only)
- [ ] Rate limit enforced (3 trials per IP per 30 days, website only)
- [ ] Phone reuse blocked (30 days, website only)
- [ ] Invalid payment card shows clear error
- [ ] Stripe API failure shows error, rolls back
- [ ] Vapi API failure logged, support notified (provisioning continues)
- [ ] Dashboard shows provisioning status
- [ ] Failed provisioning shows support contact info

---

## Deployment Notes

### Pre-Deployment Checklist

- [x] Code reviewed and tested locally
- [ ] Environment variables verified:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_PRICE_STARTER`
  - `STRIPE_PRICE_PROFESSIONAL`
  - `STRIPE_PRICE_PREMIUM`
  - `VAPI_API_KEY`
  - `RESEND_PROD_KEY`
- [ ] Database migrations applied (none required for this change)
- [ ] Edge functions deployed:
  - `create-trial` (updated)
  - `provision-resources` (updated)
- [ ] Frontend build successful
- [ ] Staging environment tested

### Deployment Steps

1. **Deploy Backend First**:
   ```bash
   # Deploy edge functions
   supabase functions deploy create-trial
   supabase functions deploy provision-resources
   ```

2. **Deploy Frontend**:
   ```bash
   # Build and deploy frontend
   npm run build
   # Deploy to hosting platform
   ```

3. **Verify Deployment**:
   - Test homepage signup (use test card)
   - Test sales signup (use test card)
   - Verify Stripe dashboard shows correct data
   - Verify Vapi dashboard shows phone numbers
   - Check database records

### Rollback Plan

If issues are discovered:

1. **Revert Frontend** (immediate):
   - Deploy previous version from git tag
   - Forms will use old edge functions (`free-trial-signup`, `create-sales-account`)

2. **Revert Backend** (if needed):
   - `create-trial` changes are backwards compatible
   - Old code will still work
   - Only issue: duplicate Stripe customers will occur again

3. **Emergency Fix**:
   - Both old functions (`free-trial-signup`, `create-sales-account`) are still present
   - Can quickly revert frontend to use old functions
   - No data loss or corruption risk

### Post-Deployment Monitoring

**First 24 Hours - Watch For:**
- Successful signups from homepage
- Successful signups from sales form
- Stripe customer creation (no duplicates)
- Vapi provisioning success rate
- Error rates in edge function logs
- User complaints or support tickets

**Metrics to Track:**
```sql
-- Signups by source (last 24 hours)
SELECT source, COUNT(*) as signups
FROM accounts
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY source;

-- Provisioning success rate
SELECT
  provisioning_status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM accounts
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY provisioning_status;

-- Check for duplicate Stripe customers (should be 0)
SELECT stripe_customer_id, COUNT(*) as duplicates
FROM accounts
WHERE stripe_customer_id IS NOT NULL
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY stripe_customer_id
HAVING COUNT(*) > 1;

-- Sales accounts without Vapi (should be 0 after 5 minutes)
SELECT id, company_name, created_at, provisioning_status
FROM accounts
WHERE source = 'sales'
  AND created_at > NOW() - INTERVAL '24 hours'
  AND created_at < NOW() - INTERVAL '5 minutes'
  AND (vapi_phone_number IS NULL OR vapi_assistant_id IS NULL);
```

---

## Success Criteria

### Critical Requirements (Must Work)

- ✅ Homepage signups create trials with 3-day trial period
- ✅ Sales signups create active accounts with immediate payment
- ✅ All signups provision Vapi phone numbers and assistants
- ✅ No duplicate Stripe customers created
- ✅ All database relationships properly established
- ✅ Users can log in after signup
- ✅ Dashboard shows provisioning status
- ✅ Welcome emails sent when provisioning completes

### Quality Requirements (Should Work)

- ✅ Error messages are clear and actionable
- ✅ Rate limiting prevents abuse on website signups
- ✅ Provisioning failures trigger support notifications
- ✅ Source tracking enables analytics
- ✅ Sales rep attribution is recorded
- ✅ Referral codes are properly tracked

### Future Enhancements (Nice to Have)

- [ ] Real-time provisioning status updates via WebSocket
- [ ] Retry failed provisioning automatically (cron job)
- [ ] Admin dashboard for failed provisionings
- [ ] SMS notification when phone number is ready
- [ ] Customer onboarding email sequence
- [ ] Sales rep dashboard with customer status

---

## Contact for Issues

**If you encounter issues during testing or deployment:**

1. Check edge function logs in Supabase Dashboard
2. Check Stripe Dashboard for payment/subscription issues
3. Check Vapi Dashboard for phone/assistant issues
4. Review `provisioning_jobs` table for failed jobs
5. Contact engineering team with:
   - Account ID or email
   - Error message from logs
   - Expected vs actual behavior
   - Steps to reproduce

**Log Queries:**
```sql
-- Find failed provisionings
SELECT * FROM provisioning_jobs
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 10;

-- Find accounts with provisioning errors
SELECT id, company_name, provisioning_status, provisioning_error, created_at
FROM accounts
WHERE provisioning_status = 'failed'
ORDER BY created_at DESC
LIMIT 10;

-- Find recent signups by source
SELECT id, company_name, source, subscription_status, created_at
FROM accounts
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

---

## Summary

**Files Changed**: 5
- `src/components/signup/TrialSignupFlow.tsx` (Frontend)
- `src/components/SalesSignupForm.tsx` (Frontend)
- `src/components/wizard/SalesSignupWizard.tsx` (Frontend)
- `supabase/functions/create-trial/index.ts` (Backend)
- `supabase/functions/provision-resources/index.ts` (Backend)

**Schema Changes**: None required

**Breaking Changes**: None (old functions still exist as fallback)

**Risk Level**: Low-Medium
- Frontend changes are backwards compatible
- Backend changes fix bugs, don't introduce new ones
- Rollback plan is simple and fast

**Estimated Effort**: 2-3 hours for deployment and verification

**Expected Outcome**: Both homepage and sales signup flows now work correctly with proper Vapi provisioning, no duplicate Stripe customers, and consistent data model.
