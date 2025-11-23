# Go-Green Deployment Steps

## Changes Committed

All code changes have been committed to branch `claude/fix-ringsnap-go-green-01GR7RELVeDQHqNpxzkZsokC`:

1. ✅ Added deep logging to create-trial edge function
2. ✅ Fixed create_account_transaction to remove provisioning_stage
3. ✅ Disabled all client-side direct DB inserts
4. ✅ Committed and pushed to remote

## Required Manual Steps

### STEP 1: Apply Database Migration

The new migration file `20251123999998_fix_create_account_no_provisioning_stage.sql` fixes the `create_account_transaction` function to remove all references to the `provisioning_stage` enum (which was removed).

**Apply the migration:**

```bash
# Option A: Using Supabase CLI (if linked)
supabase db push

# Option B: Using Supabase Dashboard
# 1. Go to https://supabase.com/dashboard/project/lytnlrkdccqmxgdmdxef/editor
# 2. Open SQL Editor
# 3. Copy contents of supabase/migrations/20251123999998_fix_create_account_no_provisioning_stage.sql
# 4. Run the SQL

# Option C: Using psql directly
psql $DATABASE_URL -f supabase/migrations/20251123999998_fix_create_account_no_provisioning_stage.sql
```

### STEP 2: Deploy create-trial Edge Function

**Deploy the updated function:**

```bash
# Link project if needed
supabase link --project-ref lytnlrkdccqmxgdmdxef

# Deploy only create-trial function
supabase functions deploy create-trial

# Or deploy all functions
supabase functions deploy
```

### STEP 3: Test Signup Flow

**Run a test signup:**

```bash
# Use your frontend or make a direct API call
curl -X POST https://lytnlrkdccqmxgdmdxef.supabase.co/functions/v1/create-trial \
  -H "Content-Type: application/json" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "idempotency-key: test-$(date +%s)" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "phone": "+14155551234",
    "companyName": "Test Company",
    "trade": "plumbing",
    "planType": "starter",
    "paymentMethodId": "pm_card_visa",
    "source": "website"
  }'
```

**Check the logs:**

```bash
# View create-trial logs
supabase functions logs create-trial --follow

# Look for DB_CALL and DB_RESULT log entries
# These will show exactly what's being sent to the database
# and what errors are occurring
```

### STEP 4: Verify Success

Check that:

1. ✅ create-trial returns **200** (not 500)
2. ✅ No PostgreSQL errors in logs
3. ✅ No "column provisioning_stage does not exist" errors
4. ✅ No RLS policy violations
5. ✅ Account is created in database
6. ✅ User can sign in

**Query the database to verify:**

```sql
-- Check if account was created
SELECT id, company_name, provisioning_status, created_at
FROM accounts
WHERE stripe_customer_id = 'cus_XXX'  -- Use the customer ID from response
ORDER BY created_at DESC
LIMIT 1;

-- Check provisioning_jobs
SELECT *
FROM provisioning_jobs
WHERE account_id = 'ACCOUNT_ID_FROM_ABOVE'
ORDER BY created_at DESC;

-- Check for any errors in logs
SELECT *
FROM logs
WHERE level = 'error'
AND created_at > now() - interval '1 hour'
ORDER BY created_at DESC;
```

## What Was Fixed

### Issue 1: provisioning_stage Enum References
**Problem:** The `create_account_transaction` function referenced `provisioning_stage` enum type which was removed in a rollback.

**Fix:** Created migration `20251123999998_fix_create_account_no_provisioning_stage.sql` that:
- Drops the old function
- Recreates it without any `provisioning_stage` references
- Uses only `provisioning_status` (text field with values: pending, provisioning, active, failed)
- Removes the provisioning_state_transitions logging step

### Issue 2: Missing Error Details in Logs
**Problem:** Logs only showed `error.message`, missing crucial details like constraint names, hints, and error codes.

**Fix:** Added comprehensive logging in `create-trial/index.ts`:
- Before each DB operation: log the full payload
- After each DB operation: log full error object including:
  - `error.message`
  - `error.details`
  - `error.hint`
  - `error.code`
  - Full error object for debugging

### Issue 3: Client-Side Direct Inserts
**Problem:** Frontend components were making direct PostgREST calls to insert into `signup_leads` and `accounts`, bypassing edge function validation and causing RLS violations.

**Fix:** Disabled all client-side inserts in:
- `src/components/onboarding/SelfServeTrialFlow.tsx`
- `src/components/signup/TrialSignupFlow.tsx`
- `src/components/wizard/SalesSignupWizard.tsx`

All writes now go through edge functions only.

## Next Steps After Deployment

Once deployed and verified:

1. Monitor logs for any new issues
2. Run multiple test signups to ensure consistency
3. Check that provisioning jobs are being created
4. Verify Stripe webhooks are working
5. Test the full end-to-end flow including email delivery

## Rollback Plan

If issues persist:

```bash
# Rollback the migration
# Restore the previous version of create_account_transaction
# (Contact DBA or use git to find previous migration)

# Rollback edge function deployment
supabase functions deploy create-trial --version PREVIOUS_VERSION
```
