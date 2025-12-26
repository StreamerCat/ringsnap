-- Migration: Release Helper Function
-- Description: RPC to transition a phone number to cooldown and close the assignment

CREATE OR REPLACE FUNCTION public.transition_phone_to_cooldown(
  p_phone_id UUID,
  p_account_id UUID,
  p_reason TEXT,
  p_cooldown_interval INTERVAL DEFAULT '28 days'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_phone_record RECORD;
BEGIN
  -- 1. Verify ownership and status
  SELECT * INTO v_phone_record
  FROM public.phone_numbers
  WHERE id = p_phone_id
    AND assigned_account_id = p_account_id
    AND lifecycle_status = 'assigned'
  FOR UPDATE;

  IF v_phone_record.id IS NULL THEN
    -- Phone not found or not assigned to this account
    RETURN FALSE;
  END IF;

  -- 2. Update phone_numbers
  UPDATE public.phone_numbers
  SET 
    lifecycle_status = 'cooldown',
    assigned_account_id = NULL,
    released_at = now(),
    cooldown_until = now() + p_cooldown_interval,
    last_lifecycle_change_at = now()
  WHERE id = p_phone_id;

  -- 3. Close active assignment
  UPDATE public.phone_number_assignments
  SET 
    ended_at = now(),
    end_reason = p_reason
  WHERE phone_number_id = p_phone_id
    AND account_id = p_account_id
    AND ended_at IS NULL;

  RETURN TRUE;
END;
$$;
