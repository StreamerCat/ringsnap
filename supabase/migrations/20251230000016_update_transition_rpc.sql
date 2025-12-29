-- Migration: Harden transition_phone_to_cooldown RPC
-- Phase: Compatibility Sweep / Hardening
-- Description: Add ownership check, search_path, and full clear of IDs
CREATE OR REPLACE FUNCTION public.transition_phone_to_cooldown(
        p_phone_id UUID,
        p_account_id UUID,
        p_reason TEXT,
        p_cooldown_interval INTERVAL DEFAULT '28 days'
    ) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_phone_record RECORD;
v_user_account_id UUID;
BEGIN -- 1. Security Check: Validate Ownership (if called by user)
-- service_role (null uid) bypasses this check
IF (auth.uid() IS NOT NULL) THEN v_user_account_id := get_user_account_id(auth.uid());
IF (p_account_id != v_user_account_id) THEN RAISE EXCEPTION 'Unauthorized: Account ID mismatch';
END IF;
END IF;
-- 2. Verify phone status
SELECT * INTO v_phone_record
FROM public.phone_numbers
WHERE id = p_phone_id
    AND assigned_account_id = p_account_id
    AND lifecycle_status = 'assigned' FOR
UPDATE;
IF v_phone_record.id IS NULL THEN -- Phone not found or not assigned to this account
RETURN FALSE;
END IF;
-- 3. Update phone_numbers (Clear & Set)
UPDATE public.phone_numbers
SET lifecycle_status = 'cooldown',
    assigned_account_id = NULL,
    account_id = NULL,
    -- Clear legacy column
    released_at = now(),
    cooldown_until = now() + p_cooldown_interval,
    last_lifecycle_change_at = now(),
    updated_at = now()
WHERE id = p_phone_id;
-- 4. Close active assignment
UPDATE public.phone_number_assignments
SET ended_at = now(),
    end_reason = p_reason
WHERE phone_number_id = p_phone_id
    AND account_id = p_account_id
    AND ended_at IS NULL;
RETURN TRUE;
END;
$$;