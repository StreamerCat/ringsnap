# RingSnap Signup Flow Audit & Remediation Plan

## PHASE 1: Repository Discovery and Mapping

### Frontend Signup Components

#### Homepage Trial Signup
- **Main Component**: `src/components/signup/TrialSignupFlow.tsx`
  - Multi-step form (4 steps): Contact Info → Business Details → Plan Selection → Payment
  - Uses React Hook Form with Zod validation
  - Integrates with Stripe Elements for payment
  - Calls edge function: `free-trial-signup`
  - Auto-login after success

- **Supporting Components**:
  - `src/components/signup/UnifiedSignupRouter.tsx` - Router for signup flows
  - `src/components/signup/shared/PlanSelectionStep.tsx` - Plan selection UI
  - `src/components/signup/shared/schemas.ts` - Validation schemas
  - `src/components/signup/shared/utils.ts` - Helper functions

#### /sales Staff Signup
- **Main Components**:
  - `src/components/wizard/SalesSignupWizard.tsx` - Multi-step wizard
  - `src/components/SalesSignupForm.tsx` - Single-page form (more recent)
  - Both call edge function: `create-sales-account`

- **Supporting Components**:
  - `src/components/sales/sections/CustomerInfoSection.tsx`
  - `src/components/sales/sections/BusinessDetailsSection.tsx`
  - `src/components/sales/sections/PlanSelectionSection.tsx`
  - `src/components/sales/sections/PaymentSection.tsx`
  - `src/components/sales/sections/SalesRepSection.tsx`

#### Alternate Entry (not primary)
- `app/api/signup/route.ts` - Next.js API route (appears to be an older flow)
  - Creates user and account records
  - Calls `provision` edge function
  - May be legacy/unused

---

### Backend Edge Functions

#### 1. `free-trial-signup` (Homepage)
**Path**: `supabase/functions/free-trial-signup/index.ts`

**Current Flow**:
1. ✅ Validates input (email, phone, area code, plan type, payment method)
2. ✅ Checks for disposable email domains
3. ✅ Rate limiting (IP-based, 3 trials per 30 days)
4. ✅ Phone number reuse check (30 days)
5. ✅ Creates Stripe customer with payment method
6. ✅ Creates Stripe subscription (3-day trial)
7. ✅ Creates Supabase auth user with auto-confirmed email
8. ✅ Creates account record (with trial dates, Stripe IDs)
9. ✅ Creates profile record
10. ✅ Assigns owner role
11. ⚠️ **Triggers async VAPI provisioning** (`provision-resources`)
12. ✅ Logs signup attempt to `signup_attempts` table
13. ✅ Returns success with credentials

**Issues**:
- Vapi provisioning is async and may not complete before response
- No validation that Vapi assistant and phone were created
- Response doesn't confirm Vapi setup status

#### 2. `create-sales-account` (Sales Form)
**Path**: `supabase/functions/create-sales-account/index.ts`

