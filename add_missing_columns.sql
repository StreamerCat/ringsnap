-- ============================================================================
-- FIX: Add Missing Columns to Existing provisioning_jobs Table
-- ============================================================================
-- The table exists but is missing some columns
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Add missing columns to provisioning_jobs
ALTER TABLE public.provisioning_jobs
  ADD COLUMN IF NOT EXISTS job_type TEXT DEFAULT 'provision_phone',
  ADD COLUMN IF NOT EXISTS vapi_phone_id TEXT,
  ADD COLUMN IF NOT EXISTS vapi_assistant_id TEXT,
  ADD COLUMN IF NOT EXISTS retry_after TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS correlation_id TEXT;

-- Add missing columns to accounts table
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS vapi_assistant_id TEXT,
  ADD COLUMN IF NOT EXISTS vapi_number_id TEXT,
  ADD COLUMN IF NOT EXISTS phone_number_e164 TEXT;

-- Create vapi_assistants table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.vapi_assistants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  vapi_assistant_id TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS public.vapi_assistants DISABLE ROW LEVEL SECURITY;

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

CREATE INDEX IF NOT EXISTS idx_provisioning_jobs_account
  ON public.provisioning_jobs(account_id);

-- Verify
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'provisioning_jobs'
ORDER BY ordinal_position;
