# Signup → Stripe → Supabase → Vapi Provisioning Fix - Complete Specification v2

**Date**: 2025-11-20
**Author**: Claude (claude-sonnet-4-5)
**Status**: APPROVED - Ready for Implementation
**Version**: 2.0 (incorporates user feedback)

---

## Executive Summary

This spec addresses the end-to-end cleanup of the RingSnap signup and provisioning flow to make it:
- **Idempotent**: Can retry safely without creating duplicates
- **Observable**: Full correlation ID tracking + structured logging
- **Predictable**: Well-defined state transitions
- **Fully Logged**: All operations tracked with context
- **Consistent**: Never leaves orphaned resources across Stripe/Supabase/Vapi
- **Unified**: Single canonical signup engine for all channels

---

## Design Decisions (User-Approved)

### 1. Unified Signup Engine

**Decision**: ONE canonical signup pipeline that handles ALL signup channels:
- **Public self-service** (website trial signup)
- **Sales-guided** (internal sales workspace)
- **Future enterprise** (same engine, different channel)

**Schema Changes**:
```typescript
// Replace free-text `source` with structured `signup_channel`
signup_channel: 'self_service' | 'sales_guided' | 'enterprise'

// Replace free-text `sales_rep_name` with FK to auth users
sales_rep_id: UUID | null  // FK to auth.users(id)
```

**Implementation**:
- Both frontend forms call the **same edge function** (`create-trial`)
- `signup_channel` differentiates the UX path
- `sales_rep_id` is derived from logged-in staff user session (not form input)

### 2. Vapi Provisioning Flag

**Decision**: Keep as environment variable

```bash
ENABLE_VAPI_PROVISIONING=true  # prod/staging
ENABLE_VAPI_PROVISIONING=false # local dev (optional)
```

**Behavior**:
- Default: `true` in production and staging
- Can be disabled in local dev for faster iteration
- Centralized check in edge function

### 3. Rollback Strategy

**Decision**: Option B - Cancel Stripe subscription/customer on failure

**Logic**:
```typescript
if (stripeSuccess && supabaseOrVapiFails) {
  try {
    await stripe.subscriptions.cancel(subscriptionId);
    await stripe.customers.del(customerId);
  } catch (cleanupError) {
    // If cancellation fails, log to orphaned_resources table
    await logOrphanedResource(customerId, subscriptionId, correlationId);
  }
}
```

**New table**: `orphaned_stripe_resources` (manual cleanup queue)

### 4. Customer Email Flow

**Decision**: Automate with Supabase Auth magic link

**Flow**:
1. After successful account creation, trigger password reset email
2. Customer receives "Complete Account Setup" email with secure link
3. Customer sets their own password via magic link
4. Sales rep does NOT see password (security best practice)

**Fallback**: Sales rep can trigger resend if customer doesn't receive email

### 5. Testing Strategy

**Decision**: Both automated tests AND manual test plan

**Automated**:
- Deno tests for key edge functions (`create-trial`, `cleanup-worker`, `provision-resources`)
- Test idempotency, rollback, retry logic

**Manual**:
- Step-by-step checklist for both signup channels
- Verify Stripe, Supabase, and Vapi state

### 6. Type Fixes Scope

**Decision**: Fix ALL types related to signup/billing/Vapi flows

**In scope**:
- Signup payload types (`signup_channel`, `sales_rep_id`)
- Edge function request/response types
- Stripe interaction types
- Vapi provisioning types
- Supabase models for signup pipeline

**Out of scope** (defer to future task):
- Unrelated type errors in other parts of repo

---

## Current Behavior (Problems)

### 1. **Two Divergent Signup Flows**

**Current State**:
- `create-trial` (lines 1-1191): Handles website + sales, uses `source: 'website' | 'sales'`
- `create-sales-account` (DEPRECATED): Separate sales-only flow
- Inconsistent metadata: `sales_rep_name` (free text) vs `sales_rep_id` (structured)

**Problem**:
- Duplicate logic across files
- Can't track sales rep performance (no FK to user)
- Risk of divergence over time

### 2. **Non-Idempotent Flow**

**File**: `/home/user/ringsnap/supabase/functions/create-trial/index.ts` (lines 431-815)

**Sequential operations without transaction safety**:

```
431: Create Stripe Customer
467: Attach Payment Method
493: Create Stripe Subscription
532: Create Auth User
601: Create Account Record
696: Create Profile Record
738: Create User Role
```

**Problem**: If step 5 fails (Account Record):
- ✅ Stripe customer created + subscription CHARGING
- ✅ Auth user created
- ❌ No account record
- ❌ No profile
- **Result**: Customer gets charged, but can't login. Retry creates duplicate Stripe resources.

### 3. **No Rollback Logic**

**Current error handling**:
```typescript
} catch (error) {
  logError("Provisioning failed", { accountId, error });
  return json(400, { ok: false, error: message });
}
```

**Problem**: Stripe customer + subscription remain active, charging customer indefinitely.

### 4. **Vapi Provisioning Disabled**

**Line 829**: `const ENABLE_VAPI = false;`

**Impact**:
- All accounts stuck in `provisioning_status: "pending"` forever
- No phone numbers provisioned
- Hardcoded flag instead of env var

### 5. **Manual Password Handoff**

**Current Flow**:
1. Sales rep creates account
2. System generates temp password
3. Sales rep manually copies and shares with customer

**Problems**:
- Security risk (password visible to sales rep)
- Manual step (not scalable)
- Customer may lose credentials

### 6. **Type Mismatches**

**Critical Issues**:
- `businessHours`: Object in sales form, string in trial form, string in edge function, JSONB in DB
- Missing DB fields in TypeScript types: `phone_number_e164`, `vapi_phone_number_id`, `phone_provisioned_at`
- Duplicate phone fields: `vapi_id` vs `vapi_phone_id`
- `source` vs `signup_channel` inconsistency

---

## Expected Behavior (Goals)

### 1. **Unified Signup Engine**

**Single entry point**: `/home/user/ringsnap/supabase/functions/create-trial/index.ts`

**Request Payload**:
```typescript
interface CreateTrialRequest {
  // User info (required)
  name: string;
  email: string;
  phone: string;

  // Business (required)
  companyName: string;
  trade: string;

  // Plan & Payment (required)
  planType: 'starter' | 'professional' | 'premium';
  paymentMethodId: string;

  // Channel tracking (required)
  signup_channel: 'self_service' | 'sales_guided';
  sales_rep_id?: string;  // UUID, only for sales_guided

  // Business details (optional)
  website?: string;
  serviceArea?: string;
  zipCode?: string;
  businessHours?: string | BusinessHoursObject;
  emergencyPolicy?: string;

  // AI config (optional)
  assistantGender?: 'male' | 'female';
  primaryGoal?: string;
  wantsAdvancedVoice?: boolean;

  // Metadata (optional)
  referralCode?: string;
  leadId?: string;
  deviceFingerprint?: string;
}
```

**Channel-Specific Behavior**:

| Channel | `signup_channel` | `sales_rep_id` | Trial Period | Email Trigger |
|---------|-----------------|----------------|--------------|---------------|
| **Public Website** | `self_service` | `null` | 3 days | Auto-send magic link |
| **Sales Workspace** | `sales_guided` | From logged-in staff user | 3 days | Auto-send magic link |

### 2. **Idempotent Flow with Transactions**

