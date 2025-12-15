-- RPC: Securely fetch call logs without RLS recursion
-- This function runs as SECURITY DEFINER (Service Role) but manually checks permission.

CREATE OR REPLACE FUNCTION public.get_recent_calls(p_account_id uuid, p_limit int DEFAULT 50)
RETURNS TABLE (
    id uuid,
    created_at timestamptz,
    started_at timestamptz,
    ended_at timestamptz,
    duration_seconds int,
    status text,
    direction text,
    from_number text,
    to_number text,
    summary text,
    recording_url text,
    cost numeric
)
LANGUAGE plpgsql
SECURITY DEFINER -- Bypasses RLS on the table
SET search_path = public
STABLE
AS $$
BEGIN
  -- 1. Security Check: Is the executing user a member of this account?
  IF NOT EXISTS (
    SELECT 1 FROM public.account_members 
    WHERE account_id = p_account_id 
    AND user_id = auth.uid()
  ) THEN
    -- Silently return empty or raise error? Empty is safer/cleaner for UI.
    -- But let's raise error for debugging if they are truly unauthorized.
    RAISE EXCEPTION 'Access Denied: User is not a member of this account.';
  END IF;

  -- 2. Fetch Data
  RETURN QUERY
  SELECT 
    c.id,
    c.created_at,
    c.started_at,
    c.ended_at,
    c.duration_seconds,
    c.status,
    c.direction,
    c.from_number,
    c.to_number,
    c.summary,
    c.recording_url,
    c.cost
  FROM public.call_logs c
  WHERE c.account_id = p_account_id
  ORDER BY c.started_at DESC NULLS LAST
  LIMIT p_limit;
END;
$$;
