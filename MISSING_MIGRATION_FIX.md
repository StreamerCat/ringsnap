# Missing Database Migration - CRITICAL FIX

## Problem
The `provisioning_jobs` table doesn't exist in your production database, which is why provisioning is failing silently.

## Root Cause
The migration file `20251107123000_provisioning_tables.sql` exists in the codebase but was never applied to production.

## Solution

### Option 1: Apply via Supabase Dashboard (RECOMMENDED)

1. Go to: https://supabase.com/dashboard/project/rmyvvbqnccpfeyowidrq/sql/new

2. Copy and paste this SQL:

```sql
-- Create provisioning_jobs table
create table if not exists public.provisioning_jobs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  user_id uuid not null,
  status text not null default 'queued',
  step text,
  error text,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Disable RLS for service role access
alter table if exists public.provisioning_jobs disable row level security;

-- Add missing columns to accounts table
alter table if exists public.accounts
  add column if not exists vapi_assistant_id text,
  add column if not exists vapi_number_id text,
  add column if not exists phone_number_e164 text;

-- Create vapi_assistants table if it doesn't exist
create table if not exists public.vapi_assistants (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  vapi_assistant_id text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table if exists public.vapi_assistants disable row level security;

-- Add enhanced columns for async provisioning
ALTER TABLE public.provisioning_jobs
  ADD COLUMN IF NOT EXISTS job_type TEXT DEFAULT 'provision_phone',
  ADD COLUMN IF NOT EXISTS vapi_phone_id TEXT,
  ADD COLUMN IF NOT EXISTS vapi_assistant_id TEXT,
  ADD COLUMN IF NOT EXISTS retry_after TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Add correlation_id for request tracing
ALTER TABLE public.provisioning_jobs
  ADD COLUMN IF NOT EXISTS correlation_id TEXT;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_provisioning_jobs_status_retry
  ON public.provisioning_jobs(status, retry_after, created_at)
  WHERE status IN ('queued', 'failed');

CREATE INDEX IF NOT EXISTS idx_provisioning_jobs_completed
  ON public.provisioning_jobs(completed_at)
  WHERE completed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_provisioning_jobs_correlation
  ON public.provisioning_jobs(correlation_id)
  WHERE correlation_id IS NOT NULL;
```

3. Click **Run** (or press F5)

4. Verify the table was created:
```sql
SELECT * FROM provisioning_jobs LIMIT 1;
```

### Option 2: Apply via Supabase CLI

```bash
# Link to your project
npx supabase db push --linked

# Or apply specific migration
npx supabase migration up --db-url "your-connection-string"
```

## After Applying Migration

1. **Test with a new signup** - The provisioning should now work
2. **Check the table**:
   ```sql
   SELECT * FROM provisioning_jobs ORDER BY created_at DESC LIMIT 5;
   ```
3. **Monitor logs**: https://supabase.com/dashboard/project/rmyvvbqnccpfeyowidrq/functions/provision-vapi/logs

## Why This Happened

The migration files exist in your codebase but were never pushed to production. This commonly happens when:
- Migrations are created locally but not deployed
- Database was reset/recreated without re-running migrations
- Migrations were added after initial database setup

## Prevention

Going forward, always run migrations after creating them:
```bash
npx supabase db push --linked
```

Or use the Supabase Dashboard to apply SQL directly.
