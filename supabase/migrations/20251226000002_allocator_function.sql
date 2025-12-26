-- Migration: Atomic Allocator Function
-- Description: RPC to safely allocate a number from the pool

CREATE OR REPLACE FUNCTION public.allocate_phone_number_from_pool(
  p_account_id UUID,
  p_min_silence_interval INTERVAL DEFAULT '10 days'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Run as owner to bypass potential RLS on phone_numbers if needed, though usually service role calls this
AS $$
DECLARE
  v_phone_record RECORD;
  v_history_id UUID;
BEGIN
  -- 1. Lock and select one eligible number
  -- Criteria:
  -- - Status is 'pool'
  -- - Cooldown expired (or null)
  -- - No calls received within silence interval (safety check)
  SELECT * INTO v_phone_record
  FROM public.phone_numbers
  WHERE lifecycle_status = 'pool'
    AND (cooldown_until IS NULL OR cooldown_until <= now())
    AND (
      last_call_at IS NULL 
      OR last_call_at < (now() - p_min_silence_interval)
    )
    AND (is_reserved IS FALSE) -- Ensure we never allocate reserved numbers
  ORDER BY 
    released_at ASC NULLS FIRST -- Prefer numbers waiting longest
  LIMIT 1
  FOR UPDATE SKIP LOCKED; -- Atomic reservation

  -- If no number found, return null
  IF v_phone_record.id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 2. Update phone number status
  UPDATE public.phone_numbers
  SET 
    lifecycle_status = 'assigned',
    assigned_account_id = p_account_id,
    assigned_at = now(),
    -- Clear release info
    released_at = NULL,
    cooldown_until = NULL,
    last_lifecycle_change_at = now()
  WHERE id = v_phone_record.id;

  -- 3. Insert assignment history record
  INSERT INTO public.phone_number_assignments (
    phone_number_id,
    account_id,
    started_at
  ) VALUES (
    v_phone_record.id,
    p_account_id,
    now()
  ) RETURNING id INTO v_history_id;

  -- 4. Return the allocated phone details
  RETURN jsonb_build_object(
    'id', v_phone_record.id,
    'phone_number', COALESCE(v_phone_record.e164_number, v_phone_record.phone_number),
    'provider_id', v_phone_record.provider_phone_number_id,
    'area_code', v_phone_record.area_code,
    'assignment_id', v_history_id
  );
END;
$$;
