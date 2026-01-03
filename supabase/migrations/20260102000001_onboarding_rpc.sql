-- Migration: Onboarding RPCs
-- Purpose: Centralize onboarding state logic and event tracking
-- Date: 2026-01-02
-- ==============================================================================
-- 1. Helper RPC to compute canonical onboarding state
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_onboarding_state(p_account_id UUID) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_account_status TEXT;
v_has_active_number BOOLEAN;
v_primary_number_id UUID;
v_primary_number TEXT;
v_activated_at TIMESTAMPTZ;
v_test_call_detected BOOLEAN := false;
v_forwarding_confirmed BOOLEAN := false;
v_forwarding_verify_started_at TIMESTAMPTZ;
v_recommended_step TEXT;
BEGIN -- 1. Get account provisioning status
SELECT provisioning_status INTO v_account_status
FROM public.accounts
WHERE id = p_account_id;
-- 2. Get primary phone number info
SELECT true,
    id,
    phone_number,
    activated_at INTO v_has_active_number,
    v_primary_number_id,
    v_primary_number,
    v_activated_at
FROM public.phone_numbers
WHERE account_id = p_account_id
    AND status = 'active'
ORDER BY created_at DESC
LIMIT 1;
-- Initialize defaults if no number found
IF v_has_active_number IS NULL THEN v_has_active_number := false;
END IF;
-- 3. Check for Test Call Detection
-- Definition: Inbound call to primary number, duration >= 10s, completed, after activation
IF v_primary_number_id IS NOT NULL THEN
SELECT EXISTS (
        SELECT 1
        FROM public.call_logs
        WHERE account_id = p_account_id
            AND phone_number_id = v_primary_number_id
            AND direction = 'inbound'
            AND status = 'completed'
            AND duration_seconds >= 10
            AND (
                v_activated_at IS NULL
                OR started_at > v_activated_at
            )
    ) INTO v_test_call_detected;
END IF;
-- 4. Check for Forwarding Confirmation (via system_events)
SELECT EXISTS (
        SELECT 1
        FROM public.system_events
        WHERE account_id = p_account_id
            AND event_name = 'onboarding.forwarding_confirmed'
    ) INTO v_forwarding_confirmed;
-- 5. Check for Verify Started timestamp
SELECT created_at INTO v_forwarding_verify_started_at
FROM public.system_events
WHERE account_id = p_account_id
    AND event_name = 'onboarding.verification_started'
ORDER BY created_at DESC
LIMIT 1;
-- 6. Determine Recommended Next Step
IF v_account_status != 'active'
AND v_account_status != 'completed' THEN v_recommended_step := 'provisioning';
-- Waiting for provisioning
ELSIF NOT v_has_active_number THEN v_recommended_step := 'provisioning';
-- Should have number but doesn't
ELSIF NOT v_test_call_detected THEN v_recommended_step := 'test_call';
-- Step 2
ELSIF NOT v_forwarding_confirmed THEN v_recommended_step := 'forwarding';
-- Step 3
ELSIF NOT v_test_call_detected THEN -- If we have confirmed forwarding but somehow lost test call status (rare), check again or verify
v_recommended_step := 'verify';
ELSE -- If test call detected AND forwarding confirmed, we consider them done for the guardrail
-- But strictly, "Verify Forwarding" is the final step which typically implies another test call.
-- For this logic: if test call detected, we are good.
v_recommended_step := 'complete';
END IF;
-- Refinement: If test_call_detected is true, do we still show 'forwarding'?
-- Yes, because test call proves the number works, but doesn't prove forwarding is set up (could be direct dial).
-- So:
IF v_test_call_detected
AND NOT v_forwarding_confirmed THEN v_recommended_step := 'forwarding';
ELSIF v_test_call_detected
AND v_forwarding_confirmed THEN v_recommended_step := 'complete';
END IF;
-- Construct JSON response
RETURN jsonb_build_object(
    'provisioning_status',
    v_account_status,
    'has_active_primary_number',
    v_has_active_number,
    'primary_phone_number_id',
    v_primary_number_id,
    'primary_phone_number',
    v_primary_number,
    'activated_at',
    v_activated_at,
    'test_call_detected',
    v_test_call_detected,
    'forwarding_confirmed',
    v_forwarding_confirmed,
    'forwarding_verify_started_at',
    v_forwarding_verify_started_at,
    'recommended_next_step',
    v_recommended_step
);
END;
$$;
-- ==============================================================================
-- 2. Helper RPC to track onboarding events safely
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.track_onboarding_event(
        p_event_name TEXT,
        p_metadata JSONB DEFAULT '{}'::jsonb
    ) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_account_id UUID;
BEGIN -- Get current user's account_id safely
SELECT account_id INTO v_account_id
FROM public.profiles
WHERE id = auth.uid();
IF v_account_id IS NULL THEN RETURN;
-- Fail silently if no account
END IF;
-- Insert into system_events
INSERT INTO public.system_events (
        event_name,
        level,
        account_id,
        user_id,
        metadata,
        trace_id -- Required by table, generate one
    )
VALUES (
        p_event_name,
        'info',
        v_account_id,
        auth.uid(),
        p_metadata,
        gen_random_uuid()::text
    );
EXCEPTION
WHEN OTHERS THEN -- Fail silently - never block UI
NULL;
END;
$$;
-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_onboarding_state(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.track_onboarding_event(TEXT, JSONB) TO authenticated;
COMMENT ON FUNCTION public.get_onboarding_state IS 'Computes consolidated onboarding state for the UI guardrails';
COMMENT ON FUNCTION public.track_onboarding_event IS 'Safely logs onboarding actions to system_events';