# RingSnap Codebase State Audit Report

**Date**: 2025-12-01
**Auditor**: Senior Staff Engineer & Observability Lead
**Branch**: `claude/audit-codebase-state-0191kr7cWoPTYSnyhVUv3Qdz`
**Commit**: e7c6bdd

---

## Executive Summary

**Key Findings**:
- ✅ **Signup/create-trial flow** is fully implemented with async provisioning, idempotency, and compensation logic
- ⚠️ **Vapi call → lead capture pipeline** is **NOT IMPLEMENTED** - calls are logged but NO leads are created
- ⚠️ **Booking flow (Phase 1)** is **PARTIALLY IMPLEMENTED** - appointments table exists, booking-schedule function exists but SMS sending is stubbed (TODO comments)
- ✅ **Dashboard** is functional for sales team accounts tracking
- ⚠️ **Environment config** has inconsistencies between VITE_SUPABASE_PUBLISHABLE_KEY vs VITE_SUPABASE_ANON_KEY
- 📋 **Product docs** (HAPPY_STATE_MVP.md, ROADMAP_MVP.yaml) **DO NOT EXIST** - only AGENTS.md exists

**Production Health**:
- Recent fixes focused on Stripe integration, Vapi provisioning fallback, and signup flow stability
- Multiple documented failure patterns around environment variables and edge function deployments

---

## Key Directories & Files Inspected

```
/home/user/ringsnap/
├── AGENTS.md                              # Agent architecture (EXISTS)
├── HAPPY_STATE_MVP.md                     # NOT FOUND
├── ROADMAP_MVP.yaml                       # NOT FOUND
├── supabase/
│   ├── functions/
│   │   ├── create-trial/                  # Main signup function (ACTIVE)
│   │   ├── provision-vapi/                # Async Vapi provisioning worker (ACTIVE)
│   │   ├── authorize-call/                # Vapi pre-call auth webhook (ACTIVE)
│   │   ├── sync-usage/                    # Vapi post-call webhook (ACTIVE - NO LEAD CAPTURE)
│   │   ├── booking-schedule/              # Appointment booking handler (PARTIAL - SMS STUBBED)
│   │   └── [42 other functions]
│   └── migrations/                        # 38 migration files
├── src/
│   ├── pages/
│   │   ├── Dashboard.tsx                  # Sales dashboard (ACTIVE)
│   │   ├── Onboarding.tsx                 # New hybrid onboarding (ACTIVE)
│   │   └── [20 other pages]
│   └── components/
│       └── signup/
│           └── TrialSignupFlow.tsx        # Multi-step signup form (ACTIVE)
└── docs/                                  # Implementation docs and fix summaries
```

---

## 1. Signup & create-trial – Current State

### Where Implemented

**Frontend**:
- `src/components/signup/TrialSignupFlow.tsx` - Main 4-step signup flow
- `src/pages/Sales.tsx` - Sales-guided signup variant

**Backend**:
- `supabase/functions/create-trial/index.ts` (1171 lines) - Primary signup function

### Current Payload & Flow

**Frontend sends** (from TrialSignupFlow.tsx:200-280):
```typescript
{
  // User info
  name: string,
  email: string,
  phone: string,

  // Business info
  companyName: string,
  trade: string,
  companyWebsite?: string,
  serviceArea?: string,
  zipCode?: string,          // 5 digits

  // Config
  assistantGender: "male" | "female",
  primaryGoal?: "book_appointments" | "capture_leads" | "answer_questions" | "take_orders",
  wantsAdvancedVoice?: boolean,

  // Plan & payment
  planType: "starter" | "professional" | "premium",
  paymentMethodId: string,   // Stripe payment method

  // Tracking
  source: "website" | "sales",
  salesRepName?: string,
  leadId?: string,           // Links to signup_leads table
  referralCode?: string,
  deviceFingerprint?: string
}
```

**create-trial flow** (supabase/functions/create-trial/index.ts):

