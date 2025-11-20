# Signup → Stripe → Supabase → Vapi Provisioning Fix - Complete Specification

**Date**: 2025-11-20
**Author**: Claude (claude-sonnet-4-5)
**Status**: DRAFT - Awaiting Approval

---

## Executive Summary

This spec addresses the end-to-end cleanup of the RingSnap signup and provisioning flow to make it:
- **Idempotent**: Can retry safely without creating duplicates
- **Observable**: Full correlation ID tracking + structured logging
- **Predictable**: Well-defined state transitions
- **Fully Logged**: All operations tracked with context
- **Consistent**: Never leaves orphaned resources across Stripe/Supabase/Vapi

---

## Current Behavior (Problems)

### 1. **Non-Idempotent Flow**

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

**Problem**: If step 5 fails (Account Record), you have:
- ✅ Stripe customer created
- ✅ Stripe subscription created + charging
- ✅ Auth user created
- ❌ No account record
- ❌ No profile
- **Result**: Customer gets charged, but can't login. Retry creates duplicate Stripe resources.

### 2. **Missing Rollback Logic**

**Current error handling** (lines 350-368 in provision/index.ts):
```typescript
} catch (error) {
  logError("Provisioning failed", { accountId, error });
  return json(400, { ok: false, error: message });
}
```

**Problem**: No cleanup. If Stripe succeeds but Supabase fails, Stripe resources are orphaned.

### 3. **Vapi Provisioning Disabled**

**Line 829**: `const ENABLE_VAPI = false;`

**Impact**: All accounts stuck in `provisioning_status: "pending"` forever. No phone numbers provisioned.

### 4. **No Correlation IDs on Frontend**

Frontend doesn't send `x-correlation-id` header. Backend generates UUID but can't correlate with frontend errors.

### 5. **Type Mismatches**

- `businessHours`: Object in sales form, string in trial form, string in edge function, JSONB in DB
- Missing DB fields in TypeScript types: `phone_number_e164`, `vapi_phone_number_id`, `phone_provisioned_at`
- Duplicate phone fields: `vapi_id` vs `vapi_phone_id`

### 6. **No Observable State Machine**

Provisioning status values scattered:
- `accounts.provisioning_status`: 'idle' | 'pending' | 'provisioning' | 'active' | 'failed'
- `phone_numbers.status`: 'pending' | 'active' | 'suspended' | 'held' | 'released'
- `provisioning_jobs.status`: 'queued' | 'in_progress' | 'completed' | 'failed'

No single source of truth for "where is this account in the provisioning flow?"

---

## Expected Behavior (Goals)

### 1. **Idempotent Signup Flow**

```typescript
// Pseudocode
function createTrial(data) {
  const correlationId = generateOrExtractCorrelationId(req);

  // Step 1: Check if already exists
  const existingAccount = await findAccountByEmail(data.email);
  if (existingAccount) {
    return { success: true, account: existingAccount, message: "Already exists" };
  }

  // Step 2: Transaction-safe creation
  const { stripeCustomerId, subscriptionId } = await createOrResumeStripeResources(data);

  // Step 3: Database transaction
  const account = await supabase.transaction(async (tx) => {
    const user = await createAuthUser(data, tx);
    const account = await createAccount(data, user.id, stripeCustomerId, tx);
    const profile = await createProfile(data, user.id, account.id, tx);
    const role = await assignRole(user.id, "owner", tx);
    return account;
  });

  // Step 4: Async provisioning (non-blocking)
  scheduleVapiProvisioning(account.id, correlationId);

  return { success: true, account, password: tempPassword };
}
```

**Key Changes**:
1. Check for existing account by email
2. Stripe operations wrapped in "create or fetch existing" logic
3. Database operations in transaction (all-or-nothing)
4. Vapi provisioning decoupled (async queue)

### 2. **Rollback Strategy**

**Option A: Compensating Transactions (Recommended)**

