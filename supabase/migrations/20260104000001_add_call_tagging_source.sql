-- ============================================================================
-- Migration: Add reason_source and tag_source columns to call_logs
-- Version: 20260104000001
-- Purpose: Track the origin of call reason and tags for confidence indicators
-- ============================================================================

-- Add reason_source column
-- Values: 'structured' (from Vapi structuredData), 'transcript' (derived from transcript), 'none' (no source available)
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS reason_source TEXT;

-- Add tag_source column
-- Values: 'structured' (from Vapi structuredData), 'transcript' (derived from transcript), 'none' (no source available)
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS tag_source TEXT;

-- Add comments for documentation
COMMENT ON COLUMN call_logs.reason_source IS 'Source of the reason field: structured (Vapi), transcript (derived), or none';
COMMENT ON COLUMN call_logs.tag_source IS 'Source of service/intent tags: structured (Vapi), transcript (derived), or none';

-- ============================================================================
-- Update get_recent_calls RPC to include new columns
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_recent_calls(uuid, integer);

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
  transcript TEXT,
  recording_url TEXT,
  caller_name TEXT,
  reason TEXT,
  reason_source TEXT,
  tag_source TEXT,
  outcome TEXT,
  booked BOOLEAN,
  lead_captured BOOLEAN,
  appointment_start TIMESTAMPTZ,
  appointment_end TIMESTAMPTZ,
  appointment_window TEXT,
  address TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  -- Security check using SD function to avoid RLS recursion
  IF NOT public.check_account_access(p_account_id) THEN
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
    cl.transcript,
    cl.recording_url,
    cl.caller_name,
    cl.reason,
    cl.reason_source,
    cl.tag_source,
    cl.outcome,
    cl.booked,
    cl.lead_captured,
    cl.appointment_start,
    cl.appointment_end,
    cl.appointment_window,
    cl.address,
    cl.created_at
  FROM public.call_logs cl
  WHERE cl.account_id = p_account_id
  ORDER BY cl.started_at DESC NULLS LAST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_recent_calls(uuid, integer) TO authenticated;

COMMENT ON FUNCTION public.get_recent_calls IS 'Fetches recent calls with tagging source metadata for confidence indicators';