1. ✅ **Idempotency check** (lines 276-319) - Returns cached response if duplicate
2. ✅ **Input validation** (lines 322-371) - Zod schema validation
3. ✅ **Anti-abuse checks** (lines 416-510) - IP rate limiting, phone reuse detection (website only)
4. ✅ **Stripe customer creation** (lines 512-553) - With idempotency key
5. ✅ **Stripe payment method attach** (lines 555-584)
6. ✅ **Stripe subscription creation** (lines 586-628) - 3-day trial period
7. ✅ **Atomic account creation** (lines 630-843) - Via `create_account_transaction` RPC
   - Creates auth user
   - Creates account record
   - Creates profile record
   - Creates user_roles record
   - All in single transaction
8. ✅ **Lead linking** (lines 845-908) - If leadId provided, updates signup_leads table
9. ✅ **Async provisioning job** (lines 963-1050) - Enqueues job for provision-vapi worker
10. ✅ **Idempotency cache** (lines 1093-1123) - Stores response in idempotency_results table

### What Works Reliably

✅ **Fully wired and functional**:
- Complete signup flow from form to account creation
- Stripe integration with compensation logic (if account creation fails, Stripe resources are cleaned up)
- Idempotency handling for duplicate requests
- Anti-abuse rate limiting
- Async Vapi provisioning with retry logic
- Lead capture in step 1 (signup_leads table) - **HOWEVER**: Direct client-side inserts are currently DISABLED (lines 161-165) per "go-green" deployment strategy

### What Fails Often (from logs/docs)

❌ **Common failure modes** (from URGENT_TROUBLESHOOTING.md):

1. **Missing/invalid Stripe environment variables** (~90% of failures)
   - `STRIPE_SECRET_KEY` not set or invalid
   - `STRIPE_PRICE_STARTER/PROFESSIONAL/PREMIUM` not configured
   - **Impact**: Signup fails after auth user created but before Stripe customer created → orphaned auth users

2. **RLS policy blocking service role** (~3% of failures)
   - Edge function can't insert into profiles/accounts tables
   - **Impact**: Account creation fails after successful Stripe setup → requires compensation cleanup

3. **Vapi provisioning failures** (from SIGNUP_FIX_SUMMARY.md)
   - Area code unavailable
   - **Impact**: Provisioning job retries with exponential backoff (max 5 attempts)
   - **Mitigation**: Fallback logic now implemented to provision without area code constraint

4. **Edge function not deployed** (~2% of failures)
   - Changes made but deployment didn't complete
   - **Impact**: Old code continues running

### Implemented but Not Fully Wired

⚠️ **Lead capture in signup step 1**:
- **Location**: TrialSignupFlow.tsx:146-193
- **Status**: Code exists but is **DISABLED** (lines 161-165):
  ```typescript
  // TEMPORARY FIX (go-green): Disable direct client-side inserts
  // All writes MUST flow through edge functions only until backend is green
  console.warn("[go-green] Direct insert to signup_leads disabled. Backend writes only.");
  const lead = null;
  ```
- **Intent**: Capture email/name/phone in step 1 before payment
- **Current state**: Feature is stubbed, no leads captured from frontend

---

## 2. Vapi Call → Lead Capture Pipeline – Current State

### Vapi Webhook Handlers

**File paths**:
- `supabase/functions/authorize-call/index.ts` - Pre-call authorization webhook
- `supabase/functions/sync-usage/index.ts` - **Post-call webhook** (THIS IS THE KEY ONE)

### How Calls Are Stored

**Table**: `usage_logs` (migration: 20251105174239_fb4f01dc-6d03-40b7-adc7-2362ac2b4923.sql:29-38)

```sql
CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id),
  call_id TEXT,
  call_duration_seconds INTEGER,
  call_cost_cents INTEGER,
  call_type TEXT,
  customer_phone TEXT,
  created_at TIMESTAMPTZ,
  metadata JSONB
);
```

**What happens in sync-usage** (supabase/functions/sync-usage/index.ts:27-104):
1. Receives Vapi post-call webhook payload
2. Extracts call duration, cost, metadata
3. Updates account usage counters (monthly_minutes_used or overage_minutes_used)
4. **Inserts into usage_logs table** (lines 96-104)
5. Sends usage warning emails if thresholds exceeded (80%, 95%, 100%)