```typescript
async function createTrial(data: CreateTrialRequest) {
  const correlationId = generateOrExtractCorrelationId(req);
  const logOpts = { functionName: "create-trial", correlationId };

  // STEP 1: Check if already exists (idempotency)
  const existingUser = await findUserByEmail(data.email);
  if (existingUser) {
    const existingAccount = await findAccountByUserId(existingUser.id);
    if (existingAccount) {
      logInfo("Account already exists, returning existing", logOpts);
      return { success: true, account: existingAccount, message: "Already registered" };
    }
  }

  // STEP 2: Create/fetch Stripe customer (idempotent)
  const stripeCustomer = await getOrCreateStripeCustomer(data.email, data);

  // STEP 3: Attach payment method
  await stripe.paymentMethods.attach(data.paymentMethodId, {
    customer: stripeCustomer.id
  });

  // STEP 4: Create subscription
  let subscription;
  try {
    subscription = await stripe.subscriptions.create({
      customer: stripeCustomer.id,
      items: [{ price: getPriceId(data.planType) }],
      trial_period_days: 3,
      metadata: {
        signup_channel: data.signup_channel,
        sales_rep_id: data.sales_rep_id || ""
      }
    });
  } catch (stripeError) {
    // Rollback: Cancel Stripe customer
    await rollbackStripeResources(stripeCustomer.id, null, correlationId);
    throw new Error("Payment setup failed");
  }

  // STEP 5: Create account in DB (transaction)
  let account;
  try {
    account = await supabase.rpc('create_account_transaction', {
      p_email: data.email,
      p_password: generateTempPassword(),
      p_stripe_customer_id: stripeCustomer.id,
      p_stripe_subscription_id: subscription.id,
      p_signup_channel: data.signup_channel,
      p_sales_rep_id: data.sales_rep_id,
      p_account_data: buildAccountPayload(data),
      p_correlation_id: correlationId
    });
  } catch (dbError) {
    // Rollback: Cancel Stripe subscription + customer
    await rollbackStripeResources(stripeCustomer.id, subscription.id, correlationId);
    throw new Error("Account creation failed");
  }

  // STEP 6: Log state transition
  await logStateTransition(account.id, null, 'stripe_linked', correlationId);

  // STEP 7: Trigger customer email (async, non-blocking)
  await sendAccountSetupEmail(data.email, account.id);

  // STEP 8: Queue Vapi provisioning (async, non-blocking)
  if (ENABLE_VAPI_PROVISIONING) {
    await queueVapiProvisioning(account.id, data, correlationId);
  }

  return {
    success: true,
    account_id: account.id,
    message: "Account created! Check your email to set your password."
  };
}
```

### 3. **Rollback Strategy (Option B)**

**Helper Function**:
```typescript
async function rollbackStripeResources(
  customerId: string,
  subscriptionId: string | null,
  correlationId: string
) {
  const logOpts = { functionName: "rollback", correlationId };

  try {
    // Cancel subscription first (if exists)
    if (subscriptionId) {
      await stripe.subscriptions.cancel(subscriptionId);
      logInfo("Subscription cancelled", { ...logOpts, subscriptionId });
    }

    // Delete customer
    await stripe.customers.del(customerId);
    logInfo("Customer deleted", { ...logOpts, customerId });

  } catch (cleanupError) {
    // If rollback fails, log to orphaned_resources table for manual cleanup
    logError("Rollback failed, logging orphaned resource", {
      ...logOpts,
      error: cleanupError
    });

    await supabase.from("orphaned_stripe_resources").insert({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      correlation_id: correlationId,
      status: "pending_manual_cleanup",
      error: cleanupError.message,
      created_at: new Date().toISOString()
    });

    // Don't throw - we've logged the issue for manual follow-up
  }
}
```

**New Table**:
```sql
CREATE TABLE orphaned_stripe_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT,
  correlation_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending_manual_cleanup',
  error TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 4. **Automated Customer Email Flow**

**Function**: `sendAccountSetupEmail`

```typescript
async function sendAccountSetupEmail(email: string, accountId: string) {
  // Generate magic link using Supabase Auth
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email: email,
    options: {
      redirectTo: `${FRONTEND_URL}/auth/set-password?account_id=${accountId}`
    }
  });

  if (error) {
    logError("Failed to generate magic link", { email, accountId, error });
    return;
  }

  // Send email via Resend
  await resend.emails.send({
    from: "RingSnap <welcome@ringsnap.com>",
    to: email,
    subject: "Complete Your RingSnap Account Setup",
    html: renderAccountSetupEmail({
      magicLink: data.properties.action_link,
      accountId: accountId
    })
  });
}
```

**Email Template** (`welcome-email-template.html`):
```html
<h1>Welcome to RingSnap!</h1>
<p>Your AI receptionist account has been created. Complete your setup by setting your password.</p>
<a href="{{magicLink}}">Set My Password</a>
<p>This link expires in 24 hours.</p>
```

**Sales Rep UX**:
- Success modal shows: "✅ Account created! Customer will receive setup email at {email}"
- Option to "Resend Email" if customer doesn't receive it
- NO password shown to sales rep

### 5. **Observable State Machine**

**New Enum**:
```sql
CREATE TYPE provisioning_stage AS ENUM (
  'account_created',      -- DB account exists, no Stripe yet
  'stripe_linked',        -- Stripe subscription active
  'email_sent',           -- Setup email sent to customer
  'password_set',         -- Customer completed setup
  'vapi_queued',          -- Vapi job queued
  'vapi_assistant_ready', -- Assistant created
  'vapi_phone_pending',   -- Phone number requested
  'vapi_phone_active',    -- Phone number active
  'fully_provisioned',    -- All systems operational
  'failed_stripe',        -- Stripe setup failed
  'failed_vapi',          -- Vapi provisioning failed
  'failed_rollback'       -- Rollback failed (manual cleanup needed)
);
```

**State Transitions Table**:
```sql
CREATE TABLE provisioning_state_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  correlation_id TEXT NOT NULL,
  from_stage provisioning_stage,
  to_stage provisioning_stage NOT NULL,
  triggered_by TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pst_account_id ON provisioning_state_transitions(account_id);
CREATE INDEX idx_pst_correlation_id ON provisioning_state_transitions(correlation_id);
```

---

## Database Schema Changes

### 1. Update `accounts` table

**Migration**: `20251120000001_unified_signup_schema.sql`

```sql
-- Replace free-text source with enum
CREATE TYPE signup_channel_type AS ENUM ('self_service', 'sales_guided', 'enterprise');

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS signup_channel signup_channel_type,
  ADD COLUMN IF NOT EXISTS sales_rep_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS provisioning_stage provisioning_stage DEFAULT 'account_created';

-- Migrate existing data
UPDATE accounts
  SET signup_channel = CASE
    WHEN source = 'website' THEN 'self_service'::signup_channel_type
    WHEN source = 'sales' THEN 'sales_guided'::signup_channel_type
    ELSE 'self_service'::signup_channel_type
  END;

-- Drop old columns after migration
ALTER TABLE accounts DROP COLUMN IF EXISTS source;
ALTER TABLE accounts DROP COLUMN IF EXISTS sales_rep_name;

-- Add index
CREATE INDEX idx_accounts_sales_rep ON accounts(sales_rep_id) WHERE sales_rep_id IS NOT NULL;
```

### 2. Create `orphaned_stripe_resources` table

**Migration**: `20251120000002_orphaned_resources.sql`

```sql
CREATE TABLE orphaned_stripe_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT,
  correlation_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending_manual_cleanup' CHECK (status IN (
    'pending_manual_cleanup',
    'in_progress',
    'resolved',
    'cannot_resolve'
  )),
  error TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_orphaned_status ON orphaned_stripe_resources(status);
CREATE INDEX idx_orphaned_correlation ON orphaned_stripe_resources(correlation_id);
```

### 3. Create `provisioning_state_transitions` table

**Migration**: `20251120000003_provisioning_state_transitions.sql`

```sql
CREATE TYPE provisioning_stage AS ENUM (
  'account_created',
  'stripe_linked',
  'email_sent',
  'password_set',
  'vapi_queued',
  'vapi_assistant_ready',
  'vapi_phone_pending',
  'vapi_phone_active',
  'fully_provisioned',
  'failed_stripe',
  'failed_vapi',
  'failed_rollback'
);

