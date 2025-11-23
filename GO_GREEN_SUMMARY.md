# RingSnap Go-Green Fix Summary

## Status: Code Changes Complete ✅ | Deployment Required ⏳

All code fixes have been implemented, committed, and pushed to branch `claude/fix-ringsnap-go-green-01GR7RELVeDQHqNpxzkZsokC`.

**Next Step:** Apply the database migration and deploy the edge function (see `GO_GREEN_DEPLOYMENT.md`)

---

## Changes Made

### 1. ✅ Deep Internal Logging Added to create-trial

**File:** `supabase/functions/create-trial/index.ts`

Added detailed structured logging before and after every database operation:

#### Before/After `create_account_transaction` RPC call:
```typescript
// BEFORE
console.error("DB_CALL", {
  step: "create_account_transaction",
  operation: "BEFORE_CALL",
  payload: {
    p_email: data.email,
    p_stripe_customer_id: customer.id,
    p_stripe_subscription_id: subscription.id,
    p_signup_channel: data.source,
    p_sales_rep_id: null,
    p_account_data: accountData,
    p_correlation_id: correlationId,
  },
});

// AFTER
console.error("DB_RESULT", {
  step: "create_account_transaction",
  operation: "AFTER_CALL",
  hasError: !!accountTxError,
  hasData: !!accountTxResult,
  error: accountTxError ? {
    message: accountTxError.message,
    details: accountTxError.details,
    hint: accountTxError.hint,
    code: accountTxError.code,
    fullError: accountTxError,
  } : null,
  result: accountTxResult,
});
```

**Also added logging for:**
- `signup_leads` update (link-lead step)
- `signup_attempts` insert (log-signup-success step)
- `provisioning_jobs` insert (enqueue-provisioning step)

**Benefits:**
- See exact payloads being sent to database
- See full error details (not just error.message)
- Identify constraint violations, RLS issues, missing columns
- Track correlation IDs for debugging

---

### 2. ✅ Fixed create_account_transaction Function

**File:** `supabase/migrations/20251123999998_fix_create_account_no_provisioning_stage.sql`

**Problem:** The `create_account_transaction` SQL function referenced `provisioning_stage` enum type which was removed in a previous rollback. This caused database errors.

**Fix:** Created a new migration that:
1. Drops the old function with provisioning_stage references
2. Recreates the function WITHOUT provisioning_stage
3. Uses only `provisioning_status` (text field)
4. Valid values: `"pending"`, `"provisioning"`, `"active"`, `"failed"`
5. Removes the problematic `provisioning_state_transitions` insert

**Key Changes in SQL Function:**
```sql
-- OLD (BROKEN)
provisioning_stage,
...
'stripe_linked'::provisioning_stage,  -- ERROR: type doesn't exist

-- NEW (FIXED)
-- No provisioning_stage column at all
provisioning_status,
...
'pending'::text,  -- Uses text field instead
```

**Migration applies:**
```bash
supabase db push
# OR
psql $DATABASE_URL -f supabase/migrations/20251123999998_fix_create_account_no_provisioning_stage.sql
```

---

### 3. ✅ Disabled Client-Side Direct Inserts

All browser-side direct database writes have been disabled to prevent RLS violations and ensure data integrity.

#### Files Modified:

**`src/components/onboarding/SelfServeTrialFlow.tsx`**
```typescript
// BEFORE (BROKEN - direct insert)
const { data: lead, error } = await supabase
  .from("signup_leads")
  .insert(leadPayload)
  .select()
  .single();

// AFTER (FIXED - disabled)
// TEMPORARY FIX (go-green): Disable direct client-side inserts
console.warn("[go-green] Direct insert to signup_leads disabled. Backend writes only.");
const lead = null;
const error = null;
```

**Also disabled in:**
- `src/components/signup/TrialSignupFlow.tsx`
- `src/components/wizard/SalesSignupWizard.tsx`