### How Leads Are Created

**⚠️ CRITICAL FINDING: LEADS ARE NOT CREATED FROM CALLS**

- The `sync-usage` webhook **ONLY** logs call metadata
- There is **NO CODE** that creates customer leads from call data
- No extraction of:
  - Customer name
  - Customer phone
  - Job type/description
  - Appointment requests
  - Lead intent

**Expected tables for lead capture** (from schema review):
- `signup_leads` exists - but ONLY for signup form step 1 lead capture
- **NO `customer_leads` or `call_leads` table exists**

### Appointment/Booking Intent

**Partial implementation found**:
- `supabase/functions/booking-schedule/index.ts` exists
- Creates records in `appointments` table (migration: 20251125000001_hybrid_onboarding_schema.sql:61-101)
- **BUT**: This function must be called explicitly by Vapi assistant or other system
- **Status**: Function exists but **NOT WIRED** to sync-usage webhook

### From Logs: Recurring Errors

[Unverified - no access to production logs]

Based on code review, potential failure modes:
- Vapi webhook fails silently if account_id not in customData
- No retry mechanism for failed usage log inserts
- Email sending is stubbed (lines 189-220) - TODO comments

---

## 3. Booking Flow (Phase 1 / No Calendar) – Current State

### pending_appointments vs appointments

**Table found**: `appointments` (NOT `pending_appointments`)

**Location**: supabase/migrations/20251125000001_hybrid_onboarding_schema.sql:61-101

```sql
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY,
  account_id UUID REFERENCES accounts(id),

  -- Customer info
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,

  -- Appointment details
  job_type TEXT,
  job_description TEXT,
  preferred_time_range TEXT,
  confirmed_time TIMESTAMPTZ,

  -- Status tracking
  status TEXT DEFAULT 'pending_confirmation' CHECK (status IN (
    'pending_confirmation',
    'confirmed',
    'rescheduled',
    'cancelled',
    'completed'
  )),

  booking_source TEXT DEFAULT 'phone_call' CHECK (booking_source IN (
    'phone_call', 'sms', 'web_form', 'calendar_direct'
  )),

  internal_notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### Booking Flow Implementation

**Edge function**: `supabase/functions/booking-schedule/index.ts`

**Flow** (lines 59-313):
1. ✅ Validates input (account_id, customer_name, customer_phone, job_type, etc.)
2. ✅ Loads account booking preferences (booking_mode, destination_phone, calendar_external_link)
3. ✅ Creates appointment record in appointments table
4. ⚠️ **SMS notification logic EXISTS but is STUBBED**:

```typescript
// booking-schedule/index.ts:200-224
if (bookingMode === "sms_only") {
  const smsMessage = `New appointment request from ${data.customer_name}...`;

  // TODO: Integrate with SMS provider (Twilio, Vapi SMS, etc.)
  // For now, log the SMS that would be sent
  logInfo("SMS notification (mock)", { to: destinationPhone, message: smsMessage });

  // TODO: Uncomment when SMS provider is configured
  // await sendSMS(destinationPhone, smsMessage);
}
```

### Fully Wired vs "Almost Done"

**✅ Fully wired**:
- Appointments table with RLS policies
- booking-schedule edge function with input validation
- Account preferences (booking_mode, destination_phone, calendar_external_link)
- Response format and error handling

**⚠️ "Almost done" - not yet functional**:
- SMS sending is NOT implemented (lines 212-223, 256-273)
- No SMS provider integration (Twilio, Vapi SMS, etc.)
- Email notifications not implemented
- Dashboard UI to view appointments not found [Needs confirmation]

### What Exists vs What Is Implied

**Exists**:
- `appointments` table
- `booking-schedule` edge function
- Account booking preferences columns
- Helper function `is_within_service_hours` (hybrid_onboarding_schema.sql:199-233)

**Implied but not implemented**:
- SMS delivery mechanism
- Appointment dashboard view
- Appointment confirmation/reschedule flows
- Calendar integration (Phase 2 - explicitly noted as TODO)

---

## 4. Dashboard – Current State

### Dashboard Pages

**Primary dashboard**: `src/pages/Dashboard.tsx`

**Purpose**: Sales team dashboard for tracking accounts and MRR

**Data fetched** (Dashboard.tsx:65-87):
```typescript
const { data: salesAccounts } = useQuery({
  queryKey: ["sales_team_accounts", dateFilter],
  queryFn: async () => {
    let query = supabase
      .from("accounts")
      .select(
        "id, company_name, plan_type, subscription_status,
         sales_rep_name, created_at, trade,
         profiles!left(name, phone, is_primary)"
      )
      .in("subscription_status", ["trial", "active", "past_due"]);

    // Filters by date range
    if (threshold) query = query.gte("created_at", threshold);

    return query.order("created_at", { ascending: false });
  },
  enabled: isOwner,  // Only accessible to users with sales role
});
```

**Dashboard shows**:
- ✅ Total accounts
- ✅ Active accounts count
- ✅ Past due accounts count
- ✅ Total MRR calculation (based on plan_type)
- ✅ Filterable by date range (7, 30, 90 days, all)
- ✅ Filterable by sales rep
- ✅ CSV export functionality
- ✅ Account details table with contact info

**What dashboard does NOT show**:
- ❌ Calls count or list
- ❌ Leads (customer leads from calls)
- ❌ Appointments / pending appointments
- ❌ Usage metrics (minutes used)
- ❌ Vapi provisioning status

### Other Dashboards

**Found**:
- `src/pages/CustomerDashboard.tsx` - [Not fully reviewed]
- `src/pages/AdminMonitoring.tsx` - [Not fully reviewed]
- `src/pages/SetupStatus.tsx` - Shows provisioning progress [Not fully reviewed]

### TODOs / Stubbed Sections

**In Dashboard.tsx**:
- No obvious TODO comments
- Dashboard is functionally complete for its current scope (account/MRR tracking)

### Selectors/APIs Not Yet Used

**Database views that exist but may not be used** [Needs confirmation]:
- `account_service_hours` view (hybrid_onboarding_schema.sql:131-142)
- `provisioning_state_transitions` table
- `orphaned_stripe_resources` table (for admin diagnostics)

---

## 5. Environment & Config – Current State

### Supabase Configuration

**Frontend client** (src/lib/supabase.ts:14-23):
```typescript
export const supabaseUrl =
  env.VITE_SUPABASE_URL ??
  env.NEXT_PUBLIC_SUPABASE_URL;

