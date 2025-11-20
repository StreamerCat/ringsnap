# Phase 1: Database Migrations - Application Guide

**Status**: ✅ Complete (6 migrations created)
**Date**: 2025-11-20
**Commit**: `27a40e6`

---

## Overview

This guide walks you through applying the 6 Phase 1 database migrations that establish the foundation for the unified signup engine.

### Migrations Summary

| # | Migration | Purpose | Size |
|---|-----------|---------|------|
| 1 | `20251120000001_unified_signup_schema.sql` | Add `signup_channel` & `sales_rep_id` | ~70 lines |
| 2 | `20251120000002_orphaned_resources.sql` | Track failed Stripe rollbacks | ~90 lines |
| 3 | `20251120000003_provisioning_state_transitions.sql` | Observable state machine | ~150 lines |
| 4 | `20251120000004_profiles_signup_channel.sql` | Add channel to profiles | ~50 lines |
| 5 | `20251120000005_dedupe_phone_fields.sql` | Clean up duplicate phone fields | ~120 lines |
| 6 | `20251120000006_create_account_transaction.sql` | Atomic account creation | ~250 lines |

**Total**: 730 lines of production-ready SQL

---

## Prerequisites

Before applying migrations:

1. **Backup your database** (production/staging)
   ```bash
   # For Supabase projects, backups are automatic but verify:
   # Dashboard → Settings → Backups
   ```

2. **Install Supabase CLI** (if not already installed)
   ```bash
   npm install -g supabase
   # Or use npx for one-off commands
   ```

3. **Link to your Supabase project** (if not already linked)
   ```bash
   npx supabase link --project-ref YOUR_PROJECT_REF
   ```

---

## Step 1: Review Migrations (Local)

Before applying, review each migration file to understand changes:

```bash
# Review all migrations
ls -la supabase/migrations/202511200000*.sql

# View specific migration
cat supabase/migrations/20251120000001_unified_signup_schema.sql
```

### Key Changes to Review:

- **Migration 1**: Adds new enum types and columns. **Does NOT drop old columns** (`source`, `sales_rep_name`) for safety.
- **Migration 5**: Renames `phone_number_e164` → `phone_number`. Check for hardcoded column references in your code.
- **Migration 6**: Creates stored procedures that directly manipulate `auth.users`. Ensure you have `SECURITY DEFINER` permissions.

---

## Step 2: Apply to Local Database (Testing)

### Option A: Using Supabase CLI (Recommended)

```bash
# Start local Supabase (if not already running)
npx supabase start

# Apply migrations to local database
npx supabase db push

# Verify migrations applied
npx supabase db diff

# Check database status
npx supabase status
```

### Option B: Using psql Directly

```bash
# If you have direct PostgreSQL access
psql -h localhost -U postgres -d postgres -f supabase/migrations/20251120000001_unified_signup_schema.sql
psql -h localhost -U postgres -d postgres -f supabase/migrations/20251120000002_orphaned_resources.sql
psql -h localhost -U postgres -d postgres -f supabase/migrations/20251120000003_provisioning_state_transitions.sql
psql -h localhost -U postgres -d postgres -f supabase/migrations/20251120000004_profiles_signup_channel.sql
psql -h localhost -U postgres -d postgres -f supabase/migrations/20251120000005_dedupe_phone_fields.sql
psql -h localhost -U postgres -d postgres -f supabase/migrations/20251120000006_create_account_transaction.sql
```

---

## Step 3: Verify Migrations (Local Testing)

After applying migrations, verify the schema changes:

### A. Check New Enum Types

```sql
-- Check signup_channel_type enum
SELECT enum_range(NULL::signup_channel_type);
-- Expected: {self_service,sales_guided,enterprise}

-- Check provisioning_stage enum
SELECT enum_range(NULL::provisioning_stage);
-- Expected: {account_created,stripe_linked,email_sent,...}
```

### B. Check New Tables

```sql
-- Verify orphaned_stripe_resources table
\d public.orphaned_stripe_resources

-- Verify provisioning_state_transitions table
\d public.provisioning_state_transitions
```