CREATE TABLE provisioning_state_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  correlation_id TEXT NOT NULL,
  from_stage provisioning_stage,
  to_stage provisioning_stage NOT NULL,
  triggered_by TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pst_account_id ON provisioning_state_transitions(account_id);
CREATE INDEX idx_pst_correlation_id ON provisioning_state_transitions(correlation_id);
CREATE INDEX idx_pst_created_at ON provisioning_state_transitions(created_at DESC);
```

### 4. Update `profiles` table

**Migration**: `20251120000004_profiles_signup_channel.sql`

```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS signup_channel signup_channel_type;

-- Migrate from accounts
UPDATE profiles p
  SET signup_channel = a.signup_channel
  FROM accounts a
  WHERE p.account_id = a.id;
```

### 5. Deduplicate phone number fields

**Migration**: `20251120000005_dedupe_phone_fields.sql`

```sql
-- Consolidate vapi_id and vapi_phone_id in phone_numbers
UPDATE phone_numbers SET vapi_id = vapi_phone_id WHERE vapi_id IS NULL;
ALTER TABLE phone_numbers DROP COLUMN IF EXISTS vapi_phone_id;

-- Consolidate vapi_phone_number and phone_number_e164 in accounts
UPDATE accounts SET phone_number_e164 = vapi_phone_number WHERE phone_number_e164 IS NULL;
ALTER TABLE accounts DROP COLUMN IF EXISTS vapi_phone_number;

-- Rename for clarity
ALTER TABLE accounts RENAME COLUMN phone_number_e164 TO phone_number;
```

---

## Implementation Plan

### Phase 1: Database & Schema (Week 1, Days 1-2)

**Priority**: P0 - Foundation

#### Task 1.1: Create migrations

**Files to create**:
1. `20251120000001_unified_signup_schema.sql` - Add `signup_channel`, `sales_rep_id`, `provisioning_stage`
2. `20251120000002_orphaned_resources.sql` - Create `orphaned_stripe_resources` table
3. `20251120000003_provisioning_state_transitions.sql` - Create state machine table
4. `20251120000004_profiles_signup_channel.sql` - Add `signup_channel` to profiles
5. `20251120000005_dedupe_phone_fields.sql` - Remove duplicate phone columns

#### Task 1.2: Apply migrations

```bash
cd /home/user/ringsnap
npx supabase db push
```

#### Task 1.3: Regenerate TypeScript types

```bash
npx supabase gen types typescript --linked > src/integrations/supabase/types.ts
```

---

### Phase 2: Core Signup Engine (Week 1, Days 3-5)

**Priority**: P0 - Critical Path

#### Task 2.1: Update Zod schemas in `create-trial`

**File**: `/home/user/ringsnap/supabase/functions/create-trial/index.ts`

**Changes**:
```typescript
// Lines 55-95: Update schema
const createTrialSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().email().max(255),
  phone: z.string().min(1),
  companyName: z.string().trim().min(1).max(200),
  trade: z.string().min(1).max(100),

  // NEW: Replace source with signup_channel
  signup_channel: z.enum(['self_service', 'sales_guided']).default('self_service'),
  sales_rep_id: z.string().uuid().optional().nullable(),

  // ... rest of schema
});
```

#### Task 2.2: Add idempotency check

**Insert before line 431**:

```typescript
// Check if user already exists
const { data: existingUsers } = await supabase.auth.admin.listUsers();
const existingUser = existingUsers?.users?.find(u => u.email === data.email);

if (existingUser) {
  logInfo("User already exists, checking for account", {
    ...baseLogOptions,
    context: { email: data.email, userId: existingUser.id }
  });

  const { data: existingAccount } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", existingUser.user_metadata?.account_id)
    .single();

  if (existingAccount) {
    logInfo("Account already exists, returning existing", {
      ...baseLogOptions,
      context: { accountId: existingAccount.id }
    });

    return Response.json({
      success: true,
      message: "Account already exists",
      account_id: existingAccount.id,
      user_id: existingUser.id,
      email: data.email,
      provisioning_stage: existingAccount.provisioning_stage
    });
  }
}
```

#### Task 2.3: Make Stripe operations idempotent

**Replace lines 431-461**:

```typescript
// Check if Stripe customer already exists
let stripeCustomer: Stripe.Customer;
const existingCustomers = await stripe.customers.search({
  query: `email:'${data.email}'`,
  limit: 1
});

if (existingCustomers.data.length > 0) {
  stripeCustomer = existingCustomers.data[0];
  logInfo("Stripe customer already exists", {
    ...baseLogOptions,
    context: { customerId: stripeCustomer.id }
  });
} else {
  stripeCustomer = await stripe.customers.create({
    email: data.email,
    name: data.name,
    phone: data.phone,
    metadata: {
      company_name: data.companyName,
      trade: data.trade,
      signup_channel: data.signup_channel,
      sales_rep_id: data.sales_rep_id || ""
    }
  });

  logInfo("Stripe customer created", {
    ...baseLogOptions,
    context: { customerId: stripeCustomer.id }
  });
}
```

#### Task 2.4: Add rollback helper function

**Add new function** (after imports, before main handler):

```typescript
async function rollbackStripeResources(
  stripe: Stripe,
  supabase: SupabaseClient,
  customerId: string,
  subscriptionId: string | null,
  correlationId: string
): Promise<void> {
  const logOpts = { functionName: "rollback-stripe", correlationId };

  try {
    // Cancel subscription first (if exists)
    if (subscriptionId) {
      await stripe.subscriptions.cancel(subscriptionId);
      logInfo("Subscription cancelled during rollback", {
        ...logOpts,
        context: { subscriptionId }
      });
    }

    // Delete customer
    await stripe.customers.del(customerId);
    logInfo("Customer deleted during rollback", {
      ...logOpts,
      context: { customerId }
    });

  } catch (cleanupError) {
    logError("Rollback failed, logging orphaned resource", {
      ...logOpts,
      error: cleanupError,
      context: { customerId, subscriptionId }
    });

    // Log to orphaned_resources table for manual cleanup
    await supabase.from("orphaned_stripe_resources").insert({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      correlation_id: correlationId,
      status: "pending_manual_cleanup",
      error: cleanupError.message
    });
  }
}
```

#### Task 2.5: Wrap Stripe operations in try/catch with rollback

**Wrap lines 467-526** (payment method attach + subscription create):

```typescript
// Attach payment method
try {
  await stripe.paymentMethods.attach(data.paymentMethodId, {
    customer: stripeCustomer.id
  });

  await stripe.customers.update(stripeCustomer.id, {
    invoice_settings: {
      default_payment_method: data.paymentMethodId
    }
  });
} catch (pmError) {
  logError("Payment method attach failed", {
    ...baseLogOptions,
    error: pmError,
    context: { customerId: stripeCustomer.id }
  });

  // Rollback customer
  await rollbackStripeResources(
    stripe,
    supabase,
    stripeCustomer.id,
    null,
    correlationId
  );

  return Response.json({
    success: false,
    error: "Payment method setup failed. Please try again."
  }, { status: 400 });
}

