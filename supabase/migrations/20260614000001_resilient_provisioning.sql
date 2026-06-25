-- Migration: Resilient Provisioning
-- Purpose: Add granular provisioning states, structured error storage, and
--          admin-rerun support so trial signup survives Twilio/Vapi outages.
-- Date: 2026-06-14

-- ==============================================================================
-- PART 1: Extend accounts.provisioning_status CHECK constraint
-- Add: partially_provisioned, failed_retryable, failed_manual_action_required
-- ==============================================================================

ALTER TABLE public.accounts
  DROP CONSTRAINT IF EXISTS accounts_provisioning_status_check;

ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_provisioning_status_check
  CHECK (provisioning_status IN (
    'idle',
    'pending',
    'provisioning',
    'processing',
    'active',
    'completed',
    'failed',
    'skipped',
    'partially_provisioned',
    'failed_retryable',
    'failed_manual_action_required'
  ));

-- ==============================================================================
-- PART 2: Add structured error columns to provisioning_jobs
-- ==============================================================================

ALTER TABLE public.provisioning_jobs
  ADD COLUMN IF NOT EXISTS error_code TEXT,
  ADD COLUMN IF NOT EXISTS error_details JSONB DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS provisioning_step TEXT;

COMMENT ON COLUMN public.provisioning_jobs.error_code IS
  'Machine-readable error code (e.g. TWILIO_SUSPENDED, VAPI_PHONE_FAILED, VAPI_ASSISTANT_FAILED)';

COMMENT ON COLUMN public.provisioning_jobs.error_details IS
  'Structured error context — sanitized, no secrets or credentials';

COMMENT ON COLUMN public.provisioning_jobs.provisioning_step IS
  'Which provisioning step failed: assistant_creation, phone_provisioning, vapi_import, account_update';

-- Index for admin queries filtering by error_code
CREATE INDEX IF NOT EXISTS idx_provisioning_jobs_error_code
  ON public.provisioning_jobs(error_code)
  WHERE error_code IS NOT NULL;

-- ==============================================================================
-- PART 3: Update update_provisioning_lifecycle to handle new statuses
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

  ELSIF p_status IN ('failed', 'failed_retryable', 'failed_manual_action_required') THEN
    UPDATE public.accounts
    SET
      provisioning_status = p_status,
      provisioning_error = p_error,
      updated_at = now()
    WHERE id = p_account_id;

  ELSIF p_status = 'partially_provisioned' THEN
    UPDATE public.accounts
    SET
      provisioning_status = p_status,
      provisioning_error = p_error,
      updated_at = now()
    WHERE id = p_account_id;

  ELSE
    UPDATE public.accounts
    SET
      provisioning_status = p_status,
      updated_at = now()
    WHERE id = p_account_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.update_provisioning_lifecycle TO service_role;
