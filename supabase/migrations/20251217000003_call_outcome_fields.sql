-- Migration: Add call outcome fields for Booked/Lead tracking
-- Purpose: Enable dashboard to display caller info, reason, and outcomes

-- =============================================================================
-- PHASE 1: Add outcome columns to call_logs
-- =============================================================================

ALTER TABLE public.call_logs
  ADD COLUMN IF NOT EXISTS caller_name TEXT,
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS outcome TEXT,
  ADD COLUMN IF NOT EXISTS booked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS lead_captured BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS appointment_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS appointment_end TIMESTAMPTZ;

-- Add check constraint for outcome values (allows null)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'call_logs_outcome_check'
  ) THEN
    ALTER TABLE public.call_logs 
      ADD CONSTRAINT call_logs_outcome_check 
      CHECK (outcome IS NULL OR outcome IN ('booked', 'lead', 'other'));
  END IF;
END $$;

-- =============================================================================
-- PHASE 2: Create indexes for filtering
-- =============================================================================

-- Index for filtering by outcome
CREATE INDEX IF NOT EXISTS idx_call_logs_outcome 
  ON public.call_logs(account_id, outcome) 
  WHERE outcome IS NOT NULL;

-- Index for finding leads to follow up
CREATE INDEX IF NOT EXISTS idx_call_logs_leads 
  ON public.call_logs(account_id, created_at DESC) 
  WHERE lead_captured = true AND booked = false;

-- Index for booked appointments
CREATE INDEX IF NOT EXISTS idx_call_logs_booked 
  ON public.call_logs(account_id, appointment_start) 
  WHERE booked = true;

-- =============================================================================
-- PHASE 3: Update RPCs to return new columns
-- =============================================================================

-- Update get_recent_calls to include outcome fields
CREATE OR REPLACE FUNCTION public.get_recent_calls(
  p_account_id UUID,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  account_id UUID,
  direction TEXT,
  from_number TEXT,
  to_number TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  status TEXT,
  summary TEXT,
  recording_url TEXT,
  caller_name TEXT,
  reason TEXT,
  outcome TEXT,
  booked BOOLEAN,
  lead_captured BOOLEAN,
  appointment_start TIMESTAMPTZ,
  appointment_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  -- Security check: verify user has access to this account
  IF NOT EXISTS (
    SELECT 1 FROM public.account_members am
    WHERE am.account_id = p_account_id
      AND am.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied to account %', p_account_id;
  END IF;

  RETURN QUERY
  SELECT 
    cl.id,
    cl.account_id,
    cl.direction,
    cl.from_number,
    cl.to_number,
    cl.started_at,
    cl.ended_at,
    cl.duration_seconds,
    cl.status,
    cl.summary,
    cl.recording_url,
    cl.caller_name,
    cl.reason,
    cl.outcome,
    cl.booked,
    cl.lead_captured,
    cl.appointment_start,
    cl.appointment_end,
    cl.created_at
  FROM public.call_logs cl
  WHERE cl.account_id = p_account_id
  ORDER BY cl.started_at DESC NULLS LAST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update get_calls_today to include outcome fields
CREATE OR REPLACE FUNCTION public.get_calls_today(p_account_id UUID)
RETURNS TABLE (
  id UUID,
  account_id UUID,
  direction TEXT,
  from_number TEXT,
  to_number TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  status TEXT,
  summary TEXT,
  recording_url TEXT,
  caller_name TEXT,
  reason TEXT,
  outcome TEXT,
  booked BOOLEAN,
  lead_captured BOOLEAN,
  created_at TIMESTAMPTZ
) AS $$
DECLARE
  start_of_day TIMESTAMPTZ;
BEGIN
  -- Security check: verify user has access to this account
  IF NOT EXISTS (
    SELECT 1 FROM public.account_members am
    WHERE am.account_id = p_account_id
      AND am.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied to account %', p_account_id;
  END IF;

  -- Calculate start of day in UTC (adjust for timezone if needed)
  start_of_day := date_trunc('day', now());

  RETURN QUERY
  SELECT 
    cl.id,
    cl.account_id,
    cl.direction,
    cl.from_number,
    cl.to_number,
    cl.started_at,
    cl.ended_at,
    cl.duration_seconds,
    cl.status,
    cl.summary,
    cl.recording_url,
    cl.caller_name,
    cl.reason,
    cl.outcome,
    cl.booked,
    cl.lead_captured,
    cl.created_at
  FROM public.call_logs cl
  WHERE cl.account_id = p_account_id
    AND cl.created_at >= start_of_day
  ORDER BY cl.started_at DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON COLUMN public.call_logs.outcome IS 
  'Call outcome: booked (appointment scheduled), lead (name+phone captured), other';
COMMENT ON COLUMN public.call_logs.caller_name IS 
  'Extracted caller name from transcript or tool output';
COMMENT ON COLUMN public.call_logs.reason IS 
  'Extracted reason for call from summary or analysis';