// Create subscription
let subscription: Stripe.Subscription;
try {
  subscription = await stripe.subscriptions.create({
    customer: stripeCustomer.id,
    items: [{ price: getStripePriceId(data.planType) }],
    trial_period_days: 3,
    payment_behavior: "default_incomplete",
    metadata: {
      signup_channel: data.signup_channel,
      sales_rep_id: data.sales_rep_id || "",
      plan_type: data.planType
    }
  });

  logInfo("Stripe subscription created", {
    ...baseLogOptions,
    context: { subscriptionId: subscription.id }
  });
} catch (subError) {
  logError("Subscription creation failed", {
    ...baseLogOptions,
    error: subError,
    context: { customerId: stripeCustomer.id }
  });

  // Rollback customer (subscription doesn't exist yet)
  await rollbackStripeResources(
    stripe,
    supabase,
    stripeCustomer.id,
    null,
    correlationId
  );

  return Response.json({
    success: false,
    error: "Subscription setup failed. Please check your payment method."
  }, { status: 400 });
}
```

#### Task 2.6: Create DB transaction stored procedure

**New migration**: `20251120000006_create_account_transaction.sql`

```sql
CREATE OR REPLACE FUNCTION create_account_transaction(
  p_email TEXT,
  p_password TEXT,
  p_stripe_customer_id TEXT,
  p_stripe_subscription_id TEXT,
  p_signup_channel signup_channel_type,
  p_sales_rep_id UUID,
  p_account_data JSONB,
  p_correlation_id TEXT
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_account_id UUID;
  v_profile_id UUID;
  v_result JSONB;
BEGIN
  -- Step 1: Create auth user
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    jsonb_build_object(
      'name', p_account_data->>'name',
      'phone', p_account_data->>'phone',
      'company_name', p_account_data->>'company_name',
      'correlation_id', p_correlation_id
    ),
    now(),
    now()
  )
  RETURNING id INTO v_user_id;

  -- Step 2: Create account
  INSERT INTO accounts (
    company_name,
    trade,
    stripe_customer_id,
    stripe_subscription_id,
    signup_channel,
    sales_rep_id,
    provisioning_stage,
    subscription_status,
    trial_start_date,
    trial_end_date,
    plan_type,
    phone_number_area_code,
    zip_code,
    business_hours,
    assistant_gender,
    wants_advanced_voice,
    company_website,
    service_area,
    emergency_policy,
    billing_state
  )
  VALUES (
    p_account_data->>'company_name',
    p_account_data->>'trade',
    p_stripe_customer_id,
    p_stripe_subscription_id,
    p_signup_channel,
    p_sales_rep_id,
    'stripe_linked'::provisioning_stage,
    'trial',
    now(),
    now() + interval '3 days',
    p_account_data->>'plan_type',
    p_account_data->>'phone_number_area_code',
    p_account_data->>'zip_code',
    (p_account_data->>'business_hours')::jsonb,
    p_account_data->>'assistant_gender',
    (p_account_data->>'wants_advanced_voice')::boolean,
    p_account_data->>'company_website',
    p_account_data->>'service_area',
    p_account_data->>'emergency_policy',
    p_account_data->>'billing_state'
  )
  RETURNING id INTO v_account_id;

  -- Step 3: Create profile
  INSERT INTO profiles (
    id,
    account_id,
    name,
    phone,
    is_primary,
    signup_channel
  )
  VALUES (
    v_user_id,
    v_account_id,
    p_account_data->>'name',
    p_account_data->>'phone',
    true,
    p_signup_channel
  )
  RETURNING id INTO v_profile_id;

  -- Step 4: Assign owner role
  INSERT INTO user_roles (user_id, role)
  VALUES (v_user_id, 'owner');

  -- Step 5: Log initial state transition
  INSERT INTO provisioning_state_transitions (
    account_id,
    correlation_id,
    from_stage,
    to_stage,
    triggered_by,
    metadata
  )
  VALUES (
    v_account_id,
    p_correlation_id,
    NULL,
    'stripe_linked'::provisioning_stage,
    'create-trial',
    jsonb_build_object(
      'stripe_customer_id', p_stripe_customer_id,
      'stripe_subscription_id', p_stripe_subscription_id
    )
  );

  -- Step 6: Update user metadata with account_id
  UPDATE auth.users
  SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object('account_id', v_account_id)
  WHERE id = v_user_id;

  -- Return result
  v_result := jsonb_build_object(
    'user_id', v_user_id,
    'account_id', v_account_id,
    'profile_id', v_profile_id
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    -- Rollback is automatic due to transaction
    RAISE EXCEPTION 'Account creation transaction failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### Task 2.7: Replace inline DB operations with transaction

**Replace lines 532-762** with:

```typescript
// Create account, profile, and role in atomic transaction
let accountResult;
try {
  const { data: txResult, error: txError } = await supabase.rpc('create_account_transaction', {
    p_email: data.email,
    p_password: tempPassword,
    p_stripe_customer_id: stripeCustomer.id,
    p_stripe_subscription_id: subscription.id,
    p_signup_channel: data.signup_channel,
    p_sales_rep_id: data.sales_rep_id || null,
    p_account_data: {
      name: data.name,
      phone: data.phone,
      company_name: data.companyName,
      trade: data.trade,
      plan_type: data.planType,
      phone_number_area_code: data.zipCode?.slice(0, 3) || null,
      zip_code: data.zipCode || null,
      business_hours: businessHoursValue,
      assistant_gender: data.assistantGender || 'female',
      wants_advanced_voice: data.wantsAdvancedVoice || false,
      company_website: data.website || null,
      service_area: data.serviceArea || null,
      emergency_policy: data.emergencyPolicy || null,
      billing_state: getStateFromZip(data.zipCode)
    },
    p_correlation_id: correlationId
  });

  if (txError) {
    throw txError;
  }

  accountResult = txResult;

  logInfo("Account transaction completed", {
    ...baseLogOptions,
    context: {
      accountId: accountResult.account_id,
      userId: accountResult.user_id
    }
  });

} catch (dbError) {
  logError("Database transaction failed", {
    ...baseLogOptions,
    error: dbError,
    context: {
      customerId: stripeCustomer.id,
      subscriptionId: subscription.id
    }
  });

  // Rollback Stripe resources
  await rollbackStripeResources(
    stripe,
    supabase,
    stripeCustomer.id,
    subscription.id,
    correlationId
  );

  return Response.json({
    success: false,
    error: "Account setup failed. No charges were made."
  }, { status: 500 });
}
```

---

### Phase 3: Automated Email Flow (Week 2, Days 1-2)

**Priority**: P0 - User Experience

#### Task 3.1: Create email helper function

**New file**: `/home/user/ringsnap/supabase/functions/_shared/email-service.ts`

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface SendAccountSetupEmailParams {
  email: string;
  accountId: string;
  companyName: string;
  isSalesGuided: boolean;
}

export async function sendAccountSetupEmail(params: SendAccountSetupEmailParams): Promise<boolean> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://ringsnap.com";

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Generate magic link for password setup
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: params.email,
      options: {
        redirectTo: `${frontendUrl}/auth/set-password?account_id=${params.accountId}`
      }
    });

    if (linkError) {
      throw linkError;
    }

    const magicLink = linkData.properties.action_link;

    // Send email via Resend
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { margin-top: 20px; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to RingSnap!</h1>
          </div>
          <div class="content">
            <h2>Your AI Receptionist is Ready</h2>
            <p>Hello,</p>
            <p>Your RingSnap account for <strong>${params.companyName}</strong> has been successfully created!</p>
            ${params.isSalesGuided ? '<p>One of our team members created this account for you.</p>' : ''}
            <p>Complete your account setup by clicking the button below to set your password:</p>
            <a href="${magicLink}" class="button">Set My Password</a>
            <p><small>This link expires in 24 hours. If it expires, you can request a new one from the login page.</small></p>
            <div class="footer">
              <p>Need help? Contact us at support@ringsnap.com</p>
              <p>&copy; 2025 RingSnap. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "RingSnap <welcome@ringsnap.com>",
        to: params.email,
        subject: "Complete Your RingSnap Account Setup",
        html: emailHtml
      })
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      throw new Error(`Resend API error: ${errorData}`);
    }

    return true;

  } catch (error) {
    console.error("Failed to send account setup email:", error);
    return false;
  }
}
```

#### Task 3.2: Add email trigger to `create-trial`

**After account transaction succeeds** (after line 762 replacement):

```typescript
// Send account setup email (non-blocking)
try {
  const emailSent = await sendAccountSetupEmail({
    email: data.email,
    accountId: accountResult.account_id,
    companyName: data.companyName,
    isSalesGuided: data.signup_channel === 'sales_guided'
  });

  if (emailSent) {
    logInfo("Account setup email sent", {
      ...baseLogOptions,
      context: { email: maskEmail(data.email), accountId: accountResult.account_id }
    });

    // Log state transition
    await logStateTransition(
      supabase,
      accountResult.account_id,
      'stripe_linked',
      'email_sent',
      'create-trial',
      correlationId,
      { email_provider: 'resend' }
    );
  } else {
    logWarn("Failed to send account setup email (non-critical)", {
      ...baseLogOptions,
      context: { email: maskEmail(data.email) }
    });
  }
} catch (emailError) {
  logError("Email sending error (non-critical)", {
    ...baseLogOptions,
    error: emailError
  });
}
```

#### Task 3.3: Update sales success modal

**File**: `/home/user/ringsnap/src/components/SalesSuccessModal.tsx`

**Replace password display** with email confirmation:

```typescript
// OLD:
<div>
  <label>Temporary Password</label>
  <input type="text" value={password} readOnly />
  <button onClick={() => copyToClipboard(password)}>Copy</button>