export const supabaseKey =
  env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  env.VITE_SUPABASE_ANON_KEY ??
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
```

**Environment files**:

`.env.example`:
```bash
# Public web envs
VITE_STRIPE_PUBLISHABLE_KEY="pk_test_..."
VITE_SUPABASE_URL="https://your-project-ref.supabase.co"
VITE_SUPABASE_PROJECT_ID="your-project-ref"
VITE_SUPABASE_PUBLISHABLE_KEY="your-anon-key"  # ← New style

# Server-side provisioning envs (edge functions)
SUPABASE_URL="https://your-project-ref.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
VAPI_API_KEY="your-vapi-api-key"
VAPI_BASE_URL="https://api.vapi.ai"

# Email (Resend)
RESEND_PROD_KEY="re_..."
EMAIL_FROM="RingSnap <noreply@getringsnap.com>"
```

### Inconsistencies Identified

⚠️ **Key naming inconsistency**:
- `.env.example` shows `VITE_SUPABASE_PUBLISHABLE_KEY`
- Client code ALSO accepts legacy `VITE_SUPABASE_ANON_KEY`
- **Risk**: Developers may set wrong variable and app still works (fallback behavior masks misconfiguration)

⚠️ **Email configuration**:
- Two email key variables: `RESEND_PROD_KEY` (preferred) and `RESEND_API_KEY` (legacy fallback)
- Comment says legacy is "for backwards compatibility"
- **Risk**: Confusion about which to use in production

### Supabase URL/Key Locations

**Frontend**:
1. `.env.example` - Template
2. `src/lib/supabase.ts` - Client initialization
3. `src/integrations/supabase/client.ts` - Re-exports from lib/supabase.ts

**Backend (edge functions)**:
1. Edge function environment variables (set in Supabase dashboard)
2. Each function imports `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `Deno.env.get()`

