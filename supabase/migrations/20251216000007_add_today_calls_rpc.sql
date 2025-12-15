-- RPC: Get today's calls for operator dashboard
-- Bypasses RLS by using SECURITY DEFINER, manually checks membership

CREATE OR REPLACE FUNCTION public.get_calls_today(p_account_id uuid)
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
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
    v_start_of_day timestamptz;
BEGIN
    -- Security Check
    IF NOT EXISTS (
        SELECT 1 FROM public.account_members 
        WHERE account_id = p_account_id 
        AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Access Denied';
    END IF;

    -- Calculate start of today (UTC)
    v_start_of_day := date_trunc('day', now() AT TIME ZONE 'UTC');

    -- Fetch today's calls
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
      AND c.started_at >= v_start_of_day
    ORDER BY c.started_at DESC;
END;
$$;