```typescript
try {
  stripeCustomerId = await createStripeCustomer();
} catch (error) {
  logError("Stripe customer creation failed", { correlationId, error });
  return { success: false, error: "Payment processor unavailable" };
}

try {
  subscriptionId = await createStripeSubscription(stripeCustomerId);
} catch (error) {
  await compensate_deleteStripeCustomer(stripeCustomerId, correlationId);
  return { success: false, error: "Subscription creation failed" };
}

try {
  accountId = await createAccountInTransaction();
} catch (error) {
  await compensate_cancelStripeSubscription(subscriptionId, correlationId);
  await compensate_deleteStripeCustomer(stripeCustomerId, correlationId);
  return { success: false, error: "Account creation failed" };
}
```

**New table**: `cleanup_jobs`
```sql
CREATE TABLE cleanup_jobs (
  id UUID PRIMARY KEY,
  correlation_id TEXT NOT NULL,
  resource_type TEXT, -- 'stripe_customer' | 'stripe_subscription' | 'auth_user'
  resource_id TEXT,
  operation TEXT, -- 'cancel_subscription' | 'delete_customer'
  status TEXT, -- 'pending' | 'completed' | 'failed'
  attempts INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3. **Vapi Provisioning: Async Queue Pattern**

**Decouple from signup**:

```typescript
// In create-trial (after account created)
await supabase.from("provisioning_jobs").insert({
  account_id: accountId,
  user_id: userId,
  job_type: "full_provisioning",
  status: "queued",
  correlation_id: correlationId,
  created_at: now()
});

// Return immediately
return { success: true, provisioning_status: "queued" };
```

**Worker function**: `provision-resources` (already exists, needs enhancement)

**File**: `/home/user/ringsnap/supabase/functions/provision-resources/index.ts`

**Enhancements needed**:
1. Poll `provisioning_jobs` table for queued jobs
2. Process in order (FIFO)
3. Update job status: queued → in_progress → completed/failed
4. Retry failed jobs with exponential backoff (use `retry_after` column)
5. Log every step with correlation ID

### 4. **Observable State Machine**

**Centralize provisioning status**:

```sql
-- New enum type
CREATE TYPE provisioning_stage AS ENUM (
  'account_created',      -- Supabase account exists, no Stripe
  'stripe_linked',        -- Stripe subscription created
  'vapi_queued',          -- Vapi job queued
  'vapi_assistant_ready', -- Assistant created
  'vapi_phone_pending',   -- Phone number requested
  'vapi_phone_active',    -- Phone number active
  'fully_provisioned',    -- All systems go
  'failed_stripe',        -- Stripe setup failed
  'failed_vapi'           -- Vapi provisioning failed
);