**⚠️ No obvious URL mismatches found**, but configuration relies on correct dashboard setup.

### Stripe Configuration

**Frontend**: `VITE_STRIPE_PUBLISHABLE_KEY`

**Backend** (edge functions):
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_STARTER`
- `STRIPE_PRICE_PROFESSIONAL`
- `STRIPE_PRICE_PREMIUM`

**Common failure**: Missing price IDs (documented in URGENT_TROUBLESHOOTING.md)

### Vapi Configuration

**Backend only**:
- `VAPI_API_KEY`
- `VAPI_BASE_URL` (defaults to "https://api.vapi.ai")

**⚠️ Potential issue**: No kill switch documented in `.env.example`, but create-trial code checks:
```typescript
const disableVapiProvisioning = Deno.env.get("DISABLE_VAPI_PROVISIONING") === "true";
```

This is NOT in `.env.example` → developers may not know it exists.

---

## 6. Logs & Error Patterns

### Based on Documentation Review

**Top 5 Recurring Failure Types**:

#### 1. Signup / create-trial Failures

**a) Missing Stripe environment variables** (~90% of failures per URGENT_TROUBLESHOOTING.md)
- **Error**: `"Price ID not configured for plan: starter"` or Stripe API key errors
- **Root cause**: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_*` not set in edge function environment
- **Impact**: Signup fails after auth user created → orphaned users in auth.users table
- **Log pattern** [Inference]:
  ```
  [create-trial] phase=stripe_customer
  Error: Invalid API Key provided
  ```

**b) RLS policy blocking service role** (~3% per URGENT_TROUBLESHOOTING.md)
- **Error**: `"permission denied for table profiles"` or `"permission denied for table accounts"`
- **Root cause**: Missing RLS policy for service_role
- **Impact**: Account creation fails after Stripe setup → orphaned Stripe customers
- **Log pattern** [Inference]:
  ```
  [create-trial] phase=account_insert
  RPC_FAILED: 42501 | permission denied for table profiles
  ```

**c) Duplicate email** (documented in create-trial code)
- **Error**: Email already registered
- **Root cause**: User tries to sign up with existing email
- **Impact**: Signup fails, Stripe resources cleaned up (compensation logic works)
- **Log pattern** (create-trial/index.ts:773-791):
  ```
  Email already registered
  Canceling Stripe subscription due to account creation failure
  ```

#### 2. Vapi Callback Failures

**a) Missing account_id in customData** [Inference from code review]
- **Error**: sync-usage returns 400 "Account ID required"
- **Root cause**: Vapi webhook doesn't include accountId in customData
- **Impact**: Call not logged in usage_logs, usage not tracked
- **Log pattern** (sync-usage/index.ts:32-46):
  ```
  [sync-usage] Sync usage webhook received
  error: Account ID required
  ```

**b) Account not found during sync** [Inference]
- **Error**: sync-usage returns 404 "Account not found"
- **Root cause**: accountId in webhook doesn't match any account record
- **Impact**: Call not logged
- **Log pattern** (sync-usage/index.ts:50-65):
  ```
  [sync-usage] Account not found during sync usage
  accountId: <uuid>
  ```

**c) Usage log insert failure** [Inference]
- **Error**: Database insert fails
- **Root cause**: RLS policy, database connection issue, or constraint violation
- **Impact**: Call completes but not logged → usage tracking inaccurate
- **Log pattern**: [No explicit error handling for insert failure in sync-usage.ts:96-104]

#### 3. Dashboard Loading Failures

[Unverified - no production logs available]

**Potential failures** (from Dashboard.tsx code review):

**a) Authentication failure**
- **Error**: User not authenticated
- **Root cause**: Session expired or invalid
- **Impact**: Redirect to /auth/login (lines 32-34)

**b) Missing staff role**
- **Error**: User doesn't have sales/owner role
- **Root cause**: User is not in staff_roles table
- **Impact**: "Access Denied" message shown (lines 181-193)