</div>

// NEW:
<div className="success-message">
  <CheckCircle className="icon-success" />
  <h3>Account Created Successfully!</h3>
  <p>
    A setup email has been sent to <strong>{email}</strong>
  </p>
  <p className="text-sm text-gray-600">
    The customer will receive instructions to set their password and access their account.
  </p>
  <button onClick={handleResendEmail}>
    Resend Email
  </button>
</div>
```

---

### Phase 4: Vapi Provisioning (Week 2, Days 3-5)

**Priority**: P1 - Core Feature

#### Task 4.1: Update VAPI flag to env var

**File**: `/home/user/ringsnap/supabase/functions/create-trial/index.ts`

**Replace line 829**:

```typescript
// OLD: const ENABLE_VAPI = false;
// NEW:
const ENABLE_VAPI_PROVISIONING = Deno.env.get("ENABLE_VAPI_PROVISIONING") === "true";
```

**Update `.env.example`**:
```bash
# Vapi Provisioning
ENABLE_VAPI_PROVISIONING=true
VAPI_API_KEY=your_vapi_api_key
VAPI_BASE_URL=https://api.vapi.ai
```

#### Task 4.2: Queue Vapi provisioning

**Replace lines 820-1100** with:

```typescript
// Queue Vapi provisioning (async, non-blocking)
if (ENABLE_VAPI_PROVISIONING && VAPI_API_KEY) {
  try {
    const { error: jobError } = await supabase.from("provisioning_jobs").insert({
      account_id: accountResult.account_id,
      user_id: accountResult.user_id,
      job_type: "full_provisioning",
      status: "queued",
      correlation_id: correlationId,
      metadata: {
        assistant_gender: data.assistantGender || 'female',
        company_name: data.companyName,
        phone: data.phone,
        area_code: data.zipCode?.slice(0, 3) || null,
        primary_goal: data.primaryGoal || 'answer_questions'
      }
    });

    if (jobError) {
      throw jobError;
    }

    // Log state transition
    await logStateTransition(
      supabase,
      accountResult.account_id,
      'email_sent',
      'vapi_queued',
      'create-trial',
      correlationId
    );

    logInfo("Vapi provisioning job queued", {
      ...baseLogOptions,
      context: { accountId: accountResult.account_id }
    });

    vapiProvisioningStatus = "queued";

  } catch (queueError) {
    logError("Failed to queue Vapi provisioning (non-critical)", {
      ...baseLogOptions,
      error: queueError
    });
    vapiProvisioningStatus = "failed_to_queue";
  }
} else {
  vapiProvisioningStatus = "disabled";
}
```

#### Task 4.3: Enhance `provision-resources` worker

**File**: `/home/user/ringsnap/supabase/functions/provision-resources/index.ts`

**Replace entire file** with enhanced version:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logInfo, logError, logWarn } from "../_shared/logging.ts";
import { logStateTransition } from "../_shared/state-transitions.ts";

const VAPI_API_KEY = Deno.env.get("VAPI_API_KEY");
const VAPI_BASE_URL = Deno.env.get("VAPI_BASE_URL") || "https://api.vapi.ai";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const correlationId = crypto.randomUUID();
  const functionName = "provision-resources";

  try {
    // Fetch queued jobs
    const { data: queuedJobs, error: fetchError } = await supabase
      .from("provisioning_jobs")
      .select("*, accounts(*)")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(5);

    if (fetchError) {
      throw fetchError;
    }

    if (!queuedJobs || queuedJobs.length === 0) {
      return new Response(
        JSON.stringify({ message: "No queued jobs", processed: 0 }),
        { status: 200 }
      );
    }

    let processed = 0;
    let failed = 0;

    for (const job of queuedJobs) {
      const jobCorrelationId = job.correlation_id || correlationId;
      const accountId = job.account_id;
      const logOpts = { functionName, correlationId: jobCorrelationId };

      try {
        // Mark as in_progress
        await supabase
          .from("provisioning_jobs")
          .update({ status: "in_progress", updated_at: new Date().toISOString() })
          .eq("id", job.id);

        logInfo("Processing provisioning job", {
          ...logOpts,
          context: { jobId: job.id, accountId }
        });

        // STEP 1: Create Vapi assistant (if not exists)
        let assistantId = job.accounts.vapi_assistant_id;
        if (!assistantId) {
          const assistant = await createVapiAssistant({
            companyName: job.metadata.company_name,
            gender: job.metadata.assistant_gender,
            primaryGoal: job.metadata.primary_goal
          });

          assistantId = assistant.id;

          await supabase.from("vapi_assistants").insert({
            account_id: accountId,
            vapi_assistant_id: assistantId,
            config: assistant
          });

          await supabase.from("accounts").update({
            vapi_assistant_id: assistantId
          }).eq("id", accountId);

          await logStateTransition(
            supabase,
            accountId,
            'vapi_queued',
            'vapi_assistant_ready',
            functionName,
            jobCorrelationId,
            { vapi_assistant_id: assistantId }
          );

          logInfo("Vapi assistant created", {
            ...logOpts,
            context: { accountId, assistantId }
          });
        }

        // STEP 2: Create phone number
        const phone = await createVapiPhoneNumber({
          areaCode: job.metadata.area_code,
          fallbackNumber: job.metadata.phone
        });

        await supabase.from("phone_numbers").insert({
          account_id: accountId,
          vapi_id: phone.id,
          phone_number: phone.number,
          status: phone.status || "pending",
          area_code: job.metadata.area_code,
          raw: phone
        });

        await supabase.from("accounts").update({
          phone_number: phone.number,
          phone_number_status: "pending"
        }).eq("id", accountId);

        await logStateTransition(
          supabase,
          accountId,
          'vapi_assistant_ready',
          'vapi_phone_pending',
          functionName,
          jobCorrelationId,
          { vapi_phone_id: phone.id, phone_number: phone.number }
        );

        logInfo("Vapi phone number created", {
          ...logOpts,
          context: { accountId, phoneId: phone.id, phoneNumber: phone.number }
        });

        // STEP 3: Link assistant to phone
        await linkAssistantToPhone(phone.id, assistantId);

        logInfo("Assistant linked to phone", {
          ...logOpts,
          context: { accountId, assistantId, phoneId: phone.id }
        });

        // STEP 4: Mark job as completed
        await supabase.from("provisioning_jobs").update({
          status: "completed",
          completed_at: new Date().toISOString(),
          vapi_assistant_id: assistantId,
          vapi_phone_id: phone.id
        }).eq("id", job.id);

        logInfo("Provisioning job completed", {
          ...logOpts,
          context: { jobId: job.id, accountId }
        });

        processed++;

      } catch (jobError) {
        failed++;

        logError("Provisioning job failed", {
          ...logOpts,
          error: jobError,
          context: { jobId: job.id, accountId }
        });

        // Calculate retry timestamp with exponential backoff
        const attempts = job.attempts || 0;
        const retryAfter = calculateRetryAfter(attempts);

        await supabase.from("provisioning_jobs").update({
          status: "failed",
          error: jobError.message,
          attempts: attempts + 1,
          retry_after: retryAfter,
          updated_at: new Date().toISOString()
        }).eq("id", job.id);

        await logStateTransition(
          supabase,
          accountId,
          job.accounts.provisioning_stage,
          'failed_vapi',
          functionName,
          jobCorrelationId,
          { error: jobError.message, retry_after: retryAfter }
        );
      }
    }

    return new Response(
      JSON.stringify({
        message: "Processing complete",
        processed,
        failed,
        total: queuedJobs.length
      }),
      { status: 200 }
    );

  } catch (error) {
    logError("Provision-resources worker error", {
      functionName,
      correlationId,
      error
    });

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
});

// Helper: Create Vapi assistant
async function createVapiAssistant(params: {
  companyName: string;
  gender: string;
  primaryGoal: string;
}): Promise<any> {
  const voiceId = params.gender === 'male' ? 'michael' : 'sarah';

  const response = await fetch(`${VAPI_BASE_URL}/assistant`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${VAPI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: `${params.companyName} Assistant`,
      model: {
        provider: "openai",
        model: "gpt-4",
        messages: [{
          role: "system",
          content: `You are an AI receptionist for ${params.companyName}. Your primary goal is to ${params.primaryGoal.replace('_', ' ')}.`
        }]
      },
      voice: {
        provider: "11labs",
        voiceId: voiceId
      },
      firstMessage: `Thank you for calling ${params.companyName}! How can I help you today?`,
      recordingEnabled: true
    })
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Vapi assistant creation failed: ${errorData}`);
  }

  return await response.json();
}

