-- ============================================================================
-- Migration: Update get_onboarding_state RPC with SECURITY DEFINER
-- Date: 2026-01-05
-- Purpose: Fix test call detection and persist verified state atomically
-- ============================================================================
-- Drop existing function to recreate with proper security
DROP FUNCTION IF EXISTS get_onboarding_state(UUID);
-- ============================================================================
-- RPC: get_onboarding_state
-- Returns current onboarding state and persists test_call_verified_at when detected
-- SECURITY DEFINER with auth.uid() enforcement
-- ============================================================================
CREATE OR REPLACE FUNCTION get_onboarding_state(p_account_id UUID) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_user_id UUID;
v_user_account_id UUID;
v_account RECORD;
v_primary_phone RECORD;
v_test_call_detected BOOLEAN := FALSE;
v_forwarding_confirmed BOOLEAN := FALSE;
v_forwarding_verify_started_at TIMESTAMPTZ := NULL;
v_recommended_next_step TEXT := 'provisioning';
v_test_call_verified_at TIMESTAMPTZ := NULL;
v_onboarding_completed_at TIMESTAMPTZ := NULL;
v_row_count INTEGER;
v_result JSONB;
BEGIN -- SECURITY: Verify p_account_id belongs to authenticated user
v_user_id := auth.uid();
IF v_user_id IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated');
END IF;
SELECT account_id INTO v_user_account_id
FROM profiles
WHERE id = v_user_id;
IF v_user_account_id IS NULL
OR v_user_account_id != p_account_id THEN RETURN jsonb_build_object('error', 'Account access denied');
END IF;
-- Get account data including durable onboarding fields
SELECT provisioning_status,
    phone_number_status,
    test_call_verified_at,
    onboarding_completed_at INTO v_account
FROM accounts
WHERE id = p_account_id;
IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Account not found');
END IF;
v_test_call_verified_at := v_account.test_call_verified_at;
v_onboarding_completed_at := v_account.onboarding_completed_at;
-- Get primary phone number
SELECT id,
    phone_number,
    activated_at INTO v_primary_phone
FROM phone_numbers
WHERE (
        account_id = p_account_id
        OR assigned_account_id = p_account_id
    )
    AND is_primary = TRUE
    AND status = 'active'
LIMIT 1;
-- Check for test call using phone_number_id (NOT to_number which can be null)
-- Only check if not already verified
IF v_primary_phone.id IS NOT NULL
AND v_test_call_verified_at IS NULL THEN
SELECT EXISTS (
        SELECT 1
        FROM call_logs
        WHERE phone_number_id = v_primary_phone.id
            AND direction = 'inbound'
            AND duration_seconds >= 10
            AND status = 'completed' -- Check for test call recent window (tightened to start after activation or last 2 hours)
            AND started_at >= COALESCE(
                v_primary_phone.activated_at,
                NOW() - INTERVAL '2 hours'
            )
    ) INTO v_test_call_detected;
-- IDEMPOTENT: Persist test_call_verified_at atomically if detected
IF v_test_call_detected THEN
UPDATE accounts
SET test_call_verified_at = NOW()
WHERE id = p_account_id
    AND test_call_verified_at IS NULL;
-- Only log event if we actually updated the row (prevents duplicate events)
GET DIAGNOSTICS v_row_count = ROW_COUNT;
IF v_row_count > 0 THEN
INSERT INTO onboarding_events (account_id, user_id, step, status, metadata)
VALUES (
        p_account_id,
        v_user_id,
        'test_call',
        'completed',
        jsonb_build_object('phone_number_id', v_primary_phone.id)
    );
v_test_call_verified_at := NOW();
END IF;
END IF;
ELSIF v_test_call_verified_at IS NOT NULL THEN v_test_call_detected := TRUE;
END IF;
-- Check for forwarding confirmed event in system_events
SELECT EXISTS (
        SELECT 1
        FROM system_events
        WHERE account_id = p_account_id
            AND event_name = 'onboarding.forwarding_confirmed'
    ) INTO v_forwarding_confirmed;
-- Get forwarding verify started timestamp
SELECT created_at INTO v_forwarding_verify_started_at
FROM system_events
WHERE account_id = p_account_id
    AND event_name = 'onboarding.forwarding_verify_started'
ORDER BY created_at DESC
LIMIT 1;
-- Determine recommended next step
IF v_onboarding_completed_at IS NOT NULL THEN v_recommended_next_step := 'complete';
ELSIF v_account.provisioning_status != 'completed'
OR v_primary_phone.id IS NULL THEN v_recommended_next_step := 'provisioning';
ELSIF NOT v_test_call_detected THEN v_recommended_next_step := 'test_call';
ELSIF NOT v_forwarding_confirmed THEN v_recommended_next_step := 'forwarding';
ELSE v_recommended_next_step := 'complete';
END IF;
-- Build result
v_result := jsonb_build_object(
    'provisioning_status',
    v_account.provisioning_status,
    'has_active_primary_number',
    (v_primary_phone.id IS NOT NULL),
    'primary_phone_number_id',
    v_primary_phone.id,
    'primary_phone_number',
    v_primary_phone.phone_number,
    'activated_at',
    v_primary_phone.activated_at,
    'test_call_detected',
    v_test_call_detected,
    'test_call_verified_at',
    v_test_call_verified_at,
    'forwarding_confirmed',
    v_forwarding_confirmed,
    'forwarding_verify_started_at',
    v_forwarding_verify_started_at,
    'onboarding_completed_at',
    v_onboarding_completed_at,
    'recommended_next_step',
    v_recommended_next_step
);
RETURN v_result;
END;
$$;
-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_onboarding_state(UUID) TO authenticated;
COMMENT ON FUNCTION get_onboarding_state IS 'Returns onboarding state for an account. SECURITY DEFINER with auth.uid() check. 
   Persists test_call_verified_at atomically when call detected. 
   Uses phone_number_id join for test call detection (not to_number).';