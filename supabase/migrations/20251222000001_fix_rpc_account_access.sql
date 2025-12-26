-- FIX RPC FUNCTIONS: Use check_account_access instead of direct account_members query
-- The internal security checks were triggering RLS recursion

-- =============================================================================
-- Update get_calls_today to use check_account_access
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_calls_today(uuid);

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
  appointment_window TEXT,
  created_at TIMESTAMPTZ
) AS $$
DECLARE
  start_of_day TIMESTAMPTZ;
BEGIN
  -- Security check using SD function to avoid RLS recursion
  IF NOT public.check_account_access(p_account_id) THEN
    RAISE EXCEPTION 'Access denied to account %', p_account_id;
  END IF;

  -- Calculate start of day in UTC
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
    cl.appointment_window,
    cl.created_at
  FROM public.call_logs cl
  WHERE cl.account_id = p_account_id
    AND cl.created_at >= start_of_day
  ORDER BY cl.started_at DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Update get_recent_calls to use check_account_access
-- =============================================================================

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
  recording_url TEXT,
  caller_name TEXT,
  reason TEXT,
  outcome TEXT,
  booked BOOLEAN,
  lead_captured BOOLEAN,
  appointment_start TIMESTAMPTZ,
  appointment_end TIMESTAMPTZ,
  appointment_window TEXT,
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
    cl.recording_url,
    cl.caller_name,
    cl.reason,
    cl.outcome,
    cl.booked,
    cl.lead_captured,
    cl.appointment_start,
    cl.appointment_end,
    cl.appointment_window,
    cl.created_at
  FROM public.call_logs cl
  WHERE cl.account_id = p_account_id
  ORDER BY cl.started_at DESC NULLS LAST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_calls_today(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_recent_calls(uuid, integer) TO authenticated;