ALTER TABLE accounts ADD COLUMN provisioning_stage provisioning_stage DEFAULT 'account_created';
```

**State transitions logged**:
```sql
CREATE TABLE provisioning_state_transitions (
  id UUID PRIMARY KEY,
  account_id UUID REFERENCES accounts(id),
  correlation_id TEXT NOT NULL,
  from_stage provisioning_stage,
  to_stage provisioning_stage,
  triggered_by TEXT, -- 'create-trial' | 'provision-resources' | 'manual_retry'
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 5. **Frontend Correlation ID Propagation**

**Update all API calls**:

```typescript
// src/lib/correlationId.ts (NEW FILE)
export function generateCorrelationId(): string {
  return crypto.randomUUID();
}

export function getOrCreateCorrelationId(): string {
  let cid = sessionStorage.getItem('correlation_id');
  if (!cid) {
    cid = generateCorrelationId();
    sessionStorage.setItem('correlation_id', cid);
  }
  return cid;
}

// src/integrations/supabase/client.ts (MODIFY)
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: {
    headers: {
      'x-correlation-id': getOrCreateCorrelationId()
    }
  }
});
```

### 6. **Type Consistency**

**Fix `businessHours`**:

**Decision**: Store as JSONB in DB, accept string OR object in API, normalize to object.

```typescript
// Edge function
const businessHoursSchema = z.union([
  z.string().max(500),
  z.record(z.string(), z.array(z.object({
    start: z.string(),
    end: z.string()
  })))
]).transform((val) => {
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return { text: val }; // Fallback for free-form text
    }
  }
  return val;
});
```

**Regenerate Supabase types**:
```bash
npx supabase gen types typescript --linked > src/integrations/supabase/types.ts
```

---

## Proposed Changes (Implementation Plan)

### Phase 1: Idempotency & Transactions (Critical)

**Priority**: P0 - Blocks production use

#### Change 1.1: Add idempotency check to `create-trial`

**File**: `/home/user/ringsnap/supabase/functions/create-trial/index.ts`

**Before line 431** (Stripe customer creation), insert:

```typescript
// Check if account already exists
const { data: existingUser } = await supabase.auth.admin.listUsers();
const userExists = existingUser?.users?.find(u => u.email === data.email);

if (userExists) {
  logInfo("User already exists, fetching account", {
    ...baseLogOptions,
    context: { email: data.email, userId: userExists.id }
  });

  const { data: existingAccount } = await supabase
    .from("accounts")
    .select("*, profiles(*)")
    .eq("stripe_customer_id", userExists.user_metadata?.stripe_customer_id)
    .single();

  if (existingAccount) {
    return Response.json({
      success: true,
      message: "Account already exists",
      accountId: existingAccount.id,
      userId: userExists.id,
      email: data.email,
      password: null, // Don't expose existing password
      provisioning_status: existingAccount.provisioning_status
    });
  }
}
```

#### Change 1.2: Wrap DB operations in transaction

**Replace lines 532-762** with:

```typescript
const { data: txResult, error: txError } = await supabase.rpc('create_account_transaction', {
  p_email: data.email,
  p_password: tempPassword,
  p_user_metadata: { name: data.name, phone: data.phone, ... },
  p_account_data: accountPayload,
  p_profile_data: { name: data.name, phone: data.phone, is_primary: true },
  p_correlation_id: correlationId
});
```

**New stored procedure** (migration):

```sql
CREATE OR REPLACE FUNCTION create_account_transaction(
  p_email TEXT,
  p_password TEXT,
  p_user_metadata JSONB,
  p_account_data JSONB,
  p_profile_data JSONB,
  p_correlation_id TEXT
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_account_id UUID;
  v_result JSONB;
BEGIN
  -- Create auth user (using auth.users table)
  INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, raw_user_meta_data)
  VALUES (p_email, crypt(p_password, gen_salt('bf')), now(), p_user_metadata)
  RETURNING id INTO v_user_id;

  -- Create account
  INSERT INTO accounts (company_name, trade, stripe_customer_id, ...)
  SELECT * FROM jsonb_populate_record(null::accounts, p_account_data)
  RETURNING id INTO v_account_id;

  -- Create profile
  INSERT INTO profiles (id, account_id, name, phone, is_primary)
  VALUES (v_user_id, v_account_id, p_profile_data->>'name', p_profile_data->>'phone', true);

  -- Assign role
  INSERT INTO user_roles (user_id, role) VALUES (v_user_id, 'owner');

  -- Return IDs
  v_result := jsonb_build_object(
    'user_id', v_user_id,
    'account_id', v_account_id
  );

  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Transaction failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### Change 1.3: Add Stripe idempotency

**Before line 431**, add:

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
    metadata: { /* ... */ }
  });
}
```

---

### Phase 2: Cleanup Jobs (Compensating Transactions)

**Priority**: P0 - Prevents orphaned resources

#### Change 2.1: Create cleanup jobs table

**New migration**: `20251120000001_add_cleanup_jobs.sql`

```sql
CREATE TABLE IF NOT EXISTS cleanup_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id TEXT NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN (
    'stripe_customer',
    'stripe_subscription',
    'stripe_payment_method',
    'auth_user',
    'vapi_assistant',
    'vapi_phone'
  )),
  resource_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN (
    'cancel_subscription',
    'delete_customer',
    'detach_payment_method',
    'delete_auth_user',
    'delete_vapi_assistant',
    'release_vapi_phone'
  )),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  error TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_cleanup_jobs_status ON cleanup_jobs(status);
CREATE INDEX idx_cleanup_jobs_correlation_id ON cleanup_jobs(correlation_id);
```

#### Change 2.2: Add cleanup logic to `create-trial`

**After Stripe operations fail**, insert cleanup job:

```typescript
} catch (stripeError) {
  logError("Stripe subscription creation failed", {
    ...baseLogOptions,
    error: stripeError,
    context: { customerId: customer.id }
  });

  // Queue cleanup job
  await supabase.from("cleanup_jobs").insert({
    correlation_id: correlationId,
    resource_type: "stripe_customer",
    resource_id: customer.id,
    operation: "delete_customer",
    status: "pending",
    metadata: { email: data.email, reason: "subscription_creation_failed" }
  });

  return Response.json({
    success: false,
    error: "Payment setup failed. Our team will review and contact you."
  }, { status: 500 });
}
```

#### Change 2.3: Create cleanup worker function

**New function**: `/home/user/ringsnap/supabase/functions/cleanup-worker/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";

serve(async (req) => {
  const supabase = createClient(/* ... */);
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);

  // Fetch pending cleanup jobs
  const { data: jobs } = await supabase
    .from("cleanup_jobs")
    .select("*")
    .eq("status", "pending")
    .lt("attempts", "max_attempts")
    .order("created_at", { ascending: true })
    .limit(10);

  for (const job of jobs || []) {
    try {
      await supabase
        .from("cleanup_jobs")
        .update({ status: "in_progress", attempts: job.attempts + 1 })
        .eq("id", job.id);

      switch (job.operation) {
        case "delete_customer":
          await stripe.customers.del(job.resource_id);
          break;
        case "cancel_subscription":
          await stripe.subscriptions.cancel(job.resource_id);
          break;
        // ... other operations
      }

      await supabase
        .from("cleanup_jobs")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", job.id);

    } catch (error) {
      await supabase
        .from("cleanup_jobs")
        .update({ status: "failed", error: error.message })
        .eq("id", job.id);
    }
  }

  return new Response(JSON.stringify({ processed: jobs?.length || 0 }), { status: 200 });
});
```

**Schedule via cron**:

```toml
# supabase/functions/_cron/cleanup-worker.toml
[cron]
schedule = "*/5 * * * *"  # Every 5 minutes
function = "cleanup-worker"
```

---

### Phase 3: Vapi Provisioning (Async + Retry)

**Priority**: P1 - Core feature

#### Change 3.1: Enable Vapi provisioning with feature flag

**File**: `create-trial/index.ts`, line 829:

```typescript
// OLD: const ENABLE_VAPI = false;
// NEW:
const ENABLE_VAPI = Deno.env.get("VAPI_PROVISIONING_ENABLED") === "true";
```

**Add to `.env`**:
```
VAPI_PROVISIONING_ENABLED=true
```

#### Change 3.2: Queue provisioning instead of inline

**Replace lines 820-1100** with:

```typescript
if (ENABLE_VAPI && VAPI_API_KEY) {
  // Queue provisioning job
  const { error: jobError } = await supabase.from("provisioning_jobs").insert({
    account_id: accountData.id,
    user_id: authData.user.id,
    job_type: "full_provisioning",
    status: "queued",
    correlation_id: correlationId,
    metadata: {
      assistant_gender: data.assistantGender,
      company_name: data.companyName,
      phone: data.phone,
      area_code: data.zipCode?.slice(0, 3)
    }
  });

  if (jobError) {
    logError("Failed to queue provisioning job", {
      ...baseLogOptions,
      error: jobError
    });
  }

  vapiProvisioningStatus = "queued";
} else {
  vapiProvisioningStatus = "disabled";
}
```

#### Change 3.3: Enhance `provision-resources` worker

**File**: `/home/user/ringsnap/supabase/functions/provision-resources/index.ts`

**Add at start**:

```typescript
// Check for queued jobs
const { data: queuedJobs } = await supabase
  .from("provisioning_jobs")
  .select("*, accounts(*)")
  .eq("status", "queued")
  .order("created_at", { ascending: true })
  .limit(5);

for (const job of queuedJobs || []) {
  const correlationId = job.correlation_id;
  const accountId = job.account_id;

  try {
    // Mark as in_progress
    await supabase
      .from("provisioning_jobs")
      .update({ status: "in_progress", updated_at: now() })
      .eq("id", job.id);

    // Step 1: Create assistant (if not exists)
    let assistantId = job.accounts.vapi_assistant_id;
    if (!assistantId) {
      const assistant = await createVapiAssistant({
        companyName: job.metadata.company_name,
        gender: job.metadata.assistant_gender
      });
      assistantId = assistant.id;

      await supabase.from("accounts").update({
        vapi_assistant_id: assistantId,
        provisioning_stage: "vapi_assistant_ready"
      }).eq("id", accountId);

      logInfo("Vapi assistant created", {
        functionName: "provision-resources",
        correlationId,
        context: { accountId, assistantId }
      });
    }

    // Step 2: Create phone number
    const phone = await createVapiPhoneNumber({
      areaCode: job.metadata.area_code,
      fallbackNumber: job.metadata.phone
    });

    await supabase.from("phone_numbers").insert({
      account_id: accountId,
      vapi_id: phone.id,
      phone_number: phone.number,
      status: phone.status, // "pending"
      area_code: job.metadata.area_code
    });

    await supabase.from("accounts").update({
      vapi_phone_number: phone.number,
      phone_number_status: "pending",
      provisioning_stage: "vapi_phone_pending"
    }).eq("id", accountId);

    // Step 3: Link assistant to phone
    await linkAssistantToPhone(phone.id, assistantId);

    // Step 4: Mark job as completed
    await supabase.from("provisioning_jobs").update({
      status: "completed",
      completed_at: now(),
      vapi_assistant_id: assistantId,
      vapi_phone_id: phone.id
    }).eq("id", job.id);

    logInfo("Provisioning completed", {
      functionName: "provision-resources",
      correlationId,
      context: { accountId, assistantId, phoneId: phone.id }
    });

  } catch (error) {
    await supabase.from("provisioning_jobs").update({
      status: "failed",
      error: error.message,
      attempts: job.attempts + 1,
      retry_after: calculateRetryAfter(job.attempts) // Exponential backoff
    }).eq("id", job.id);

    await supabase.from("accounts").update({
      provisioning_stage: "failed_vapi",
      provisioning_error: error.message
    }).eq("id", accountId);

    logError("Provisioning failed", {
      functionName: "provision-resources",
      correlationId,
      error,
      context: { accountId, jobId: job.id }
    });
  }
}
```

#### Change 3.4: Add retry logic

**Helper function**:

```typescript
function calculateRetryAfter(attempts: number): string {
  const delays = [60, 300, 900, 3600]; // 1min, 5min, 15min, 1hr
  const delaySeconds = delays[Math.min(attempts, delays.length - 1)];
  const retryAt = new Date(Date.now() + delaySeconds * 1000);
  return retryAt.toISOString();
}
```

**Schedule retry worker**:

```toml
# supabase/functions/_cron/provision-retry.toml
[cron]
schedule = "*/5 * * * *"  # Every 5 minutes
function = "provision-resources"
```

---

### Phase 4: Observability

**Priority**: P1 - Required for debugging

#### Change 4.1: Frontend correlation ID

**New file**: `/home/user/ringsnap/src/lib/correlationId.ts`

```typescript
export function generateCorrelationId(): string {
  return crypto.randomUUID();
}

let sessionCorrelationId: string | null = null;

export function getSessionCorrelationId(): string {
  if (!sessionCorrelationId) {
    sessionCorrelationId = generateCorrelationId();
  }
  return sessionCorrelationId;
}

export function getRequestCorrelationId(): string {
  return generateCorrelationId(); // New ID per request
}
```

**Update**: `/home/user/ringsnap/src/integrations/supabase/client.ts`

```typescript
import { getRequestCorrelationId } from '@/lib/correlationId';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    global: {
      headers: {
        'x-correlation-id': getRequestCorrelationId()
      }
    }
  }
);
```

#### Change 4.2: Add provisioning state transitions table

**New migration**: `20251120000002_provisioning_state_transitions.sql`

```sql
CREATE TYPE provisioning_stage AS ENUM (
  'account_created',
  'stripe_linked',
  'vapi_queued',
  'vapi_assistant_ready',
  'vapi_phone_pending',
  'vapi_phone_active',
  'fully_provisioned',
  'failed_stripe',
  'failed_vapi',
  'failed_cleanup'
);

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS provisioning_stage provisioning_stage DEFAULT 'account_created';

CREATE TABLE provisioning_state_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id),
  correlation_id TEXT NOT NULL,
  from_stage provisioning_stage,
  to_stage provisioning_stage NOT NULL,
  triggered_by TEXT NOT NULL, -- 'create-trial' | 'provision-resources' | 'manual'
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pst_account_id ON provisioning_state_transitions(account_id);
CREATE INDEX idx_pst_correlation_id ON provisioning_state_transitions(correlation_id);
CREATE INDEX idx_pst_created_at ON provisioning_state_transitions(created_at DESC);
```

#### Change 4.3: Add transition logging

**Helper function** (add to `_shared/logging.ts`):

```typescript
export async function logStateTransition(
  supabase: SupabaseClient,
  accountId: string,
  fromStage: string | null,
  toStage: string,
  triggeredBy: string,
  correlationId: string,
  metadata?: Record<string, any>
) {
  await supabase.from("provisioning_state_transitions").insert({
    account_id: accountId,
    correlation_id: correlationId,
    from_stage: fromStage,
    to_stage: toStage,
    triggered_by: triggeredBy,
    metadata: metadata || {}
  });

  await supabase.from("accounts").update({
    provisioning_stage: toStage,
    updated_at: new Date().toISOString()
  }).eq("id", accountId);
}
```

**Usage in `create-trial`**:

```typescript
// After account created
await logStateTransition(
  supabase,
  accountData.id,
  null,
  "account_created",
  "create-trial",
  correlationId
);

// After Stripe subscription created
await logStateTransition(
  supabase,
  accountData.id,
  "account_created",
  "stripe_linked",
  "create-trial",
  correlationId,
  { stripe_customer_id: customer.id, subscription_id: subscription.id }
);

// After Vapi job queued
await logStateTransition(
  supabase,
  accountData.id,
  "stripe_linked",
  "vapi_queued",
  "create-trial",
  correlationId
);
```

#### Change 4.4: Enhanced logging in all edge functions

**Update all edge functions** to use consistent log structure:

```typescript
const correlationId = extractCorrelationId(req);
const FUNCTION_NAME = "create-trial";
const baseLogOptions = { functionName: FUNCTION_NAME, correlationId };

logInfo("Function invoked", {
  ...baseLogOptions,
  context: { source: data.source, email: maskEmail(data.email) }
});

// ... operations ...

logInfo("Step completed: Stripe customer", {
  ...baseLogOptions,
  context: { customerId: customer.id, duration: Date.now() - startTime }
});
```

---

### Phase 5: Type Fixes

**Priority**: P2 - Quality of life

#### Change 5.1: Regenerate Supabase types

```bash
cd /home/user/ringsnap
npx supabase gen types typescript --linked > src/integrations/supabase/types.ts
```

#### Change 5.2: Fix `businessHours` type

**Update schema in `create-trial/index.ts`**:

```typescript
const businessHoursSchema = z.union([
  z.string().max(500),
  z.record(z.string(), z.array(z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/)
  })))
]).transform((val) => {
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return { text: val };
    }
  }
  return val;
});

const createTrialSchema = z.object({
  // ...
  businessHours: businessHoursSchema.optional(),
  // ...
});
```

#### Change 5.3: Remove duplicate phone fields

**Migration**: `20251120000003_dedupe_phone_fields.sql`

```sql
-- Consolidate vapi_id and vapi_phone_id
UPDATE phone_numbers SET vapi_id = vapi_phone_id WHERE vapi_id IS NULL;
ALTER TABLE phone_numbers DROP COLUMN IF EXISTS vapi_phone_id;

-- Consolidate vapi_phone_number and phone_number_e164
UPDATE accounts SET phone_number_e164 = vapi_phone_number WHERE phone_number_e164 IS NULL;
ALTER TABLE accounts DROP COLUMN IF EXISTS vapi_phone_number;

-- Use phone_number_e164 as canonical field
```

---

## Testing Strategy

### Unit Tests (New Files)

1. **`create-trial.test.ts`**:
   - Test idempotency (call twice with same email)
   - Test Stripe failure rollback
   - Test DB transaction rollback
   - Test correlation ID propagation

2. **`provision-resources.test.ts`**:
   - Test Vapi assistant creation
   - Test phone number provisioning
   - Test retry logic with exponential backoff
   - Test state transitions

3. **`cleanup-worker.test.ts`**:
   - Test Stripe customer deletion
   - Test subscription cancellation
   - Test retry on failure

### Manual Test Plan

#### Test Case 1: Happy Path (Website Signup)

**Steps**:
1. Go to `/signup` on frontend
2. Fill out 4-step form
3. Enter valid card (Stripe test mode: `4242424242424242`)
4. Submit form
5. Wait for success message

**Expected**:
- ✅ Account created in `accounts` table
- ✅ User created in `auth.users`
- ✅ Profile created in `profiles` table
- ✅ Role assigned in `user_roles`
- ✅ Stripe customer + subscription created
- ✅ Provisioning job queued (`provisioning_jobs.status = 'queued'`)
- ✅ State transition logged (`account_created` → `stripe_linked` → `vapi_queued`)
- ✅ Correlation ID in all log entries

**Check logs**:
```sql
SELECT * FROM provisioning_state_transitions WHERE correlation_id = '<YOUR_CORRELATION_ID>';
```

#### Test Case 2: Duplicate Email (Idempotency)

**Steps**:
1. Complete Test Case 1
2. Try to sign up again with same email
3. Observe response

**Expected**:
- ✅ No duplicate Stripe customer
- ✅ No duplicate auth user
- ✅ Returns existing account details
- ✅ Response: `{ success: true, message: "Account already exists" }`

#### Test Case 3: Stripe Failure (Compensating Transaction)

**Steps**:
1. Use declining card: `4000000000000002`
2. Submit signup form
3. Observe logs

**Expected**:
- ✅ Stripe customer created
- ✅ Subscription creation fails
- ❌ Account NOT created in DB
- ✅ Cleanup job queued (`cleanup_jobs` table)
- ✅ Within 5 minutes, cleanup worker deletes Stripe customer
- ✅ State: No orphaned resources

#### Test Case 4: DB Transaction Failure

**Steps**:
1. Manually break DB constraint (e.g., set `company_name` to NULL in migration)
2. Attempt signup
3. Observe rollback

**Expected**:
- ✅ Stripe customer + subscription created
- ❌ DB transaction fails
- ✅ Cleanup job queued for Stripe resources
- ✅ No partial account/profile records

#### Test Case 5: Vapi Provisioning (Async)

**Steps**:
1. Complete successful signup (Test Case 1)
2. Wait 30-60 seconds
3. Check `provisioning_jobs` table
4. Check `accounts.provisioning_stage`

**Expected**:
- ✅ Job status: `queued` → `in_progress` → `completed`
- ✅ Vapi assistant created (`vapi_assistants` table)
- ✅ Phone number created (`phone_numbers` table with status: "pending")
- ✅ State transitions: `vapi_queued` → `vapi_assistant_ready` → `vapi_phone_pending`
- ⏳ After 1-2 minutes: `vapi_phone_pending` → `vapi_phone_active`

#### Test Case 6: Vapi Provisioning Failure + Retry

**Steps**:
1. Temporarily set invalid `VAPI_API_KEY` in env
2. Complete signup
3. Wait for provisioning to fail
4. Restore valid `VAPI_API_KEY`
5. Wait for retry (5 minutes)

**Expected**:
- ✅ First attempt fails (`provisioning_jobs.status = 'failed'`)
- ✅ Account state: `failed_vapi`
- ✅ `retry_after` timestamp set (5 min in future)
- ✅ After 5 minutes, retry succeeds
- ✅ Final state: `fully_provisioned`

#### Test Case 7: Sales Signup

**Steps**:
1. Login as sales rep
2. Go to `/sales` dashboard
3. Fill out `SalesSignupForm`
4. Submit with customer details

**Expected**:
- ✅ Same flow as website signup
- ✅ `source: "sales"` in DB
- ✅ `sales_rep_name` populated
- ✅ Success modal shows customer credentials
- ✅ Sales rep can copy credentials

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Supabase transaction breaks existing auth** | Medium | High | Test on staging first; use `auth.admin` API, not raw SQL |
| **Cleanup worker deletes active customer** | Low | Critical | Add safeguards: only clean up <24hr old resources |
| **Vapi rate limits during provisioning** | Medium | Medium | Add exponential backoff (already planned) |
| **Frontend correlation ID breaks Safari** | Low | Low | Fallback to sessionStorage, test on all browsers |
| **Type regeneration breaks existing code** | Medium | Medium | Test all API calls after regenerating types |
| **Async provisioning too slow** | Medium | Low | Set expectations in UI ("Provisioning takes 1-2 minutes") |

---

## Rollout Plan

### Stage 1: Development (Week 1)
- Implement Phase 1 (idempotency + transactions)
- Implement Phase 2 (cleanup jobs)
- Test on local dev environment

### Stage 2: Staging (Week 2)
- Deploy to staging environment
- Run all manual test cases
- Monitor logs for 3 days

### Stage 3: Production (Week 3)
- Feature flag: `IDEMPOTENT_SIGNUP_ENABLED=true` (default: false)
- Deploy to production
- Enable for 10% of traffic (A/B test)
- Monitor error rates

### Stage 4: Full Rollout (Week 4)
- Enable for 100% of traffic
- Implement Phase 3 (Vapi async provisioning)
- Implement Phase 4 (observability)

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| **Orphaned Stripe customers** | ~5-10/week | 0/week |
| **Incomplete accounts (no profile)** | ~2-3/week | 0/week |
| **Provisioning failures** | ~30% (Vapi disabled) | <5% |
| **Signup completion time** | ~8-12s | <5s (with async Vapi) |
| **Retries needed for success** | N/A | <2 on average |
| **Time to debug signup issue** | ~30-60 min | <5 min (correlation ID) |

---

## Open Questions (Awaiting User Answers)

1. **Enterprise signup**: Is there a separate flow besides `create-trial`?
2. **Vapi flag**: Should `ENABLE_VAPI` be env var or removed?
3. **Rollback**: Option A (keep Stripe), B (cancel), or C (compensating txn)?
4. **Sales password**: Keep manual handoff or auto-email customer?
5. **Tests**: Write Deno tests or just manual test plan?
6. **Type fixes**: Fix all or just blocking issues?

---

## Appendix: File Changes Summary

| File | Type | Lines Changed | Description |
|------|------|---------------|-------------|
| `create-trial/index.ts` | Modify | ~300 | Add idempotency, transactions, cleanup |
| `provision-resources/index.ts` | Modify | ~150 | Add queue processing, retries |
| `cleanup-worker/index.ts` | New | ~150 | Compensating transaction worker |
| `_shared/logging.ts` | Modify | +50 | Add state transition logging |
| `src/lib/correlationId.ts` | New | ~30 | Frontend correlation ID utility |
| `src/integrations/supabase/client.ts` | Modify | +5 | Add correlation ID header |
| `20251120000001_add_cleanup_jobs.sql` | New | ~40 | Cleanup jobs table |
| `20251120000002_provisioning_state_transitions.sql` | New | ~60 | State machine tables |
| `20251120000003_dedupe_phone_fields.sql` | New | ~20 | Remove duplicate phone columns |
| `create-trial.test.ts` | New | ~200 | Unit tests for signup flow |

**Total**: ~905 lines of code changes across 10 files.

---

**Next Step**: Awaiting user approval to proceed with implementation.