### C. Check New Columns

```sql
-- Verify accounts table changes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'accounts' AND column_name IN ('signup_channel', 'sales_rep_id', 'provisioning_stage');

-- Verify profiles table changes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'signup_channel';
```

### D. Check New Functions

```sql
-- List new stored procedures
\df public.create_account_transaction
\df public.log_state_transition
\df public.email_exists
\df public.get_account_by_email
```

### E. Check New Views

```sql
-- List new views
\dv public.sales_rep_performance
\dv public.account_provisioning_timeline
\dv public.stuck_provisioning_accounts
\dv public.user_signup_analytics
```

---

## Step 4: Test Stored Procedures (Local)

Test the atomic account transaction function:

```sql
-- Test 1: Create test account
SELECT public.create_account_transaction(
  'test@example.com',                -- p_email
  'TestPassword123!',                -- p_password
  'cus_test_stripe_id',              -- p_stripe_customer_id
  'sub_test_stripe_id',              -- p_stripe_subscription_id
  'self_service'::signup_channel_type, -- p_signup_channel
  NULL,                              -- p_sales_rep_id
  jsonb_build_object(
    'name', 'Test User',
    'phone', '+15555551234',
    'company_name', 'Test Company',
    'trade', 'HVAC',
    'plan_type', 'starter',
    'phone_number_area_code', '555',
    'zip_code', '94102',
    'assistant_gender', 'female',
    'wants_advanced_voice', false
  ),                                 -- p_account_data
  gen_random_uuid()::text            -- p_correlation_id
);

-- Test 2: Verify account created
SELECT a.id, a.company_name, a.signup_channel, a.provisioning_stage
FROM accounts a
WHERE a.company_name = 'Test Company';

-- Test 3: Verify profile created
SELECT p.id, p.name, p.signup_channel
FROM profiles p
JOIN accounts a ON a.id = p.account_id
WHERE a.company_name = 'Test Company';

-- Test 4: Verify state transition logged
SELECT pst.from_stage, pst.to_stage, pst.triggered_by
FROM provisioning_state_transitions pst
JOIN accounts a ON a.id = pst.account_id
WHERE a.company_name = 'Test Company';

-- Test 5: Check idempotency (should fail with "Email already registered")
SELECT public.create_account_transaction(
  'test@example.com',  -- Same email
  'DifferentPass',
  'cus_different',
  'sub_different',
  'sales_guided'::signup_channel_type,
  NULL,
  jsonb_build_object('name', 'Different', 'company_name', 'Different Co'),
  gen_random_uuid()::text
);

-- Cleanup test data
DELETE FROM provisioning_state_transitions WHERE account_id IN (
  SELECT id FROM accounts WHERE company_name = 'Test Company'
);
DELETE FROM user_roles WHERE user_id IN (
  SELECT p.id FROM profiles p JOIN accounts a ON a.id = p.account_id WHERE a.company_name = 'Test Company'
);
DELETE FROM profiles WHERE account_id IN (
  SELECT id FROM accounts WHERE company_name = 'Test Company'
);
DELETE FROM accounts WHERE company_name = 'Test Company';
DELETE FROM auth.users WHERE email = 'test@example.com';
```

---

## Step 5: Regenerate TypeScript Types

After migrations are applied and verified:

```bash
# Generate updated types from your database schema
npx supabase gen types typescript --linked > src/integrations/supabase/types.ts

# Verify the generated file
cat src/integrations/supabase/types.ts | grep -A 5 "signup_channel"
cat src/integrations/supabase/types.ts | grep -A 5 "provisioning_stage"
```

### Verify Key Types:

```typescript
// Should see in types.ts:
export type SignupChannelType = 'self_service' | 'sales_guided' | 'enterprise';

export type ProvisioningStage =
  | 'account_created'
  | 'stripe_linked'
  | 'email_sent'
  | 'password_set'
  | 'vapi_queued'
  // ... etc

// accounts table should have:
signup_channel: SignupChannelType;
sales_rep_id: string | null;
provisioning_stage: ProvisioningStage;

// profiles table should have:
signup_channel: SignupChannelType;
```

