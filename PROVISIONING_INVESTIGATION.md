# Provisioning Investigation - Phone Number Not Created

## Issue Report
- ✅ Stripe customer/subscription created
- ✅ Vapi assistant created
- ❌ Phone number NOT provisioned from Twilio
- ❌ Phone number NOT attached to Vapi assistant
- ❌ Phone number NOT stored in database

## Investigation Steps

### 1. Check Provisioning Job Status
Run this query in Supabase SQL Editor:

```sql
-- Get the most recent provisioning job
SELECT 
  id,
  account_id,
  status,
  attempts,
  error,
  vapi_assistant_id,
  vapi_phone_id,
  created_at,
  completed_at
FROM provisioning_jobs
ORDER BY created_at DESC
LIMIT 1;
```

**Look for**:
- `status`: Should be 'completed', if 'failed' check `error` field
- `error`: Will contain the exact error message
- `vapi_phone_id`: Should be populated if phone was created

### 2. Check Supabase Logs
Go to: https://supabase.com/dashboard/project/rmyvvbqnccpfeyowidrq/functions/provision-vapi/logs

**Search for these log messages**:
1. ✅ "Processing provisioning job" - Job started
2. ✅ "Creating Vapi assistant" - Assistant creation started
3. ✅ "Vapi assistant created" - Assistant succeeded
4. ❓ "Provisioning number via Twilio" - Twilio provisioning started
5. ❓ "Importing number to Vapi" - Vapi import started
6. ❓ "Phone number saved to database successfully" - DB insert succeeded
7. ❌ "Provisioning job failed" - Error occurred

### 3. Possible Root Causes

#### A. Twilio Credentials Missing/Invalid
**Check**: Lines 272-283 in provision-vapi/index.ts

If Twilio credentials are missing, you'll see error:
```
Missing Twilio credentials in environment: TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET
```

**Verify credentials are set**:
```bash
npx supabase secrets list | grep TWILIO
```

#### B. Twilio API Failure
**Check**: Lines 300-312 in provision-vapi/index.ts

Possible errors:
- "Trial account has reached the maximum number of phone numbers allowed"
- "No phone numbers available in area code XXX"
- "Twilio authentication failed"

#### C. Vapi Import Failure
**Check**: Lines 380-396 in provision-vapi/index.ts

Possible errors:
- "Vapi phone import failed: 401" - Invalid VAPI_API_KEY
- "Vapi phone import failed: 400" - Invalid payload (wrong Twilio creds)
- "Vapi phone import failed: 422" - Number already exists in Vapi

#### D. Database Insert Failure
**Check**: Lines 416-451 in provision-vapi/index.ts

We just fixed this, but verify:
- Error would be: "Failed to save phone to DB"
- Check error details in logs

### 4. Environment Variables to Verify

Run these checks:

```bash
# Check all required secrets are set
npx supabase secrets list | grep -E "(TWILIO|VAPI)"
```

**Required secrets**:
- ✅ TWILIO_ACCOUNT_SID
- ✅ TWILIO_API_KEY
- ✅ TWILIO_API_SECRET
- ✅ VAPI_API_KEY
- ✅ VAPI_DEFAULT_PROVIDER (should be 'twilio')

### 5. Manual Test

To test the provisioning flow manually:

```bash
# Trigger the provision-vapi worker
curl -X POST \
  https://rmyvvbqnccpfeyowidrq.supabase.co/functions/v1/provision-vapi \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"triggered_by":"manual_test"}'
```

This will process any queued jobs.

### 6. Check Twilio Console

1. Go to: https://console.twilio.com/
2. Navigate to: Phone Numbers > Manage > Active Numbers
3. Check if a number was purchased recently
4. If yes but not in DB: Twilio worked, issue is in Vapi import or DB insert
5. If no: Twilio provisioning failed

### 7. Check Vapi Console

1. Go to: https://dashboard.vapi.ai/
2. Navigate to: Phone Numbers
3. Check if any numbers exist
4. Check if they're linked to an assistant
5. If number exists but not linked: Assistant binding failed

## Quick Diagnostic Commands

```bash
# 1. Check if provisioning job exists and its status
echo "SELECT status, error FROM provisioning_jobs ORDER BY created_at DESC LIMIT 1;" | \
  psql YOUR_DB_CONNECTION_STRING

# 2. Check if phone_numbers row exists
echo "SELECT COUNT(*) FROM phone_numbers;" | \
  psql YOUR_DB_CONNECTION_STRING

# 3. Check Supabase logs
# Go to dashboard and filter by "error" level
```

## Expected Flow (Happy Path)

1. ✅ create-trial creates provisioning_jobs row (status='queued')
2. ✅ provision-vapi picks up the job
3. ✅ Creates Vapi assistant → stores in vapi_assistants table
4. ❓ Calls Twilio API to buy phone number
5. ❓ Calls Vapi API to import phone number and bind to assistant
6. ❓ Stores phone in phone_numbers table
7. ❓ Updates accounts table with phone number
8. ❓ Marks job as completed

## Next Steps

1. **Check the logs** - This will tell us exactly where it failed
2. **Check the provisioning_jobs.error field** - Will have the exact error message
3. **Verify Twilio credentials** - Make sure they're valid and not test mode
4. **Check Twilio console** - See if number was purchased
5. **Report back** with the error message from logs/database

## Files to Review

- `supabase/functions/provision-vapi/index.ts` - Main provisioning logic
- `supabase/functions/_shared/telephony.ts` - Twilio API calls
- Supabase Dashboard > Functions > provision-vapi > Logs
- Supabase Dashboard > Database > provisioning_jobs table