// Helper: Create Vapi phone number
async function createVapiPhoneNumber(params: {
  areaCode: string | null;
  fallbackNumber: string;
}): Promise<any> {
  const payload: any = {
    provider: "vapi",
    name: "Primary Line",
    fallbackDestination: {
      type: "number",
      number: params.fallbackNumber
    }
  };

  if (params.areaCode) {
    payload.numberDesiredAreaCode = params.areaCode;
  }

  const response = await fetch(`${VAPI_BASE_URL}/phone-number`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${VAPI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Vapi phone number creation failed: ${errorData}`);
  }

  return await response.json();
}

// Helper: Link assistant to phone
async function linkAssistantToPhone(phoneId: string, assistantId: string): Promise<void> {
  const response = await fetch(`${VAPI_BASE_URL}/phone-number/${phoneId}`, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${VAPI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ assistantId })
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Failed to link assistant to phone: ${errorData}`);
  }
}

// Helper: Calculate retry timestamp with exponential backoff
function calculateRetryAfter(attempts: number): string {
  const delays = [60, 300, 900, 3600]; // 1min, 5min, 15min, 1hr
  const delaySeconds = delays[Math.min(attempts, delays.length - 1)];
  const retryAt = new Date(Date.now() + delaySeconds * 1000);
  return retryAt.toISOString();
}
```

#### Task 4.4: Create state transition helper

**New file**: `/home/user/ringsnap/supabase/functions/_shared/state-transitions.ts`

```typescript
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logInfo } from "./logging.ts";

export async function logStateTransition(
  supabase: SupabaseClient,
  accountId: string,
  fromStage: string | null,
  toStage: string,
  triggeredBy: string,
  correlationId: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    // Insert transition log
    await supabase.from("provisioning_state_transitions").insert({
      account_id: accountId,
      correlation_id: correlationId,
      from_stage: fromStage,
      to_stage: toStage,
      triggered_by: triggeredBy,
      metadata: metadata || {}
    });

    // Update account stage
    await supabase.from("accounts").update({
      provisioning_stage: toStage,
      updated_at: new Date().toISOString()
    }).eq("id", accountId);

    logInfo("State transition logged", {
      functionName: triggeredBy,
      correlationId,
      context: { accountId, fromStage, toStage }
    });

  } catch (error) {
    console.error("Failed to log state transition:", error);
    // Don't throw - logging failure shouldn't break the flow
  }
}
```

---

### Phase 5: Frontend Updates (Week 3, Days 1-2)

**Priority**: P1 - Integration

#### Task 5.1: Add correlation ID utility

**New file**: `/home/user/ringsnap/src/lib/correlationId.ts`

```typescript
/**
 * Generates a new correlation ID using crypto.randomUUID()
 */
export function generateCorrelationId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Gets or creates a session-level correlation ID
 * Used for tracking a user's entire session
 */
export function getSessionCorrelationId(): string {
  if (typeof sessionStorage === 'undefined') {
    return generateCorrelationId();
  }

  let sessionId = sessionStorage.getItem('ringsnap_session_id');
  if (!sessionId) {
    sessionId = generateCorrelationId();
    sessionStorage.setItem('ringsnap_session_id', sessionId);
  }
  return sessionId;
}

/**
 * Generates a new request-specific correlation ID
 * Used for tracking individual API calls
 */
export function getRequestCorrelationId(): string {
  return generateCorrelationId();
}
```

#### Task 5.2: Update Supabase client with correlation ID header

**File**: `/home/user/ringsnap/src/integrations/supabase/client.ts`

**Add correlation ID to headers**:

```typescript
import { createClient } from '@supabase/supabase-js';
import { getRequestCorrelationId } from '@/lib/correlationId';
import type { Database } from './types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true
  },
  global: {
    headers: {
      'x-correlation-id': getRequestCorrelationId()
    }
  }
});
```

#### Task 5.3: Update SalesSignupForm to pass sales_rep_id

**File**: `/home/user/ringsnap/src/components/SalesSignupForm.tsx`

**Get logged-in sales rep ID**:

```typescript
// At top of component
const { data: session } = useSession();
const salesRepId = session?.user?.id;

// In form submission (around line 224)
const { data, error } = await supabase.functions.invoke('create-trial', {
  body: {
    name: formData.name,
    email: formData.email,
    phone: formData.phone,
    companyName: formData.companyName,
    trade: formData.trade,
    zipCode: formData.zipCode,
    planType: formData.planType,
    paymentMethodId: paymentMethod.id,

    // NEW: Channel tracking
    signup_channel: 'sales_guided',
    sales_rep_id: salesRepId,  // From logged-in user

    // ... rest of fields
  }
});
```

#### Task 5.4: Update TrialSignupFlow for self-service

**File**: `/home/user/ringsnap/src/components/signup/TrialSignupFlow.tsx`

**Around line 277-279**:

```typescript
const { data, error } = await supabase.functions.invoke('create-trial', {
  body: {
    // ... all existing fields

    // NEW: Channel tracking
    signup_channel: 'self_service',
    sales_rep_id: null,
  }
});
```

---

### Phase 6: Testing (Week 3, Days 3-5)

**Priority**: P0 - Quality Assurance

#### Task 6.1: Create Deno tests

**New file**: `/home/user/ringsnap/supabase/functions/_tests/create-trial.test.ts`

```typescript
import { assertEquals, assertExists } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.test("create-trial: happy path (self-service)", async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const testEmail = `test-${Date.now()}@example.com`;

  const response = await supabase.functions.invoke('create-trial', {
    body: {
      name: "Test User",
      email: testEmail,
      phone: "+15555551234",
      companyName: "Test Co",
      trade: "HVAC",
      planType: "starter",
      paymentMethodId: "pm_card_visa", // Stripe test PM
      signup_channel: "self_service",
      zipCode: "94102"
    }
  });

  assertEquals(response.error, null);
  assertExists(response.data.account_id);
  assertEquals(response.data.success, true);

  // Verify account created
  const { data: account } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", response.data.account_id)
    .single();

  assertEquals(account.signup_channel, "self_service");
  assertEquals(account.provisioning_stage, "stripe_linked" || "email_sent");
});