---

## Step 6: Apply to Staging Environment

Once local testing passes:

```bash
# Link to staging project
npx supabase link --project-ref YOUR_STAGING_PROJECT_REF

# Apply migrations to staging
npx supabase db push

# Verify in Supabase Dashboard:
# 1. Go to Database → Migrations
# 2. Verify all 6 migrations applied successfully
# 3. Check "Applied at" timestamps
```

### Post-Migration Checks (Staging):

1. **Check existing accounts migrated correctly**:
   ```sql
   -- All accounts should have signup_channel populated
   SELECT signup_channel, COUNT(*) FROM accounts GROUP BY signup_channel;

   -- Should see counts for each channel, no NULLs
   ```

2. **Check profiles migrated correctly**:
   ```sql
   -- All profiles should have signup_channel
   SELECT signup_channel, COUNT(*) FROM profiles GROUP BY signup_channel;
   ```

3. **Check for orphaned records** (should be empty initially):
   ```sql
   SELECT * FROM orphaned_stripe_resources;
   SELECT * FROM stuck_provisioning_accounts;
   ```

---

## Step 7: Apply to Production

**⚠️ CRITICAL: Only proceed after staging is verified working for 24-48 hours**

### Pre-Production Checklist:

- [ ] All 6 migrations tested on staging
- [ ] Existing data migrated correctly (no NULL values)
- [ ] Stored procedures tested with real data
- [ ] TypeScript types regenerated and committed
- [ ] No errors in staging logs for 24+ hours
- [ ] Rollback plan prepared (Supabase auto-backups)

### Apply to Production:

```bash
# Link to production project
npx supabase link --project-ref YOUR_PRODUCTION_PROJECT_REF

# Final review
npx supabase db diff

# Apply migrations
npx supabase db push

# Monitor logs immediately
# Dashboard → Logs → API Logs
# Look for:
# - Migration errors
# - Function execution errors
# - Constraint violations
```

### Post-Production Monitoring:

**First 15 minutes**:
- [ ] Check Supabase dashboard for errors
- [ ] Verify new accounts can be created via frontend
- [ ] Check provisioning_state_transitions table populating

**First hour**:
- [ ] Monitor error rates in application logs
- [ ] Test sales-guided signup flow
- [ ] Test self-service signup flow
- [ ] Verify state transitions logging correctly

**First 24 hours**:
- [ ] Monitor stuck_provisioning_accounts view
- [ ] Check for orphaned_stripe_resources entries
- [ ] Verify sales_rep_performance analytics working

---

## Rollback Plan

If migrations cause issues:

### Option A: Supabase Dashboard Rollback

1. Go to **Dashboard → Database → Backups**
2. Select backup from before migration
3. Click **Restore**

### Option B: Manual Rollback (if needed)

Create a rollback migration:

```sql
-- 20251120999999_rollback_phase1.sql

-- Drop new functions
DROP FUNCTION IF EXISTS public.create_account_transaction CASCADE;
DROP FUNCTION IF EXISTS public.create_auth_user_internal CASCADE;
DROP FUNCTION IF EXISTS public.log_state_transition CASCADE;
DROP FUNCTION IF EXISTS public.email_exists CASCADE;
DROP FUNCTION IF EXISTS public.get_account_by_email CASCADE;

-- Drop new views
DROP VIEW IF EXISTS public.sales_rep_performance CASCADE;
DROP VIEW IF EXISTS public.account_provisioning_timeline CASCADE;
DROP VIEW IF EXISTS public.stuck_provisioning_accounts CASCADE;
DROP VIEW IF EXISTS public.user_signup_analytics CASCADE;
DROP VIEW IF EXISTS public.user_signup_details CASCADE;

-- Drop new tables
DROP TABLE IF EXISTS public.provisioning_state_transitions CASCADE;
DROP TABLE IF EXISTS public.orphaned_stripe_resources CASCADE;

-- Remove new columns (restore old columns)
ALTER TABLE public.accounts
  DROP COLUMN IF EXISTS provisioning_stage,
  DROP COLUMN IF EXISTS signup_channel,
  DROP COLUMN IF EXISTS sales_rep_id,
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS sales_rep_name TEXT;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS signup_channel,
  ADD COLUMN IF NOT EXISTS source TEXT;

-- Drop new enum types
DROP TYPE IF EXISTS provisioning_stage CASCADE;
DROP TYPE IF EXISTS signup_channel_type CASCADE;
```