**Current Flow**:
1. ✅ Validates input (customer info, payment method)
2. ✅ Creates Stripe customer
3. ✅ Attaches payment method
4. ✅ **Creates Stripe subscription with NO TRIAL** (immediately active)
5. ✅ Generates secure temp password
6. ✅ Creates Supabase auth user with auto-confirmed email
7. ⚠️ **Waits for database trigger to create account/profile** (with 1s delay)
8. ⚠️ Manually creates account if trigger fails
9. ✅ Updates account with Stripe IDs and sales-specific fields
10. ✅ Handles referral code tracking
11. ⚠️ **Queues async provisioning** (but doesn't wait or verify)
12. ✅ Returns success immediately

**Issues**:
- Relies on database trigger which can fail silently
- No confirmation that Vapi assistant and phone were created
- Provisioning is queued but not confirmed
- Returns success even if provisioning hasn't started
- Sales accounts should have `subscription_status = 'active'` NOT 'trial'

#### 3. `create-trial` (Unified approach - appears newer)
**Path**: `supabase/functions/create-trial/index.ts`

**Current Flow**:
1. ✅ Comprehensive validation with Zod schema
2. ✅ Supports both 'website' and 'sales' sources
3. ✅ Phone and email validation
4. ✅ Anti-abuse rate limiting (website only)
5. ✅ Creates Stripe customer and attaches payment
6. ✅ Creates Stripe subscription (3-day trial for website, immediate for sales)
7. ✅ Creates auth user
8. ✅ Creates account record with ALL metadata
9. ✅ Creates profile record
10. ✅ Assigns owner role
11. ✅ Creates provisioning job record
12. ⚠️ **Triggers async provisioning** (`provision-resources`)
13. ✅ Returns success

**Status**: This appears to be a NEWER, more robust unified function that handles both flows. However, it's not currently being used by the frontend forms!

#### 4. `provision-resources` (Async provisioning)
**Path**: `supabase/functions/provision-resources/index.ts`

**Current Flow**:
1. ✅ Sets `provisioning_status = 'provisioning'`
2. ✅ Determines area code from zip or request
3. ✅ **Creates VAPI phone number** with desired area code
4. ✅ **Creates VAPI assistant** with company-specific prompt
5. ✅ **Links assistant to phone number**
6. ⚠️ Creates Stripe customer (DUPLICATE - already exists!)
7. ✅ Generates referral code
8. ✅ Inserts `phone_numbers` record
9. ✅ Inserts `assistants` record
10. ✅ Updates account with Vapi IDs and phone number
11. ✅ Sends onboarding SMS (non-blocking)
12. ✅ Sends welcome email with forwarding instructions

**Issues**:
- Creates duplicate Stripe customer (Stripe customer already created in signup functions)
- No retry logic if Vapi API fails
- No notification to frontend if provisioning fails
- Errors are logged but user may never know

---

### Database Schema

#### Key Tables for Signup Flow

**`auth.users`** (Supabase Auth managed)
- `id` (UUID, PK)
- `email`
- `encrypted_password`
- `email_confirmed_at`
- `raw_user_meta_data` (JSONB) - stores name, phone, company info
- `created_at`

**`public.accounts`** (Organization/Company level)
- `id` (UUID, PK)
- `company_name` (TEXT, NOT NULL)
- `company_domain` (TEXT, UNIQUE)
- `company_website` (TEXT)
- `trade` (TEXT)
- `service_area` (TEXT)
- `business_hours` (JSONB)
- `emergency_policy` (TEXT)
- `assistant_gender` (TEXT)
- `wants_advanced_voice` (BOOLEAN)
- `primary_goal` (TEXT)
- **Stripe fields**:
  - `stripe_customer_id` (TEXT)
  - `stripe_subscription_id` (TEXT)
  - `plan_type` (TEXT) - 'starter', 'professional', 'premium'
- **Trial fields**:
  - `subscription_status` (ENUM) - 'trial', 'active', 'cancelled', 'expired'
  - `trial_start_date` (TIMESTAMPTZ)
  - `trial_end_date` (TIMESTAMPTZ)
- **Vapi fields**:
  - `vapi_assistant_id` (TEXT)
  - `vapi_phone_number` (TEXT)
  - `phone_number_area_code` (TEXT)
  - `phone_number_status` (TEXT)
- **Provisioning fields**:
  - `provisioning_status` (TEXT) - 'idle', 'pending', 'provisioning', 'completed', 'failed'
  - `provisioning_error` (TEXT)
- **Source tracking**:
  - `source` (TEXT) - 'website', 'sales', 'referral', 'partner'
  - `sales_rep_name` (TEXT)
- `created_at`, `updated_at`

**`public.profiles`** (User level - linked to auth.users)
- `id` (UUID, PK, FK to auth.users)
- `account_id` (UUID, FK to accounts)
- `name` (TEXT, NOT NULL)
- `phone` (TEXT, NOT NULL)
- `is_primary` (BOOLEAN)
- `source` (TEXT)
- `created_at`, `updated_at`

**`public.user_roles`** (RBAC)
- `id` (UUID, PK)
- `user_id` (UUID, FK to auth.users)
- `role` (ENUM) - 'owner', 'admin', 'user'
- UNIQUE(user_id, role)

**`public.phone_numbers`** (Vapi phone records)
- `id` (UUID, PK)
- `account_id` (UUID, FK to accounts)
- `phone_number` (TEXT)
- `vapi_phone_id` (TEXT)
- `area_code` (TEXT)
- `is_primary` (BOOLEAN)
- `status` (TEXT)
- `label` (TEXT)

**`public.assistants`** (Vapi assistant records)
- `id` (UUID, PK)
- `account_id` (UUID, FK to accounts)
- `phone_number_id` (UUID, FK to phone_numbers)
- `vapi_assistant_id` (TEXT)
- `name` (TEXT)
- `voice_id` (TEXT)
- `voice_gender` (TEXT)
- `is_primary` (BOOLEAN)
- `status` (TEXT)

**`public.provisioning_jobs`** (Background job tracking)
- `id` (UUID, PK)
- `account_id` (UUID, FK to accounts)
- `user_id` (UUID, FK to auth.users)
- `status` (TEXT) - 'queued', 'in_progress', 'completed', 'failed'
- `job_type` (TEXT)
- `attempts` (INT)
- `error_message` (TEXT)
- `created_at`, `updated_at`

**`public.signup_attempts`** (Anti-abuse tracking)
- `id` (UUID, PK)
- `email` (TEXT)
- `phone` (TEXT)
- `ip_address` (INET)
- `device_fingerprint` (TEXT)
- `success` (BOOLEAN)
- `blocked_reason` (TEXT)
- `created_at`

---

### Current Flow Wiring

#### Homepage Trial Signup Flow

```
User fills form (TrialSignupFlow.tsx)
  ↓
Stripe.createPaymentMethod()
  ↓
supabase.functions.invoke('free-trial-signup')
  ↓
  [Edge Function: free-trial-signup]
  1. Validate input
  2. Check rate limits & phone reuse
  3. Create Stripe customer
  4. Create Stripe subscription (3-day trial)
  5. Create auth user
  6. Create account record (subscription_status='trial')
  7. Create profile record
  8. Assign owner role
  9. Trigger async: provision-resources
  10. Return success
  ↓
Frontend: Auto-login user
  ↓
Redirect to /dashboard
  ↓
  [Background: provision-resources]
  1. Create Vapi phone number
  2. Create Vapi assistant
  3. Link phone to assistant
  4. Update account with Vapi IDs
  5. Send welcome email
  ↓
User sees dashboard (may not have phone yet)
```

**Problems**:
- ❌ User reaches dashboard before Vapi provisioning completes
- ❌ No UI feedback about provisioning status
- ❌ If Vapi fails, user has Stripe subscription but no phone/assistant
- ❌ Duplicate Stripe customer creation in provision-resources

#### /sales Staff Signup Flow

```
Sales rep fills form (SalesSignupForm.tsx)
  ↓
Stripe.createPaymentMethod()
  ↓
supabase.functions.invoke('create-sales-account')
  ↓
  [Edge Function: create-sales-account]
  1. Validate input
  2. Create Stripe customer
  3. Create Stripe subscription (NO TRIAL, immediately active)
  4. Create auth user
  5. Wait for DB trigger to create account/profile (1s delay)
  6. If trigger fails, manually create account
  7. Update account with Stripe IDs
  8. Set subscription_status='active' (overrides trigger's 'trial')
  9. Handle referral code
  10. Queue provisioning (but don't wait)
  11. Return success
  ↓
Show success modal with temp password
  ↓
  [Background: provisioning supposedly runs]
  (No actual provisioning trigger found)
  ↓
Sales rep manually shares credentials with customer
```

**Problems**:
- ❌ Relies on database trigger which can fail
- ❌ Manual account creation as fallback adds complexity
- ❌ No actual provisioning happens (provision-resources not called)
- ❌ Returns success even though Vapi not set up
- ❌ Customer gets credentials before phone number exists
- ❌ Sales rep has no way to verify setup completed

---

### Comparison: Homepage vs /sales

| Step | Homepage (free-trial-signup) | /sales (create-sales-account) |
|------|------------------------------|-------------------------------|
| **1. Auth user** | ✅ Creates directly | ✅ Creates directly |
| **2. Account** | ✅ Creates directly | ⚠️ Relies on trigger + fallback |
| **3. Profile** | ✅ Creates directly | ⚠️ Relies on trigger + fallback |
| **4. Stripe customer** | ✅ Creates once | ✅ Creates once |
| **5. Stripe subscription** | ✅ 3-day trial | ✅ Active immediately |
| **6. Trial dates** | ✅ Set correctly | ❌ Set by trigger, then cleared |
| **7. Vapi assistant** | ⚠️ Async (may fail) | ❌ Queued but never runs |
| **8. Vapi phone** | ⚠️ Async (may fail) | ❌ Queued but never runs |
| **9. subscription_status** | ✅ 'trial' | ✅ 'active' |
| **10. source tracking** | ✅ 'website' | ✅ 'sales' |

---

## PHASE 2: Current Behavior Analysis

### Homepage Trial Signup - Actual Step-by-Step

#### What Happens Now:

1. **User interaction**:
   - User fills 4-step form in `TrialSignupFlow.tsx`
   - Step 1: Name, email, phone
   - Step 2: Company name, website, trade
   - Step 3: Select plan (starter/professional/premium)
   - Step 4: Enter payment card, accept terms

2. **Payment processing**:
   - Stripe Elements creates payment method
   - Payment method ID returned to frontend

3. **Edge function call** (`free-trial-signup`):
   ```
   POST /functions/v1/free-trial-signup
   Body: {
     name, email, phone, areaCode,
     companyName, companyWebsite, trade,
     planType, paymentMethodId,
     source: 'website',
     deviceFingerprint, referralCode
   }
   ```

4. **Validation & anti-abuse**:
   - ✅ Validates phone number format
   - ✅ Blocks disposable email domains
   - ✅ Checks IP rate limit (3 trials per 30 days)
   - ✅ Checks phone number reuse (30 days)
   - ✅ Logs failed attempts

5. **Stripe setup**:
   - ✅ Creates Stripe customer with metadata
   - ✅ Creates payment method and sets as default
   - ✅ Creates subscription with 3-day trial
   - ✅ Status: 'trialing'

6. **Database records**:
   - ✅ Creates auth user (email auto-confirmed)
   - ✅ Creates account record:
     - `subscription_status = 'trial'`
     - `trial_start_date = now()`
     - `trial_end_date = now() + 3 days`
     - `stripe_customer_id, stripe_subscription_id`
     - `plan_type, source = 'website'`
   - ✅ Creates profile record (is_primary=true)
   - ✅ Creates user_roles record (role='owner')

7. **Async provisioning trigger**:
   - ⚠️ Invokes `provision-resources` in background
   - ⚠️ DOES NOT WAIT for completion
   - ⚠️ No error handling if provisioning fails

8. **Response to frontend**:
   ```json
   {
     "ok": true,
     "user_id": "...",
     "account_id": "...",
     "email": "...",
     "password": "...",
     "stripe_customer_id": "...",
     "subscription_id": "...",
     "trial_end_date": "...",
     "plan_type": "...",
     "message": "Trial started! No charge for 3 days."
   }
   ```

9. **Frontend actions**:
   - ✅ Auto-login user with returned password
   - ✅ Redirects to `/dashboard` after 2 seconds
   - ⚠️ User lands on dashboard BEFORE Vapi phone is ready

10. **Background provisioning** (`provision-resources`):
    - Sets `provisioning_status = 'provisioning'`
    - Calls Vapi API to create phone number
    - Calls Vapi API to create assistant
    - Links phone to assistant
    - ⚠️ **Creates duplicate Stripe customer** (bug!)
    - Inserts `phone_numbers` record
    - Inserts `assistants` record
    - Updates account with Vapi IDs
    - Sends welcome email with forwarding instructions
    - ⚠️ If any step fails, user is not notified

#### Gaps vs Target Happy Path:

| Target Step | Current Status | Issue |
|-------------|----------------|-------|
| 1. Create auth user | ✅ Complete | None |
| 2. Create account | ✅ Complete | None |
| 3. Create profile | ✅ Complete | None |
| 4. Create Stripe customer | ✅ Complete | Duplicate created later in provisioning |
| 5. Create Stripe subscription | ✅ Complete | None |
| 6. Create Vapi assistant | ⚠️ Async, no confirmation | May fail silently |
| 7. Provision Vapi phone | ⚠️ Async, no confirmation | May fail silently |
| 8. Start trial | ✅ Complete | None |
| 9. Persist data | ✅ Complete | Phone/assistant data missing if provisioning fails |
| 10. Return success | ⚠️ Premature | Returns before provisioning completes |

**Critical Issues**:
1. **Partial provisioning**: User gets Stripe subscription but may not get Vapi phone/assistant
2. **No feedback**: Frontend has no way to know if provisioning succeeded
3. **Silent failures**: If Vapi API fails, user is never notified
4. **Duplicate Stripe customer**: Created twice (once in signup, once in provisioning)

---

### /sales Staff Signup - Actual Step-by-Step

#### What Happens Now:

1. **Sales rep interaction**:
   - Sales rep fills single-page form in `SalesSignupForm.tsx`
   - All customer info, business details, plan selection, payment in one form
   - Sales rep name auto-filled from logged-in user

2. **Payment processing**:
   - Stripe Elements creates payment method
   - Payment method ID returned to frontend

3. **Edge function call** (`create-sales-account`):
   ```
   POST /functions/v1/create-sales-account
   Body: {
     customerInfo: {
       name, email, phone,
       companyName, website, trade, serviceArea,
       businessHours, emergencyPolicy,
       salesRepName, planType, zipCode,
       assistantGender, referralCode
     },
     paymentMethodId
   }
   ```

4. **Stripe setup**:
   - ✅ Creates Stripe customer with metadata
   - ✅ Attaches payment method and sets as default
   - ✅ **Creates subscription with NO TRIAL** (immediately active)
   - ✅ Validates subscription is 'active' or throws error

5. **Auth user creation**:
   - ✅ Generates secure random password (16 chars)
   - ✅ Creates auth user with email_confirm=true
   - ✅ Stores extensive metadata in user_metadata

6. **Database trigger dependency**:
   - ⚠️ **Waits 1 second** for `handle_new_user_signup()` trigger
   - ⚠️ Trigger should create account and profile automatically
   - ⚠️ Checks if profile.account_id exists

7. **Fallback account creation** (if trigger fails):
   - ⚠️ Manually creates account with all fields
   - ⚠️ Updates profile with account_id
   - ⚠️ Creates account_members entry
   - ⚠️ Complexity: Two code paths for same outcome

8. **Account update** (sales-specific fields):
   - ✅ Updates account with:
     - `stripe_customer_id, stripe_subscription_id`
     - `sales_rep_name, service_area`
     - `business_hours, emergency_policy`
     - `plan_type, subscription_status='active'`
     - `trial_start_date=null, trial_end_date=null`
     - `phone_number_area_code, billing_state`

9. **Referral tracking**:
   - ✅ Looks up referral code
   - ✅ Creates referral record if found
   - ✅ Sets status='converted' immediately
   - ✅ Non-blocking (errors don't fail signup)

10. **Provisioning attempt**:
    - ⚠️ Logs "Queueing async provisioning"
    - ⚠️ **Does NOT actually call provision-resources**
    - ⚠️ Account left with `provisioning_status='pending'`
    - ⚠️ No background job scheduled

11. **Response to frontend**:
    ```json
    {
      "success": true,
      "userId": "...",
      "accountId": "...",
      "planType": "...",
      "stripeCustomerId": "...",
      "subscriptionId": "...",
      "tempPassword": "...",
      "subscriptionStatus": "active",
      "ringSnapNumber": null,
      "vapiAssistantId": null,
      "provisioned": false,
      "provisioningMessage": "Phone number provisioning is in progress..."
    }
    ```

12. **Frontend actions**:
    - ✅ Shows success modal with customer credentials
    - ✅ Sales rep can copy temp password
    - ⚠️ Modal claims "provisioning in progress" but it's not actually running
    - ✅ Form resets for next customer

13. **What actually happens after**:
    - ❌ **NO PROVISIONING HAPPENS**
    - ❌ Customer has active Stripe subscription but no phone number
    - ❌ Customer has no Vapi assistant
    - ❌ No welcome email sent
    - ❌ Account stuck in `provisioning_status='pending'` forever

#### Gaps vs Target Happy Path:

| Target Step | Current Status | Issue |
|-------------|----------------|-------|
| 1. Create auth user | ✅ Complete | None |
| 2. Create account | ⚠️ Via trigger + fallback | Unreliable, complex |
| 3. Create profile | ⚠️ Via trigger + fallback | Unreliable, complex |
| 4. Create Stripe customer | ✅ Complete | None |
| 5. Create Stripe subscription | ✅ Complete (active, no trial) | None |
| 6. Create Vapi assistant | ❌ NOT DONE | **Critical gap** |
| 7. Provision Vapi phone | ❌ NOT DONE | **Critical gap** |
| 8. Start trial | ✅ Skipped (paid account) | Correct behavior |
| 9. Persist data | ⚠️ Incomplete | Phone/assistant data missing |
| 10. Return success | ❌ False positive | Claims provisioning when it's not |

**Critical Issues**:
1. **NO VAPI PROVISIONING**: Sales accounts never get phone numbers or assistants
2. **False success response**: Tells sales rep provisioning is in progress, but it never runs
3. **Trigger dependency**: Relies on database trigger with complex fallback logic
4. **Customer impact**: Sales customers pay immediately but get incomplete service
5. **No notification**: No way for sales rep or customer to know setup failed

---

### Comparison: What Should Happen vs What Actually Happens

#### Target Happy Path (from user requirements):
```
1. ✅ Create Supabase auth user
2. ✅ Create account or organization record
3. ✅ Create primary profile or user for that account
4. ✅ Create Stripe customer
5. ✅ Create Stripe subscription on correct plan (trial for homepage, active for sales)
6. ❌ Create Vapi assistant for this account (async, may fail for homepage; missing for sales)
7. ❌ Provision Vapi phone number (async, may fail for homepage; missing for sales)
8. ✅ Start free trial in database (trial_start, trial_end for homepage; skipped for sales)
9. ⚠️ Persist all data with proper relationships (incomplete if provisioning fails)
10. ❌ Return clear success and route to correct experience (premature for homepage, false for sales)
```

#### Actual Behavior Summary:

**Homepage (`free-trial-signup`)**:
- ✅ Steps 1-5: Perfect
- ⚠️ Steps 6-7: Async, no confirmation, may fail silently
- ✅ Step 8: Perfect
- ⚠️ Step 9: Incomplete if provisioning fails
- ⚠️ Step 10: Returns success before provisioning completes

**Sales (`create-sales-account`)**:
- ✅ Steps 1-5: Perfect
- ❌ Steps 6-7: **NOT IMPLEMENTED AT ALL**
- ✅ Step 8: Correctly skipped (paid account)
- ❌ Step 9: Phone and assistant data never created
- ❌ Step 10: Returns false success, customer has incomplete service

---

## PHASE 3: Target Architecture & Corrected Happy Path

### Design Principles

1. **Single Source of Truth**: One edge function handles both homepage and sales signups
2. **Synchronous Provisioning**: Core provisioning happens before response (Vapi can still be async with proper job queue)
3. **Explicit Error Handling**: Clear errors returned to frontend with rollback
4. **Idempotency**: Can safely retry without creating duplicates
5. **Proper State Tracking**: Account reflects true provisioning status
6. **No Silent Failures**: If provisioning fails, user/sales rep is notified

### Recommended Approach: Use `create-trial` as Canonical Function

The `create-trial` edge function already exists and is better architected than the two current functions. It should become the single entry point for both homepage and sales signups.

#### Why `create-trial` is Better:
- ✅ Comprehensive Zod validation
- ✅ Supports both 'website' and 'sales' sources
- ✅ Creates all database records directly (no trigger dependency)
- ✅ Proper trial vs active subscription handling
- ✅ Creates provisioning job record
- ✅ Structured logging with correlation IDs

### Corrected Happy Path Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND SIGNUP FORMS                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  TrialSignupFlow.tsx          SalesSignupForm.tsx             │
│  (Homepage)                     (/sales)                       │
│         │                              │                       │
│         └──────────────┬───────────────┘                       │
│                        │                                       │
│                        ▼                                       │
│              Stripe.createPaymentMethod()                      │
│                        │                                       │
│                        ▼                                       │
│        supabase.functions.invoke('create-trial')               │
│                        │                                       │
└────────────────────────┼───────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│           EDGE FUNCTION: create-trial (Enhanced)                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Validate input (Zod schema)                                │
│     • name, email, phone, companyName, trade, zipCode          │
│     • planType, paymentMethodId, source                        │
│     • Optional: website, businessHours, emergencyPolicy         │
│                                                                 │
│  2. Anti-abuse checks (if source='website')                    │
│     • Disposable email check                                   │
│     • IP rate limiting (3 per 30 days)                         │
│     • Phone reuse check (30 days)                              │
│                                                                 │
│  3. Create Stripe customer                                     │
│     • metadata: company_name, trade, source, sales_rep          │
│                                                                 │
│  4. Attach payment method                                      │
│     • Set as default payment method                            │
│                                                                 │
│  5. Create Stripe subscription                                 │
│     • If source='website': trial_period_days=3                 │
│     • If source='sales': no trial (immediately active)         │
│     • metadata: source, sales_rep, plan_type                   │
│                                                                 │
│  6. Create Supabase auth user                                  │
│     • email_confirm: true (skip email verification)            │
│     • password: auto-generated secure password                 │
│     • user_metadata: all customer/business info                │
│                                                                 │
│  7. Create account record                                      │
│     • All business details                                     │
│     • Stripe IDs (customer_id, subscription_id)                │
│     • Trial dates (if source='website')                        │
│     • subscription_status: 'trial' or 'active'                 │
│     • provisioning_status: 'queued'                            │
│     • source, sales_rep_name                                   │
│                                                                 │
│  8. Create profile record                                      │
│     • Links to auth user and account                           │
│     • is_primary: true                                         │
│     • source tracking                                          │
│                                                                 │
│  9. Assign owner role                                          │
│     • Insert into user_roles (role='owner')                    │
│                                                                 │
│  10. Create provisioning job                                   │
│      • status: 'queued'                                        │
│      • job_type: 'provision_phone'                             │
│      • attempts: 0                                             │
│                                                                 │
│  11. Trigger async provisioning (NEW: with better handling)    │
│      • Use EdgeRuntime.waitUntil for proper async              │
│      • OR: Invoke provision-resources and wait briefly          │
│      • Update provisioning job status                          │
│                                                                 │
│  12. Return success response                                   │
│      • Include: user_id, account_id, password, Stripe IDs      │
│      • Include: provisioning_status, message                   │
│      • For website: password for auto-login                    │
│      • For sales: temp password for sales rep                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│        ASYNC: provision-resources (Fixed & Enhanced)            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Update provisioning job: status='in_progress'              │
│                                                                 │
│  2. Update account: provisioning_status='provisioning'         │
│                                                                 │
│  3. Create Vapi phone number                                   │
│     • provider: 'vapi'                                         │
│     • numberDesiredAreaCode: from zipCode                      │
│     • fallbackDestination: customer phone                      │
│     • ON ERROR: Log, set provisioning_status='failed'          │
│                                                                 │
│  4. Create Vapi assistant                                      │
│     • Build company-specific prompt                            │
│     • Voice: based on assistantGender                          │
│     • Model: gpt-4o-mini                                       │
│     • ON ERROR: Delete phone, set status='failed'              │
│                                                                 │
│  5. Link phone to assistant                                    │
│     • PATCH phone number with assistantId                      │
│     • ON ERROR: Clean up, set status='failed'                  │
│                                                                 │
│  6. Insert phone_numbers record                                │
│     • account_id, phone_number, vapi_phone_id                  │
│     • is_primary: true, status: 'active'                       │
│                                                                 │
│  7. Insert assistants record                                   │
│     • account_id, phone_number_id, vapi_assistant_id           │
│     • is_primary: true, status: 'active'                       │
│                                                                 │
│  8. Generate and save referral code                            │
│     • Insert into referral_codes table                         │
│                                                                 │
│  9. Update account with Vapi IDs                               │
│     • vapi_phone_number, vapi_assistant_id                     │
│     • provisioning_status: 'completed'                         │
│     • phone_number_status: 'active'                            │
│     • onboarding_completed: true                               │
│                                                                 │
│  10. Update provisioning job: status='completed'               │
│                                                                 │
│  11. Send onboarding SMS (non-blocking)                        │
│      • Customer phone with RingSnap number                     │
│      • Forwarding instructions                                 │
│                                                                 │
│  12. Send welcome email (non-blocking)                         │
│      • Setup complete email                                    │
│      • Forwarding instructions                                 │
│                                                                 │
│  ERROR HANDLING:                                               │
│   • Catch any error during provisioning                        │
│   • Update provisioning_status='failed'                        │
│   • Save error message to provisioning_error                   │
│   • Update provisioning job: status='failed', attempts++       │
│   • Send alert email to support team                           │
│   • DO NOT roll back Stripe subscription                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND RESPONSE HANDLING                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Homepage (TrialSignupFlow.tsx):                               │
│    • Auto-login with returned password                         │
│    • Show success toast                                        │
│    • Redirect to /dashboard                                    │
│    • Dashboard polls provisioning_status                       │
│    • Show "Setting up your phone..." if status='provisioning'  │
│    • Show success message when status='completed'              │
│    • Show error + support contact if status='failed'           │
│                                                                 │
│  Sales Form (SalesSignupForm.tsx):                             │
│    • Show success modal with customer credentials              │
│    • Display: email, temp password, account ID                 │
│    • Show provisioning status message                          │
│    • Allow copy to clipboard                                   │
│    • Sales rep shares credentials with customer                │
│    • Optionally: Send credentials via email to customer        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Required Frontend Form Changes

#### 1. TrialSignupFlow.tsx
- ✅ Already calls correct fields
- ✅ Already auto-logs in
- ✅ Already redirects to dashboard
- ⚠️ **CHANGE**: Call `create-trial` instead of `free-trial-signup`
- ⚠️ **CHANGE**: Adjust field names to match create-trial schema (minor)

#### 2. SalesSignupForm.tsx
- ✅ Already has all required fields
- ❌ **CHANGE**: Call `create-trial` instead of `create-sales-account`
- ❌ **CHANGE**: Add `source: 'sales'` to request body
- ⚠️ **CHANGE**: Adjust field names to match create-trial schema
- ⚠️ **CHANGE**: Handle provisioning status in success modal

### Required Backend Changes

#### 1. Deprecate old functions
- ❌ Mark `free-trial-signup` as deprecated (keep for rollback)
- ❌ Mark `create-sales-account` as deprecated (keep for rollback)

#### 2. Enhance `create-trial`
- ✅ Already has most logic
- ⚠️ **FIX**: Ensure proper source-based subscription logic
- ⚠️ **FIX**: Better async provisioning trigger
- ⚠️ **ADD**: Correlation ID to all logs

#### 3. Fix `provision-resources`
- ❌ **REMOVE**: Duplicate Stripe customer creation (line 223-252)
- ✅ **KEEP**: All Vapi phone and assistant logic
- ⚠️ **ADD**: Comprehensive error handling with rollback
- ⚠️ **ADD**: Update provisioning_jobs table
- ⚠️ **ADD**: Send alert email if provisioning fails

#### 4. Add monitoring/retry
- ❌ **ADD**: Cron job to retry failed provisioning jobs
- ❌ **ADD**: Admin dashboard view for failed provisionings
- ❌ **ADD**: Support notification for failed provisionings

### Database Schema Changes

**No major schema changes required!** All necessary columns already exist:
- ✅ `accounts.stripe_customer_id`
- ✅ `accounts.stripe_subscription_id`
- ✅ `accounts.vapi_assistant_id`
- ✅ `accounts.vapi_phone_number`
- ✅ `accounts.provisioning_status`
- ✅ `accounts.provisioning_error`
- ✅ `accounts.source`
- ✅ `accounts.sales_rep_name`
- ✅ `provisioning_jobs` table exists

**Minor enhancements** (optional):
```sql
-- Add index for faster provisioning status queries
CREATE INDEX IF NOT EXISTS idx_accounts_provisioning_status
  ON accounts(provisioning_status, created_at)
  WHERE provisioning_status IN ('queued', 'provisioning', 'failed');

-- Add updated_at trigger for provisioning_jobs
CREATE TRIGGER update_provisioning_jobs_updated_at
  BEFORE UPDATE ON provisioning_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Error Handling Strategy

#### Stripe Failures
- **When**: Payment method invalid, subscription creation fails
- **Action**: Return error to frontend immediately
- **Rollback**: Auth user NOT created (fail early)
- **User sees**: Clear error message, can retry

#### Vapi Phone Failures
- **When**: No available numbers in area code, API error
- **Action**: Mark provisioning_status='failed', save error
- **Rollback**: Do NOT delete Stripe subscription
- **User sees**: Dashboard shows "Setup failed, support notified"
- **Support**: Receives alert, manually provisions or refunds

#### Vapi Assistant Failures
- **When**: API error, invalid configuration
- **Action**: Delete provisioned phone, mark provisioning_status='failed'
- **Rollback**: Cleanup phone number
- **User sees**: Dashboard shows "Setup failed, support notified"
- **Support**: Receives alert, manually provisions or refunds

#### Database Failures
- **When**: Unique constraint violation, foreign key error
- **Action**: Return error, do NOT create Stripe subscription
- **Rollback**: Transaction rollback (if possible)
- **User sees**: "Something went wrong, please try again"

### Data Flow Diagram

```
┌──────────┐
│  STRIPE  │───┐
└──────────┘   │
               │ subscription_id
               │ customer_id
               ▼
         ┌──────────┐       ┌───────────┐
         │ accounts │◄──────│  profiles │
         └──────────┘       └───────────┘
               │                   ▲
               │ account_id        │ user_id
               ▼                   │
      ┌────────────────┐    ┌───────────┐
      │ phone_numbers  │    │ auth.users│
      └────────────────┘    └───────────┘
               │
               │ phone_number_id
               ▼
        ┌────────────┐
        │ assistants │
        └────────────┘
               │
               │ vapi_assistant_id
               ▼
        ┌──────────┐
        │   VAPI   │
        └──────────┘
```

### Success Criteria for Corrected Flow

✅ **Both forms call same backend function**
✅ **Stripe customer created exactly once**
✅ **Stripe subscription created with correct trial settings**
✅ **All database records created before response**
✅ **Vapi phone number provisioned (async but tracked)**
✅ **Vapi assistant created and linked to phone**
✅ **Provisioning status accurately reflects state**
✅ **Failed provisioning triggers support alert**
✅ **User dashboard shows provisioning progress**
✅ **Sales rep gets accurate status in success modal**
✅ **No silent failures**
✅ **Idempotent: Can safely retry**

---

*End of Phase 3*

---

## NEXT: Phase 4 & 5 Implementation

Phase 4 will involve the actual code changes, and Phase 5 will add tests and verification checklists.
