-- Migration: Allocator RPC (Concurrency Safe)
-- Description: Function to safely allocate a pooled phone number using row locking.
CREATE OR REPLACE FUNCTION public.allocate_pooled_phone_number(p_account_id UUID, p_area_code TEXT) RETURNS TABLE (
        id UUID,
        e164_number TEXT,
        vapi_phone_id TEXT,
        provider_phone_number_id TEXT,
        twilio_phone_number_sid TEXT
    ) LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_phone_id UUID;
BEGIN -- 1. Attempt to find and lock a pooled number
-- We prioritize numbers that have been in the pool longest (implicitly by id or explicitly if we had pooled_at)
-- 'FOR UPDATE SKIP LOCKED' ensures we skip any rows currently locked by another transaction
SELECT p.id INTO v_phone_id
FROM public.phone_numbers p
WHERE p.lifecycle_status = 'pool'
    AND p.area_code = p_area_code
    AND p.status = 'active' -- Ensure it's technically active/valid
LIMIT 1 FOR
UPDATE SKIP LOCKED;
-- 2. If found, assign it immediately
IF v_phone_id IS NOT NULL THEN
UPDATE public.phone_numbers
SET lifecycle_status = 'assigned',
    assigned_account_id = p_account_id,
    account_id = p_account_id,
    -- Legacy mirror
    assigned_at = now(),
    updated_at = now()
WHERE public.phone_numbers.id = v_phone_id
RETURNING public.phone_numbers.id,
    public.phone_numbers.e164_number,
    public.phone_numbers.vapi_phone_id,
    public.phone_numbers.provider_phone_number_id,
    public.phone_numbers.twilio_phone_number_sid INTO id,
    e164_number,
    vapi_phone_id,
    provider_phone_number_id,
    twilio_phone_number_sid;
RETURN NEXT;
END IF;
-- If not found, return empty result (caller handles provisioning new)
RETURN;
END;
$$;
-- Grant execute to service role only (provisioning function runs as service role)
REVOKE ALL ON FUNCTION public.allocate_pooled_phone_number(UUID, TEXT)
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.allocate_pooled_phone_number(UUID, TEXT) TO service_role;