-- Migration: Add metadata and failure_reason to signup_leads
-- Supports AI-assisted signup flow with extended data capture

ALTER TABLE public.signup_leads
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS failure_reason TEXT,
ADD COLUMN IF NOT EXISTS failure_phase TEXT;

-- Index for querying by failure reason
CREATE INDEX IF NOT EXISTS idx_signup_leads_failure_reason
  ON public.signup_leads(failure_reason)
  WHERE failure_reason IS NOT NULL;

-- Comments
COMMENT ON COLUMN public.signup_leads.metadata IS 'Additional lead data (companyName, trade, website, primaryGoal, etc)';
COMMENT ON COLUMN public.signup_leads.failure_reason IS 'Why signup failed or was abandoned';
COMMENT ON COLUMN public.signup_leads.failure_phase IS 'Which phase of signup failed (payment, validation, create-trial, etc)';
