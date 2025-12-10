# Provisioning Worker Issue - Root Cause and Solutions

## Problem

After completing trial signup, users see the ProvisioningStatus page but it gets stuck showing "Setting up your AI Assistant" even though the phone number and assistant were successfully provisioned in the background.

## Root Cause

The `provision-vapi` worker is **not being automatically triggered** to process queued provisioning jobs.

### What's Happening:

1. ✅ User completes signup → `create-trial` function runs
2. ✅ `create-trial` creates account and inserts job into `provisioning_jobs` table with `status='queued'`
3. ✅ `create-trial` tries to fire-and-forget invoke `provision-vapi` worker (line 1166)
4. ❌ **If that invoke fails or times out, nothing retries it**
5. ❌ **No cron job exists to poll for queued jobs**
6. ❌ Job sits in database as `status='queued'` forever
7. ❌ ProvisioningStatus page polls `accounts.provisioning_status` which stays `'pending'`
8. ❌ User sees infinite spinner or timeout message

### Why the Worker Doesn't Run:

The `provision-vapi` worker is designed to:
- Be triggered manually via HTTP POST
- Poll the `provisioning_jobs` table for queued/failed jobs
- Process up to 10 jobs per invocation

**BUT** there's no automatic trigger mechanism configured:
- ❌ No pg_cron job
- ❌ No Supabase webhook
- ❌ No database trigger
- ❌ Only relies on fire-and-forget call from `create-trial` (unreliable)

## Solutions

### ✅ Solution 1: Database Trigger (RECOMMENDED)

**File**: `supabase/migrations/20251210000001_auto_trigger_provision_worker.sql`

**How it works**:
- Trigger fires immediately when a row is inserted into `provisioning_jobs` with `status='queued'`
- Calls `provision-vapi` worker via HTTP POST using `pg_net.http_post`
- Near-instant provisioning (no polling delay)
- Most reliable solution

**Pros**:
- ✅ Instant provisioning (0-5 seconds)
- ✅ No polling overhead
- ✅ Automatic retry if worker fails (job stays queued, can be manually triggered)
- ✅ No external dependencies

**Cons**:
- ⚠️ Requires `pg_net` extension (should be enabled by default in Supabase)
- ⚠️ Requires setting app.settings.supabase_url and service_role_key

**Setup**:
```sql
-- Run this migration
\i supabase/migrations/20251210000001_auto_trigger_provision_worker.sql

-- Configure settings (replace with your actual values)
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://rmyvvbqnccpfeyowidrq.supabase.co';
ALTER DATABASE postgres SET app.settings.service_role_key = 'your-service-role-key-here';
```

### ✅ Solution 2: Supabase Cron Job (FALLBACK)

**File**: `supabase/migrations/20251210_add_provision_vapi_cron.sql`

**How it works**:
- pg_cron job runs every 30-60 seconds
- Calls `provision-vapi` worker via HTTP POST
- Worker processes all queued jobs

**Pros**:
- ✅ Reliable fallback if trigger fails
- ✅ Catches any stuck jobs
- ✅ Simple to set up

**Cons**:
- ⚠️ Polling delay (30-60 seconds)
- ⚠️ Unnecessary API calls if no jobs queued
- ⚠️ Requires pg_cron extension

**Setup**:
```sql
-- Enable pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule job (every minute)
SELECT cron.schedule(
  'process-provisioning-jobs',
  '* * * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/provision-vapi',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('triggered_by', 'cron')
    );
  $$
);
```

### ✅ Solution 3: Manual Trigger (TESTING ONLY)

**File**: `.agent/MANUAL_TRIGGER_PROVISION.md`

**How it works**:
- Manually invoke the worker via curl or Supabase Dashboard
- Useful for testing and debugging

**Pros**:
- ✅ Immediate testing
- ✅ No setup required

**Cons**:
- ❌ Not automatic
- ❌ Not suitable for production

**Usage**:
```bash
curl -X POST "https://rmyvvbqnccpfeyowidrq.supabase.co/functions/v1/provision-vapi" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"triggered_by": "manual"}'
```

## Recommended Approach

**Use BOTH Solution 1 and Solution 2** (belt and suspenders):

1. **Primary**: Database trigger for instant provisioning
2. **Fallback**: Cron job every minute to catch any stuck jobs

This ensures:
- ✅ Fast provisioning (trigger fires immediately)
- ✅ Reliability (cron catches failures)
- ✅ No stuck jobs (cron processes anything the trigger missed)

## Verification

After implementing the solution, verify it works:

### 1. Check Trigger Exists
```sql
SELECT * FROM pg_trigger WHERE tgname = 'on_provisioning_job_insert';
```

### 2. Check Cron Job (if using)
```sql
SELECT * FROM cron.job WHERE jobname = 'process-provisioning-jobs';
```

### 3. Test End-to-End
1. Complete a trial signup
2. Check provisioning_jobs table:
   ```sql
   SELECT id, status, created_at, updated_at 
   FROM provisioning_jobs 
   ORDER BY created_at DESC LIMIT 1;
   ```
3. Wait 5-10 seconds
4. Check again - status should be 'completed'
5. Check accounts table:
   ```sql
   SELECT provisioning_status, vapi_phone_number, vapi_assistant_id
   FROM accounts
   ORDER BY created_at DESC LIMIT 1;
   ```
6. Verify ProvisioningStatus page shows "ready" state with phone number

### 4. Monitor Logs
```sql
-- Check recent provisioning activity
SELECT 
  pj.id,
  pj.account_id,
  pj.status,
  pj.attempts,
  pj.error,
  a.provisioning_status,
  a.vapi_phone_number,
  pj.created_at,
  pj.updated_at,
  pj.completed_at
FROM provisioning_jobs pj
LEFT JOIN accounts a ON a.id = pj.account_id
ORDER BY pj.created_at DESC
LIMIT 10;
```

## Quick Fix for Current Stuck Job

If you have a job stuck in 'queued' status right now:

```bash
# Manually trigger the worker
curl -X POST "https://rmyvvbqnccpfeyowidrq.supabase.co/functions/v1/provision-vapi" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"triggered_by": "manual_fix"}'
```

Or via Supabase Dashboard:
1. Go to Edge Functions → provision-vapi
2. Click "Invoke"
3. Send body: `{"triggered_by": "manual_fix"}`

The worker will process all queued jobs and update the provisioning_status to 'completed'.
