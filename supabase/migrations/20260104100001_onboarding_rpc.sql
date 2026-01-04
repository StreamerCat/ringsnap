-- ============================================================================
-- Migration: Add Onboarding State RPCs
-- Date: 2026-01-04
-- Purpose: Server-side onboarding state computation and event tracking
-- ============================================================================
-- Drop existing functions if they exist (handles different return types)
DROP FUNCTION IF EXISTS get_onboarding_state(UUID);
DROP FUNCTION IF EXISTS track_onboarding_event(TEXT);
DROP FUNCTION IF EXISTS track_onboarding_event(TEXT, JSONB);
-- ============================================================================
-- RPC: get_onboarding_state
-- Returns current onboarding state for an account
-- ============================================================================
CREATE OR REPLACE FUNCTION get_onboarding_state(p_account_id UUID) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_account RECORD;
v_primary_phone RECORD;
v_test_call_detected BOOLEAN := FALSE;
v_forwarding_confirmed BOOLEAN := FALSE;
v_forwarding_verify_started_at TIMESTAMPTZ := NULL;
v_recommended_next_step TEXT := 'provisioning';
v_result JSONB;
BEGIN -- Get account data
SELECT provisioning_status,
    phone_number_status INTO v_account
FROM accounts
WHERE id = p_account_id;
IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Account not found');
END IF;
-- Get primary phone number
SELECT id,
    phone_number,
    activated_at INTO v_primary_phone
FROM phone_numbers
WHERE account_id = p_account_id
    AND is_primary = TRUE
    AND status = 'active'
LIMIT 1;
-- Check for test call - use phone_number_id join (NOT to_number which can be null)
IF v_primary_phone.id IS NOT NULL THEN
SELECT EXISTS (
        SELECT 1
        FROM call_logs
        WHERE phone_number_id = v_primary_phone.id
            AND direction = 'inbound'
            AND duration_seconds >= 10
    ) INTO v_test_call_detected;
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
IF v_account.provisioning_status != 'completed'
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
    'forwarding_confirmed',
    v_forwarding_confirmed,
    'forwarding_verify_started_at',
    v_forwarding_verify_started_at,
    'recommended_next_step',
    v_recommended_next_step
);
RETURN v_result;
END;
$$;
-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_onboarding_state(UUID) TO authenticated;
COMMENT ON FUNCTION get_onboarding_state IS 'Returns current onboarding state for an account including test call detection and forwarding status. Uses phone_number_id join for test call detection.';
-- ============================================================================
-- RPC: track_onboarding_event
-- Tracks onboarding events to system_events with allowlist validation
-- ============================================================================
CREATE OR REPLACE FUNCTION track_onboarding_event(
        p_event_name TEXT,
        p_metadata JSONB DEFAULT '{}'::JSONB
    ) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_user_id UUID;
v_account_id UUID;
v_allowed_events TEXT [] := ARRAY [
    'onboarding.forwarding_confirmed',
    'onboarding.forwarding_verify_started',
    'onboarding.test_call_initiated',
    'onboarding.alert.test_call_missing'
  ];
BEGIN -- Get current user
v_user_id := auth.uid();
IF v_user_id IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated');
END IF;
-- Validate event name against allowlist
IF NOT (
    p_event_name = ANY(v_allowed_events)
    OR p_event_name LIKE 'onboarding.alert.%'
) THEN RETURN jsonb_build_object('error', 'Invalid event name');
END IF;
-- Get account_id from profile
SELECT account_id INTO v_account_id
FROM profiles
WHERE id = v_user_id;
IF v_account_id IS NULL THEN RETURN jsonb_build_object('error', 'No account found for user');
END IF;
-- Insert event
INSERT INTO system_events (
        event_name,
        level,
        account_id,
        user_id,
        metadata
    )
VALUES (
        p_event_name,
        'info',
        v_account_id,
        v_user_id,
        p_metadata
    );
RETURN jsonb_build_object(
    'success',
    TRUE,
    'event_name',
    p_event_name,
    'account_id',
    v_account_id
);
END;
$$;
-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION track_onboarding_event(TEXT, JSONB) TO authenticated;
COMMENT ON FUNCTION track_onboarding_event IS 'Tracks onboarding events to system_events. Event names must be in the allowlist or match onboarding.alert.* pattern.';