-- Migration: Provisioning Lifecycle Timestamps
-- Purpose: Track provisioning lifecycle events with precise timestamps
-- Date: 2025-11-23
-- Agent: @schema-migration-agent

-- ==============================================================================
-- PART 1: Add timestamp columns to accounts table
-- ==============================================================================

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS provisioning_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provisioning_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provisioning_error TEXT;

-- ==============================================================================
-- PART 2: Add metadata column to provisioning_jobs for better tracking
-- ==============================================================================

ALTER TABLE public.provisioning_jobs
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS correlation_id TEXT;

-- ==============================================================================
-- PART 3: Create index for correlation tracking
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_provisioning_jobs_correlation
  ON public.provisioning_jobs(correlation_id)
  WHERE correlation_id IS NOT NULL;

-- ==============================================================================
-- PART 4: Add documentation
-- ==============================================================================

COMMENT ON COLUMN public.accounts.provisioning_started_at IS
  'Timestamp when async provisioning worker started processing this account';

COMMENT ON COLUMN public.accounts.provisioning_completed_at IS
  'Timestamp when provisioning successfully completed';

COMMENT ON COLUMN public.accounts.provisioning_error IS
  'Last provisioning error message (if failed)';

COMMENT ON COLUMN public.provisioning_jobs.metadata IS
  'Flexible JSONB field for job-specific data (area code, voice preference, etc)';

COMMENT ON COLUMN public.provisioning_jobs.correlation_id IS
  'Request correlation ID for end-to-end tracing from signup to provisioning';

-- ==============================================================================
-- PART 5: Create helper function to update provisioning lifecycle
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.update_provisioning_lifecycle(
  p_account_id UUID,
  p_status TEXT,
  p_error TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  IF p_status = 'processing' THEN
    UPDATE public.accounts
    SET
      provisioning_status = p_status,
      provisioning_started_at = COALESCE(provisioning_started_at, now()),
      updated_at = now()
    WHERE id = p_account_id;

  ELSIF p_status = 'completed' THEN
    UPDATE public.accounts
    SET
      provisioning_status = p_status,
      provisioning_completed_at = now(),
      provisioning_error = NULL,
      updated_at = now()
    WHERE id = p_account_id;

  ELSIF p_status = 'failed' THEN
    UPDATE public.accounts
    SET
      provisioning_status = p_status,
      provisioning_error = p_error,
      updated_at = now()
    WHERE id = p_account_id;

  ELSE
    -- Generic status update
    UPDATE public.accounts
    SET
      provisioning_status = p_status,
      updated_at = now()
    WHERE id = p_account_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.update_provisioning_lifecycle IS
  'Helper function to atomically update account provisioning status with lifecycle timestamps';

-- ==============================================================================
-- PART 6: Grant permissions
-- ==============================================================================

GRANT EXECUTE ON FUNCTION public.update_provisioning_lifecycle TO service_role;