Deno.test("create-trial: idempotency (duplicate email)", async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const testEmail = `test-idem-${Date.now()}@example.com`;

  // First signup
  const response1 = await supabase.functions.invoke('create-trial', {
    body: {
      name: "Test User",
      email: testEmail,
      phone: "+15555551234",
      companyName: "Test Co",
      trade: "HVAC",
      planType: "starter",
      paymentMethodId: "pm_card_visa",
      signup_channel: "self_service",
      zipCode: "94102"
    }
  });

  assertEquals(response1.error, null);
  const accountId1 = response1.data.account_id;

  // Second signup (same email)
  const response2 = await supabase.functions.invoke('create-trial', {
    body: {
      name: "Test User",
      email: testEmail,
      phone: "+15555551234",
      companyName: "Test Co",
      trade: "HVAC",
      planType: "professional", // Different plan
      paymentMethodId: "pm_card_visa",
      signup_channel: "self_service",
      zipCode: "94102"
    }
  });

  assertEquals(response2.error, null);
  assertEquals(response2.data.account_id, accountId1); // Same account returned
  assertEquals(response2.data.message, "Account already exists");
});

Deno.test("create-trial: Stripe failure rollback", async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const testEmail = `test-fail-${Date.now()}@example.com`;

  // Use declining card
  const response = await supabase.functions.invoke('create-trial', {
    body: {
      name: "Test User",
      email: testEmail,
      phone: "+15555551234",
      companyName: "Test Co",
      trade: "HVAC",
      planType: "starter",
      paymentMethodId: "pm_card_chargeDeclined", // Stripe test declining card
      signup_channel: "self_service",
      zipCode: "94102"
    }
  });

  assertEquals(response.data.success, false);
  assertExists(response.data.error);

  // Verify no account created
  const { data: account } = await supabase
    .from("accounts")
    .select("*")
    .eq("company_name", "Test Co")
    .single();

  assertEquals(account, null);
});
```

**Run tests**:
```bash
deno test --allow-net --allow-env supabase/functions/_tests/create-trial.test.ts
```

#### Task 6.2: Create manual test checklist

**New file**: `/home/user/ringsnap/MANUAL_TEST_CHECKLIST.md`

```markdown
# Manual Test Checklist - Unified Signup Flow

## Pre-Test Setup

- [ ] Set `ENABLE_VAPI_PROVISIONING=true` in edge function env
- [ ] Verify Stripe test mode enabled
- [ ] Verify Resend configured with test email
- [ ] Clear test data from previous runs

---

## Test Case 1: Self-Service Signup (Happy Path)

**Channel**: `self_service`

**Steps**:
1. Navigate to `/signup` on frontend
2. Fill out Step 1 (Contact Info)
   - Name: Test User
   - Email: test-self-TIMESTAMP@example.com
   - Phone: +1 (555) 555-1234
3. Fill out Step 2 (Business Details)
   - Company: Test HVAC Co
   - Trade: HVAC
   - Website: https://test.com
4. Fill out Step 3 (Plan Selection)
   - Select: Professional ($89/mo)
5. Fill out Step 4 (Payment)
   - Card: 4242 4242 4242 4242
   - Expiry: 12/30
   - CVC: 123
6. Submit form

**Expected Results**:
- [ ] Success message displayed
- [ ] Redirected to `/auth/set-password` or dashboard
- [ ] Email received at test-self-TIMESTAMP@example.com with magic link
- [ ] Database checks:
  ```sql
  -- Account created
  SELECT * FROM accounts WHERE company_name = 'Test HVAC Co';
  -- signup_channel = 'self_service'
  -- sales_rep_id = NULL
  -- provisioning_stage = 'email_sent' or 'vapi_queued'

  -- User created
  SELECT * FROM auth.users WHERE email = 'test-self-TIMESTAMP@example.com';

  -- Profile created
  SELECT * FROM profiles WHERE account_id = '<ACCOUNT_ID>';
  -- signup_channel = 'self_service'

  -- State transitions logged
  SELECT * FROM provisioning_state_transitions WHERE account_id = '<ACCOUNT_ID>';
  -- Should see: NULL → stripe_linked → email_sent → vapi_queued
  ```

- [ ] Stripe checks:
  ```bash
  # Customer created
  stripe customers list --email test-self-TIMESTAMP@example.com

  # Subscription created
  stripe subscriptions list --customer <CUSTOMER_ID>
  # status = trialing, trial_end = 3 days from now
  ```

- [ ] Vapi checks (if provisioning enabled):
  ```sql
  SELECT * FROM provisioning_jobs WHERE account_id = '<ACCOUNT_ID>';
  -- status = 'queued' or 'in_progress' or 'completed'
  ```

---

## Test Case 2: Sales-Guided Signup

**Channel**: `sales_guided`

**Steps**:
1. Login as sales rep (test-sales-rep@ringsnap.com)
2. Navigate to `/sales` dashboard
3. Fill out Sales Signup Form:
   - Customer Name: Jane Customer
   - Customer Email: test-sales-TIMESTAMP@example.com
   - Customer Phone: +1 (555) 555-5678
   - Company: Jane's Plumbing
   - Trade: Plumbing
   - Zip Code: 94102
   - Plan: Starter
   - Card: 4242 4242 4242 4242
4. Submit form

**Expected Results**:
- [ ] Success modal displayed with message: "✅ Account created! Customer will receive setup email at test-sales-TIMESTAMP@example.com"
- [ ] NO password shown to sales rep
- [ ] Email sent to customer
- [ ] Database checks:
  ```sql
  SELECT * FROM accounts WHERE company_name = 'Jane''s Plumbing';
  -- signup_channel = 'sales_guided'
  -- sales_rep_id = '<SALES_REP_USER_ID>'

  SELECT * FROM provisioning_state_transitions WHERE account_id = '<ACCOUNT_ID>';
  ```

- [ ] Sales rep analytics:
  ```sql
  SELECT COUNT(*) as total_signups
  FROM accounts
  WHERE sales_rep_id = '<SALES_REP_USER_ID>';
  ```

---

## Test Case 3: Idempotency (Duplicate Email)

**Steps**:
1. Complete Test Case 1 (Self-Service Signup)
2. Note the `account_id` returned
3. Attempt signup again with **same email**, different details:
   - Same: test-self-TIMESTAMP@example.com
   - Different: Company name, plan type
4. Submit form

**Expected Results**:
- [ ] Response: `{ success: true, message: "Account already exists", account_id: "<ORIGINAL_ID>" }`
- [ ] Same account ID returned as first signup
- [ ] NO new Stripe customer created
- [ ] NO new account record in DB
- [ ] Check Stripe:
  ```bash
  stripe customers list --email test-self-TIMESTAMP@example.com
  # Should show only 1 customer
  ```

---

## Test Case 4: Stripe Payment Declined (Rollback)

**Steps**:
1. Navigate to `/signup`
2. Fill out all steps
3. Use **declining card**: 4000 0000 0000 0002
4. Submit form

**Expected Results**:
- [ ] Error message: "Payment method setup failed. Please try again."
- [ ] NO account created in DB
- [ ] Check orphaned resources:
  ```sql
  SELECT * FROM orphaned_stripe_resources ORDER BY created_at DESC LIMIT 1;
  -- Should be empty OR status = 'resolved'
  ```
- [ ] Check Stripe (verify cleanup happened):
  ```bash
  stripe customers list --email test-fail-TIMESTAMP@example.com
  # Should be empty (customer deleted during rollback)
  ```

---