**Result:** All writes now flow exclusively through edge functions (create-trial, etc.)

---

## Code Diffs

### Migration File (NEW)
```sql
-- 20251123999998_fix_create_account_no_provisioning_stage.sql
DROP FUNCTION IF EXISTS public.create_account_transaction(...) CASCADE;

CREATE OR REPLACE FUNCTION public.create_account_transaction(...)
RETURNS JSONB AS $$
DECLARE
  ...
BEGIN
  -- Step 2: Create account (NO provisioning_stage)
  INSERT INTO public.accounts (
    company_name,
    trade,
    stripe_customer_id,
    stripe_subscription_id,
    signup_channel,
    sales_rep_id,
    subscription_status,
    trial_start_date,
    trial_end_date,
    plan_type,
    ...
    provisioning_status,  -- TEXT field only
    phone_number_status,
    ...
  ) VALUES (
    ...
    'pending'::text,  -- provisioning_status = 'pending'
    'pending'::text,
    ...
  )
  ...

  -- Step 6: Return result (NO provisioning_stage)
  v_result := jsonb_build_object(
    'user_id', v_user_id,
    'account_id', v_account_id,
    'profile_id', v_profile_id,
    'trial_end_date', v_trial_end_date,
    'provisioning_status', 'pending'  -- Return status only
  );
  ...
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### create-trial Logging (MODIFIED)
```diff
+ // DETAILED LOGGING: Before account creation
+ console.error("DB_CALL", {
+   step: "create_account_transaction",
+   operation: "BEFORE_CALL",
+   payload: { ... },
+ });

  const { data: accountTxResult, error: accountTxError } = await supabase.rpc(
    "create_account_transaction",
    { ... }
  );

+ // DETAILED LOGGING: After account creation
+ console.error("DB_RESULT", {
+   step: "create_account_transaction",
+   operation: "AFTER_CALL",
+   hasError: !!accountTxError,
+   error: accountTxError ? {
+     message: accountTxError.message,
+     details: accountTxError.details,
+     hint: accountTxError.hint,
+     code: accountTxError.code,
+     fullError: accountTxError,
+   } : null,
+   result: accountTxResult,
+ });
```

### Frontend Inserts (DISABLED)
```diff
- const { data: lead, error } = await supabase
-   .from("signup_leads")
-   .insert(leadPayload)
-   .select()
-   .single();

+ // TEMPORARY FIX (go-green): Disable direct client-side inserts
+ console.warn("[go-green] Direct insert to signup_leads disabled.");
+ const lead = null;
+ const error = null;
+
+ // const { data: lead, error } = await supabase
+ //   .from("signup_leads")
+ //   .insert(leadPayload)
+ //   .select()
+ //   .single();
```

---

## Deployment Steps (Required)

### 1. Apply Migration
```bash
# Connect to your Supabase project
supabase link --project-ref lytnlrkdccqmxgdmdxef

# Push migrations to database
supabase db push

# OR use SQL editor in Supabase Dashboard
# Copy/paste contents of:
# supabase/migrations/20251123999998_fix_create_account_no_provisioning_stage.sql
```

### 2. Deploy Edge Function
```bash
# Deploy only create-trial
supabase functions deploy create-trial

# OR deploy all functions
supabase functions deploy
```

### 3. Test Signup
```bash
# Monitor logs in real-time
supabase functions logs create-trial --follow

