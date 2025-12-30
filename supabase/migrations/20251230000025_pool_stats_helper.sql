-- Migration: Add Pool Statistics Helper Function
-- Description: Provides diagnostic information about pool state for debugging

CREATE OR REPLACE FUNCTION public.get_pool_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  WITH stats AS (
    SELECT
      COUNT(*) FILTER (WHERE lifecycle_status = 'pool') as pool_total,
      COUNT(*) FILTER (
        WHERE lifecycle_status = 'pool'
          AND (cooldown_until IS NULL OR cooldown_until <= now())
      ) as pool_cooldown_passed,
      COUNT(*) FILTER (
        WHERE lifecycle_status = 'pool'
          AND (cooldown_until IS NULL OR cooldown_until <= now())
          AND (last_call_at IS NULL OR last_call_at < (now() - interval '10 days'))
      ) as pool_fully_eligible,
      COUNT(*) FILTER (WHERE lifecycle_status = 'assigned') as assigned_total,
      COUNT(*) FILTER (WHERE lifecycle_status = 'cooldown') as cooldown_total,
      COUNT(*) FILTER (WHERE lifecycle_status = 'released') as released_total,
      COUNT(*) FILTER (WHERE lifecycle_status = 'quarantine') as quarantine_total,
      COUNT(*) FILTER (WHERE lifecycle_status IS NULL) as null_lifecycle
    FROM phone_numbers
  )
  SELECT jsonb_build_object(
    'pool_total', pool_total,
    'pool_cooldown_passed', pool_cooldown_passed,
    'pool_fully_eligible', pool_fully_eligible,
    'assigned_total', assigned_total,
    'cooldown_total', cooldown_total,
    'released_total', released_total,
    'quarantine_total', quarantine_total,
    'null_lifecycle', null_lifecycle,
    'timestamp', now()
  )
  INTO v_result
  FROM stats;

  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated and service roles
GRANT EXECUTE ON FUNCTION public.get_pool_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pool_stats() TO service_role;