## Test Case 5: Database Transaction Failure (Rollback)

**Steps**:
1. Temporarily break DB constraint:
   ```sql
   ALTER TABLE accounts ALTER COLUMN company_name DROP NOT NULL;
   ```
2. Attempt signup with company_name intentionally NULL/empty
3. Observe rollback

**Expected Results**:
- [ ] Error: "Account setup failed. No charges were made."
- [ ] Stripe subscription cancelled
- [ ] Stripe customer deleted
- [ ] Check logs:
  ```sql
  SELECT * FROM provisioning_state_transitions
  WHERE to_stage = 'failed_rollback'
  ORDER BY created_at DESC LIMIT 1;
  ```

**Cleanup**:
```sql
ALTER TABLE accounts ALTER COLUMN company_name SET NOT NULL;
```

---

## Test Case 6: Vapi Provisioning (Async)

**Steps**:
1. Complete Test Case 1 (Self-Service Signup)
2. Wait 30-60 seconds
3. Check provisioning status

**Expected Results**:
- [ ] Provisioning job processed:
  ```sql
  SELECT * FROM provisioning_jobs WHERE account_id = '<ACCOUNT_ID>';
  -- status = 'completed'
  -- vapi_assistant_id populated
  -- vapi_phone_id populated
  ```

- [ ] Account updated:
  ```sql
  SELECT vapi_assistant_id, phone_number, provisioning_stage
  FROM accounts WHERE id = '<ACCOUNT_ID>';
  -- provisioning_stage = 'vapi_phone_pending' or 'fully_provisioned'
  ```

- [ ] State transitions:
  ```sql
  SELECT from_stage, to_stage, triggered_by, created_at
  FROM provisioning_state_transitions
  WHERE account_id = '<ACCOUNT_ID>'
  ORDER BY created_at;
  -- Should see full flow: stripe_linked → email_sent → vapi_queued → vapi_assistant_ready → vapi_phone_pending
  ```

---

## Test Case 7: Customer Completes Setup (Magic Link)

**Steps**:
1. Complete Test Case 1 (Self-Service Signup)
2. Check email inbox for test-self-TIMESTAMP@example.com
3. Click "Set My Password" button in email
4. Enter new password (2x for confirmation)
5. Submit

**Expected Results**:
- [ ] Redirected to dashboard
- [ ] Can login with new password
- [ ] Check state transition:
  ```sql
  SELECT * FROM provisioning_state_transitions
  WHERE account_id = '<ACCOUNT_ID>' AND to_stage = 'password_set';
  ```

---

## Test Case 8: Resend Email (Sales Rep)

**Steps**:
1. Complete Test Case 2 (Sales-Guided Signup)
2. In success modal, click "Resend Email"
3. Check customer email inbox

**Expected Results**:
- [ ] Second email received
- [ ] Email contains valid magic link
- [ ] Check email logs:
  ```sql
  SELECT * FROM email_events WHERE recipient = 'test-sales-TIMESTAMP@example.com';
  ```

---

## Regression Tests

### Test: Existing features still work

- [ ] **Dashboard login**: Existing users can still login
- [ ] **Call management**: Existing accounts can view/manage calls
- [ ] **Billing portal**: Stripe customer portal still accessible
- [ ] **Settings update**: Account settings can be updated

---

## Performance Tests

- [ ] **Signup latency**: Complete signup in <5 seconds (excluding Vapi)
- [ ] **Vapi provisioning**: Complete within 60 seconds
- [ ] **Email delivery**: Received within 2 minutes

---

## Cleanup After Testing

```sql
-- Delete test accounts
DELETE FROM accounts WHERE company_name LIKE 'Test%' OR company_name LIKE 'Jane''s%';

-- Delete test users
DELETE FROM auth.users WHERE email LIKE 'test-%@example.com';

-- Delete test provisioning jobs
DELETE FROM provisioning_jobs WHERE created_at > NOW() - INTERVAL '1 hour';
```

```bash
# Delete test Stripe customers
stripe customers list --limit 100 | jq -r '.data[] | select(.email | startswith("test-")) | .id' | xargs -I {} stripe customers delete {}
```

---

**Test Completed By**: _______________
**Date**: _______________
**Pass/Fail**: _______________
**Notes**: _______________
```

---

## File Changes Summary

| File | Type | Lines | Phase | Description |
|------|------|-------|-------|-------------|
| **Migrations** ||||
| `20251120000001_unified_signup_schema.sql` | New | ~50 | 1 | Add signup_channel, sales_rep_id, provisioning_stage |
| `20251120000002_orphaned_resources.sql` | New | ~30 | 1 | Create orphaned_stripe_resources table |
| `20251120000003_provisioning_state_transitions.sql` | New | ~70 | 1 | Create state machine tables |
| `20251120000004_profiles_signup_channel.sql` | New | ~20 | 1 | Add signup_channel to profiles |
| `20251120000005_dedupe_phone_fields.sql` | New | ~20 | 1 | Remove duplicate phone columns |
| `20251120000006_create_account_transaction.sql` | New | ~130 | 2 | Atomic account creation stored procedure |
| **Edge Functions** ||||
| `create-trial/index.ts` | Modify | ~400 | 2 | Idempotency, rollback, transactions |
| `_shared/email-service.ts` | New | ~120 | 3 | Automated customer email flow |
| `_shared/state-transitions.ts` | New | ~40 | 4 | State transition helper |
| `provision-resources/index.ts` | Modify | ~300 | 4 | Async Vapi provisioning with retry |
| **Frontend** ||||
| `src/lib/correlationId.ts` | New | ~40 | 5 | Correlation ID utility |
| `src/integrations/supabase/client.ts` | Modify | ~10 | 5 | Add correlation ID header |
| `src/components/SalesSignupForm.tsx` | Modify | ~20 | 5 | Pass sales_rep_id from session |
| `src/components/signup/TrialSignupFlow.tsx` | Modify | ~10 | 5 | Pass signup_channel='self_service' |
| `src/components/SalesSuccessModal.tsx` | Modify | ~50 | 3 | Replace password with email confirmation |
| **Tests** ||||
| `_tests/create-trial.test.ts` | New | ~150 | 6 | Deno unit tests |
| `MANUAL_TEST_CHECKLIST.md` | New | ~400 | 6 | Manual testing guide |
| **Total** | | **~1,860 lines** | | Across 17 files |

---

## Success Metrics (Updated)

| Metric | Current | Target | How to Measure |
|--------|---------|--------|----------------|
| **Orphaned Stripe customers** | ~5-10/week | 0/week | Query `orphaned_stripe_resources` table |
| **Incomplete accounts (no profile)** | ~2-3/week | 0/week | `SELECT COUNT(*) FROM accounts a LEFT JOIN profiles p ON a.id = p.account_id WHERE p.id IS NULL` |
| **Provisioning failures** | ~30% (Vapi disabled) | <5% | `SELECT status FROM provisioning_jobs WHERE created_at > NOW() - INTERVAL '7 days'` |
| **Signup completion time** | ~8-12s | <5s (with async Vapi) | Frontend timing + correlation ID tracing |
| **Sales rep onboarding** | Manual password handoff | Automated email | 100% of signups receive email within 2 min |
| **Time to debug signup issue** | ~30-60 min | <5 min | Correlation ID lookup in `provisioning_state_transitions` |

---

## Next Steps

1. ✅ **Spec approved** by user
2. **Begin Phase 1** (Database & Schema)
3. **Commit after each phase** with descriptive messages
4. **Test after each phase** before moving to next
5. **Deploy to staging** after Phase 2-4 complete
6. **Run full manual test checklist** on staging
7. **Deploy to production** with feature flag
8. **Monitor for 48 hours** before full rollout

---

**Status**: Ready for implementation
**Estimated Completion**: 3 weeks (1 week per phase 1-2, 1 week phases 3-6)