**⚠️ WARNING**: Rolling back will lose data in new tables. Only do this in emergency.

---

## Common Issues & Solutions

### Issue 1: "permission denied for schema auth"

**Cause**: Stored procedures need `SECURITY DEFINER` to access `auth.users`.

**Solution**: Ensure you're running migrations with service_role key:
```bash
npx supabase db push --db-url "postgresql://postgres:[YOUR_PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres"
```

### Issue 2: "enum type already exists"

**Cause**: Migration already partially applied.

**Solution**: Check which enums exist:
```sql
SELECT typname FROM pg_type WHERE typname IN ('signup_channel_type', 'provisioning_stage');
```

If they exist, comment out the `CREATE TYPE` statements and re-run.

### Issue 3: "column signup_channel does not exist"

**Cause**: Migration 1 failed or didn't complete.

**Solution**: Re-run migration 1:
```bash
npx supabase db reset  # Resets local DB to match migrations
```

### Issue 4: TypeScript types out of sync

**Cause**: Types not regenerated after migrations.

**Solution**:
```bash
npx supabase gen types typescript --linked > src/integrations/supabase/types.ts
git add src/integrations/supabase/types.ts
git commit -m "Regenerate types after Phase 1 migrations"
```

---

## Verification Queries

### Check Migration Status

```sql
-- View applied migrations
SELECT * FROM supabase_migrations.schema_migrations
WHERE version >= '20251120000001'
ORDER BY version;
```

### Check Data Migration Success

```sql
-- All accounts should have signup_channel (no NULLs)
SELECT
  COUNT(*) AS total_accounts,
  COUNT(signup_channel) AS with_signup_channel,
  COUNT(*) - COUNT(signup_channel) AS missing_signup_channel
FROM accounts;

-- Breakdown by channel
SELECT signup_channel, COUNT(*) FROM accounts GROUP BY signup_channel;
```

### Check New Functionality

```sql
-- Test state transition logging
SELECT
  a.company_name,
  pst.from_stage,
  pst.to_stage,
  pst.triggered_by,
  pst.created_at
FROM provisioning_state_transitions pst
JOIN accounts a ON a.id = pst.account_id
ORDER BY pst.created_at DESC
LIMIT 10;

-- Test sales rep analytics
SELECT * FROM sales_rep_performance;

-- Test stuck account monitoring
SELECT * FROM stuck_provisioning_accounts;
```

---

## Next Steps

After Phase 1 migrations are complete:

1. ✅ **Commit regenerated types**
   ```bash
   git add src/integrations/supabase/types.ts
   git commit -m "Regenerate TypeScript types after Phase 1 migrations"
   git push
   ```

2. ✅ **Proceed to Phase 2**: Core Signup Engine
   - Update `create-trial` edge function
   - Implement idempotency checks
   - Add Stripe rollback logic
   - Use new `create_account_transaction()` stored procedure

3. ✅ **Update documentation**
   - Document new `signup_channel` enum values
   - Document new `provisioning_stage` flow
   - Update API documentation

---

## Support

If you encounter issues:

1. Check migration logs: `npx supabase db diff`
2. Review Supabase dashboard logs
3. Test stored procedures individually
4. Verify permissions on new tables/functions
5. Check for conflicting column names in old code

---

**Phase 1 Status**: ✅ Complete
**Migration Files**: 6 files, 730 lines SQL
**Commit**: `27a40e6`
**Next**: Phase 2 - Core Signup Engine Implementation