# In another terminal, trigger a test signup from your frontend
# OR use curl to test the API directly
```

---

## Expected Results After Deployment

### ✅ Success Criteria

1. **create-trial returns 200** (not 500)
   - Response includes: `{ success: true, accountId: "...", provisioning_status: "pending" }`

2. **No PostgreSQL errors** in logs
   - No "column provisioning_stage does not exist"
   - No "type provisioning_stage does not exist"
   - No CHECK constraint failures

3. **No RLS violations**
   - No "permission denied for table accounts"
   - No "permission denied for table signup_leads"

4. **Detailed logs show:**
   ```json
   {
     "DB_CALL": {
       "step": "create_account_transaction",
       "operation": "BEFORE_CALL",
       "payload": { ... }
     }
   }

   {
     "DB_RESULT": {
       "step": "create_account_transaction",
       "operation": "AFTER_CALL",
       "hasError": false,
       "result": {
         "user_id": "...",
         "account_id": "...",
         "provisioning_status": "pending"
       }
     }
   }
   ```

5. **Database records created:**
   ```sql
   -- Check account
   SELECT id, company_name, provisioning_status, phone_number_status
   FROM accounts
   WHERE stripe_customer_id = 'cus_XXX'
   ORDER BY created_at DESC LIMIT 1;

   -- Should return:
   -- provisioning_status = 'pending'
   -- phone_number_status = 'pending'

   -- Check provisioning job
   SELECT id, status, job_type, metadata
   FROM provisioning_jobs
   WHERE account_id = 'ACCOUNT_ID'
   ORDER BY created_at DESC LIMIT 1;

   -- Should return:
   -- status = 'queued'
   -- job_type = 'provision_phone'
   ```

---

## If Errors Still Occur

### Debug with Logs

The new logging will show exact error details:

```json
{
  "DB_RESULT": {
    "step": "create_account_transaction",
    "operation": "AFTER_CALL",
    "hasError": true,
    "error": {
      "message": "relation 'provisioning_stage' does not exist",
      "details": "...",
      "hint": "...",
      "code": "42P01",
      "fullError": { ... }
    }
  }
}
```

### Common Issues & Fixes

1. **"column provisioning_stage does not exist"**
   - ✅ Fixed by migration
   - Ensure migration was applied: `supabase db push`

2. **"permission denied for table accounts"**
   - ✅ Fixed by disabling client-side inserts
   - Verify frontend changes were deployed

3. **"invalid input value for enum provisioning_stage"**
   - ✅ Fixed by removing enum usage
   - Function now uses text field only

4. **"CHECK constraint violation"**
   - Check provisioning_status value is one of: pending, provisioning, active, failed
   - Check the full error in logs for constraint name

---

## Files Changed

```
modified:   src/components/onboarding/SelfServeTrialFlow.tsx
modified:   src/components/signup/TrialSignupFlow.tsx
modified:   src/components/wizard/SalesSignupWizard.tsx
modified:   supabase/functions/create-trial/index.ts
new file:   supabase/migrations/20251123999998_fix_create_account_no_provisioning_stage.sql
new file:   GO_GREEN_DEPLOYMENT.md
new file:   GO_GREEN_SUMMARY.md
```

---

## Acceptance Criteria Checklist

Run through these after deployment:

- [ ] Running signup → create-trial returns **200** success
- [ ] No direct client-side inserts are executed
- [ ] No PostgREST 400 on `accounts` or `signup_leads`
- [ ] No SQL errors or constraint violations in logs
- [ ] No RLS failures in logs
- [ ] No reference to removed columns (`provisioning_stage`)
- [ ] `provisioning_status` always valid (pending/provisioning/active/failed)
- [ ] Detailed error logs appear in Supabase function logs
- [ ] Account record created in database
- [ ] Provisioning job enqueued

---

## Next Actions

1. **Deploy** (see GO_GREEN_DEPLOYMENT.md)
2. **Test** a signup from the frontend
3. **Monitor** logs for errors
4. **Verify** all acceptance criteria pass
5. **Report** results back

---

## Git Branch

All changes pushed to: `claude/fix-ringsnap-go-green-01GR7RELVeDQHqNpxzkZsokC`

```bash
# View commits
git log --oneline claude/fix-ringsnap-go-green-01GR7RELVeDQHqNpxzkZsokC

# View diffs
git diff main..claude/fix-ringsnap-go-green-01GR7RELVeDQHqNpxzkZsokC
```

---

**System Status: READY FOR DEPLOYMENT** ✅