**c) Query timeout or error** [Inference]
- **Error**: Supabase query fails or times out
- **Root cause**: Large dataset, slow query, or database issue
- **Impact**: Dashboard shows loading spinner indefinitely
- **Log pattern**: Console error from React Query

### Error Shapes

**Signup errors** (create-trial response):
```json
{
  "success": false,
  "request_id": "uuid",
  "phase": "stripe_customer",
  "message": "Invalid API Key provided"
}
```

**Vapi webhook errors** (sync-usage response):
```json
{
  "error": "Account ID required"
}
```

**Database RPC errors** (create-trial logs):
```json
{
  "code": "42501",
  "message": "permission denied for table profiles",
  "details": "...",
  "hint": "..."
}
```

---

## 7. Implemented but Not Live / Not Wired

### Features in Code but Not Connected

#### a) **Lead capture from signup step 1** (frontend)
- **Location**: src/components/signup/TrialSignupFlow.tsx:146-193
- **Status**: Code exists but **DISABLED** via go-green flag
- **Intent**: Capture email/name/phone before payment step
- **Why not live**: Temporary fix to avoid client-side database writes during deployment stabilization
- **To wire**: Remove lines 161-165, uncomment lines 167-170

#### b) **Customer leads from Vapi calls** (backend)
- **Location**: MISSING - no function exists
- **Status**: **NOT IMPLEMENTED**
- **Intent**: Extract lead information from Vapi call transcripts/metadata
- **Why not live**: Feature never built
- **To wire**: Create new edge function or extend sync-usage to:
  1. Parse Vapi call metadata for customer info
  2. Insert into new `customer_leads` table
  3. Link to appointments if booking intent detected

#### c) **SMS sending for appointment confirmations** (backend)
- **Location**: supabase/functions/booking-schedule/index.ts:212-223, 256-273
- **Status**: **STUBBED** (TODO comments)
- **Intent**: Send SMS to contractor when appointment request received
- **Why not live**: SMS provider integration not configured (Twilio, Vapi SMS, etc.)
- **To wire**:
  1. Choose SMS provider
  2. Add API key to environment variables
  3. Implement `sendSMS()` function
  4. Uncomment lines 223, 273

#### d) **Email warnings for usage thresholds** (backend)
- **Location**: supabase/functions/sync-usage/index.ts:189-220
- **Status**: **STUBBED** (TODO comments)
- **Intent**: Email users at 80%, 95%, 100% usage
- **Why not live**: Resend integration not implemented
- **To wire**: Implement email sending via Resend API (RESEND_PROD_KEY already in env config)

#### e) **Direct calendar booking** (Phase 2)
- **Location**: supabase/functions/booking-schedule/index.ts:236-286
- **Status**: **PLANNED** (explicit TODO comments, returns "coming soon" message)
- **Intent**: Integrate with Google/Microsoft/Apple calendars for direct booking
- **Why not live**: Phase 2 feature, not started
- **To wire**: Implement calendar API integration (Nylas, Cal.com, or native APIs)

#### f) **Helper functions/views not used in UI** [Needs confirmation]
- `is_within_service_hours()` function - created in schema, no references found in functions
- `account_service_hours` view - created in schema, unclear if used
- `provisioning_state_transitions` table - exists for debugging, may not have UI

### Unused Edge Functions [Needs confirmation]

**47 edge functions total**, several may be deprecated or unused:
- `free-trial-signup` - Appears to be superseded by `create-trial`
- `provision`, `provision-resources`, `provision-account` - Multiple provisioning functions suggest migration/refactor in progress
- `test-vapi-integration` - Test function (intentionally not user-facing)

---

## 8. Quick Recommendations

### Top 3 Most Impactful Fixes

#### 1. **Implement Lead Capture from Vapi Calls** [CRITICAL - MISSING CORE FEATURE]

**Why**: This is the core value proposition of RingSnap - capturing leads from incoming calls. Currently, calls are logged but NO leads are created.

**Impact**: HIGH - Without this, customers cannot see lead information from their calls.

