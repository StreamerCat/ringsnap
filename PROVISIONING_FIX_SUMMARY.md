# Provisioning Fix Summary

## Problem Identified
After a successful signup, the following issues were occurring:
1. ❌ Phone number NOT stored in `phone_numbers` table
2. ❌ Phone number NOT visible in account record
3. ✅ Twilio number successfully provisioned
4. ✅ Vapi assistant successfully created
5. ✅ Stripe customer and subscription created

## Root Cause
**Schema Mismatch in `provision-vapi` function**

The code was attempting to insert fields into the `phone_numbers` table that don't exist in the actual database schema:

### Fields Being Inserted (WRONG):
- `vapi_id` ❌ (should be `vapi_phone_id`)
- `activated_at` ❌ (doesn't exist)
- `raw` ❌ (doesn't exist)
- `trial_expires_at` ❌ (doesn't exist)
- `phone_retention_expires_at` ❌ (doesn't exist)
- `provider` ❌ (doesn't exist)
- `provider_id` ❌ (doesn't exist - duplicate)

### Actual Schema:
```sql
CREATE TABLE phone_numbers (
  id UUID PRIMARY KEY,
  account_id UUID,
  phone_number TEXT NOT NULL UNIQUE,
  area_code TEXT NOT NULL,
  vapi_phone_id TEXT UNIQUE,  -- ✅ Correct name
  label TEXT,
  purpose TEXT,
  status TEXT DEFAULT 'active',
  held_until TIMESTAMPTZ,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

## Fix Applied

### File: `supabase/functions/provision-vapi/index.ts`
**Lines 416-458**

**Changes Made**:
1. ✅ Fixed `vapi_id` → `vapi_phone_id`
2. ✅ Removed all non-existent fields
3. ✅ Added detailed logging before/after insert
4. ✅ Enhanced error logging with details and hints

**New Insert Code**:
```typescript
const { data: phoneRow, error: phoneDbError } = await supabase
  .from("phone_numbers")
  .insert({
    account_id: accountId,
    phone_number: finalNumber,
    area_code: requestedAreaCode,
    vapi_phone_id: vapiPhoneId,  // ✅ Fixed
    purpose: "primary",
    status: "active",
    is_primary: true,
  })
  .select("id")
  .single();
```

## Deployment Status

✅ **Committed**: Commit `cf32a69`
✅ **Deployed**: `provision-vapi` function deployed to production
✅ **Branch**: `fix/trial-upgrade-logic`

## Testing Plan

### Test 1: New Signup
1. Create a new trial signup
2. Verify `phone_numbers` table has a row
3. Verify `vapi_phone_id` is populated
4. Verify `accounts.vapi_phone_number` is populated

### Test 2: Phone Number Verification
1. Query the `phone_numbers` table for the account
2. Confirm phone number matches Twilio provisioned number
3. Confirm `is_primary` = true
4. Confirm `status` = 'active'

### Test 3: Vapi Integration
1. Make a test call to the provisioned number
2. Verify call reaches the Vapi assistant
3. Verify assistant responds with correct company name
4. Verify call is logged in usage_logs

## Expected Behavior After Fix

### Database State:
```sql
-- phone_numbers table
SELECT * FROM phone_numbers WHERE account_id = '<new_account_id>';
-- Should return 1 row with:
-- - phone_number: +1XXXXXXXXXX
-- - vapi_phone_id: <vapi_id>
-- - is_primary: true
-- - status: active

-- accounts table
SELECT vapi_phone_number, vapi_assistant_id FROM accounts WHERE id = '<new_account_id>';
-- Should return:
-- - vapi_phone_number: +1XXXXXXXXXX
-- - vapi_assistant_id: <assistant_id>
```

### Vapi State:
- Phone number exists in Vapi
- Phone number is linked to assistant
- Assistant has correct configuration
- Calls route correctly

## Monitoring

Check the following logs after next signup:
1. **Success Log**: "Phone number saved to database successfully"
2. **Account Update**: "Provisioning job completed successfully"
3. **No Errors**: No "Failed to save phone to DB" errors

## Related Files Modified

1. ✅ `supabase/functions/provision-vapi/index.ts` - Main fix
2. ✅ `PROVISIONING_FIX_PLAN.md` - Detailed analysis
3. ✅ `.github/workflows/deploy-create-trial-specific.yml` - Removed secrets overwrite

## Next Steps

1. ✅ Fix deployed to production
2. ⏳ Test with a new signup
3. ⏳ Verify phone number storage
4. ⏳ Verify Vapi integration
5. ⏳ Monitor logs for any issues

## Rollback Plan (if needed)

If issues occur:
```bash
# Revert the commit
git revert cf32a69

# Redeploy
npx supabase functions deploy provision-vapi --project-ref rmyvvbqnccpfeyowidrq
```

## Success Criteria

- [ ] New signup creates `phone_numbers` row
- [ ] `phone_numbers.vapi_phone_id` is populated
- [ ] `accounts.vapi_phone_number` is populated  
- [ ] Test call reaches assistant
- [ ] No provisioning errors in logs
