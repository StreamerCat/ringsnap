-- ============================================================================
-- CRITICAL FIX: Create Missing Provisioning Tables
-- ============================================================================
-- This SQL creates all the tables needed for the provisioning system to work
-- Run this in Supabase SQL Editor: 
-- https://supabase.com/dashboard/project/rmyvvbqnccpfeyowidrq/sql/new
-- ============================================================================

-- 1. Create provisioning_jobs table (CRITICAL - this is missing!)
CREATE TABLE IF NOT EXISTS public.provisioning_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  step TEXT,
  error TEXT,
  attempts INT NOT NULL DEFAULT 0,
  job_type TEXT DEFAULT 'provision_phone',
  vapi_phone_id TEXT,
  vapi_assistant_id TEXT,
  retry_after TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  correlation_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create vapi_assistants table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.vapi_assistants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  vapi_assistant_id TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Disable RLS for service role access
ALTER TABLE IF EXISTS public.provisioning_jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vapi_assistants DISABLE ROW LEVEL SECURITY;

-- 4. Add missing columns to accounts table
ALTER TABLE IF EXISTS public.accounts
  ADD COLUMN IF NOT EXISTS vapi_assistant_id TEXT,
  ADD COLUMN IF NOT EXISTS vapi_number_id TEXT,
  ADD COLUMN IF NOT EXISTS phone_number_e164 TEXT;

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_provisioning_jobs_status_retry
  ON public.provisioning_jobs(status, retry_after, created_at)
  WHERE status IN ('queued', 'failed');

CREATE INDEX IF NOT EXISTS idx_provisioning_jobs_completed
  ON public.provisioning_jobs(completed_at)
  WHERE completed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_provisioning_jobs_correlation
  ON public.provisioning_jobs(correlation_id)
  WHERE correlation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_provisioning_jobs_account
  ON public.provisioning_jobs(account_id);

-- 6. Verify tables were created
DO $$
BEGIN
  RAISE NOTICE '✅ Checking provisioning_jobs table...';
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'provisioning_jobs') THEN
    RAISE NOTICE '✅ provisioning_jobs table exists';
  ELSE
    RAISE EXCEPTION '❌ provisioning_jobs table was NOT created!';
  END IF;

  RAISE NOTICE '✅ Checking vapi_assistants table...';
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'vapi_assistants') THEN
    RAISE NOTICE '✅ vapi_assistants table exists';
  ELSE
    RAISE EXCEPTION '❌ vapi_assistants table was NOT created!';
  END IF;

  RAISE NOTICE '✅ All provisioning tables created successfully!';
END $$;

-- 7. Show table structure
SELECT 
  'provisioning_jobs' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'provisioning_jobs'
ORDER BY ordinal_position;