**Files to touch**:
- `supabase/functions/sync-usage/index.ts` - Extend to create customer leads
- **Create new table**: `customer_leads` or extend `signup_leads` with call_id foreign key
- **Create new migration**: Add customer_leads table with fields:
  - account_id
  - call_id (foreign key to usage_logs)
  - customer_name
  - customer_phone
  - customer_email (if captured)
  - lead_source: 'phone_call'
  - intent: 'appointment' | 'quote' | 'question' | 'other'
  - status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost'
  - call_transcript or call_summary
- **Update sync-usage/index.ts**:
  - Parse Vapi webhook payload for customer information
  - Extract phone number, name (if available in transcript)
  - Create lead record in customer_leads table
  - Link to appointment if booking intent detected

**Estimated effort**: 1-2 days

---

#### 2. **Wire SMS Sending for Appointment Notifications** [HIGH PRIORITY]

**Why**: Booking function exists but does nothing - contractors won't receive appointment requests.

**Impact**: MEDIUM-HIGH - Phase 1 booking is unusable without SMS delivery.

**Files to touch**:
- `supabase/functions/booking-schedule/index.ts` - Lines 212-223, 256-273
- `supabase/functions/_shared/sms.ts` - Create new shared SMS utility
- Environment config - Add SMS provider credentials

**Steps**:
1. Choose SMS provider (recommendation: Twilio for reliability, or Vapi SMS for integration simplicity)
2. Add environment variables:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_PHONE_NUMBER`
3. Create `supabase/functions/_shared/sms.ts`:
   ```typescript
   export async function sendSMS(to: string, message: string): Promise<void> {
     // Twilio API call
   }
   ```
4. Uncomment lines 223, 273 in booking-schedule/index.ts
5. Test with real phone number

**Estimated effort**: 4-6 hours

---

#### 3. **Standardize Environment Variable Naming** [MEDIUM PRIORITY - REDUCES ERRORS]

**Why**: Inconsistent naming (PUBLISHABLE_KEY vs ANON_KEY, RESEND_PROD_KEY vs RESEND_API_KEY) causes confusion and misconfiguration.

**Impact**: MEDIUM - Reduces deployment errors and developer confusion.

**Files to touch**:
- `.env.example` - Update with single canonical name for each variable
- `src/lib/supabase.ts` - Simplify to one variable name (no fallbacks)
- Documentation - Update all deployment guides

**Steps**:
1. Choose canonical names:
   - `VITE_SUPABASE_ANON_KEY` (drop "PUBLISHABLE")
   - `RESEND_API_KEY` (drop "PROD" variant)
   - Add `DISABLE_VAPI_PROVISIONING` to `.env.example` (already used in code)
2. Update `.env.example` with clear comments
3. Update `src/lib/supabase.ts` to remove fallback chain (fail fast if wrong var)
4. Create deployment checklist document listing all required env vars
5. Add validation in edge functions to check for required env vars at startup

**Estimated effort**: 2-3 hours

---

## Additional Notes

### Missing Documentation

- `HAPPY_STATE_MVP.md` - NOT FOUND (you requested this for updating)
- `ROADMAP_MVP.yaml` - NOT FOUND (you requested this for updating)
- Product requirements are inferred from code and AGENTS.md only

### Recent Activity

Based on commit history and fix documents:
- Recent focus on Stripe integration stability
- Vapi provisioning area code fallback implemented
- Signup flow refactored for async provisioning
- "Go-green" deployment strategy in progress (disabling client-side DB writes)

### Strengths

✅ Well-structured agent architecture (AGENTS.md)
✅ Comprehensive error handling and logging in create-trial
✅ Idempotency and compensation logic for critical flows
✅ Extensive migration history shows careful schema evolution
✅ RLS policies implemented for security

### Weaknesses

❌ Core feature (lead capture from calls) not implemented
❌ SMS sending stubbed out across multiple functions
❌ Environment configuration inconsistencies
❌ Multiple similar functions suggest incomplete migration/cleanup
❌ Client-side lead capture disabled with no backend replacement

---

**End of Report**
