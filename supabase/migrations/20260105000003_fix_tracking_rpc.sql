-- ============================================================================
-- Migration: Fix track_onboarding_event RPC
-- Date: 2026-01-05
-- Purpose: Fix NOT NULL violation by supplying trace_id
-- ============================================================================
DROP FUNCTION IF EXISTS public.track_onboarding_event(TEXT, JSONB);
CREATE OR REPLACE FUNCTION track_onboarding_event(
        p_event_name TEXT,
        p_metadata JSONB DEFAULT '{}'::JSONB
    ) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_user_id UUID;
v_account_id UUID;
v_trace_id TEXT;
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
-- Generate trace_id
v_trace_id := gen_random_uuid()::text;
-- Insert event (Added trace_id to fix NOT NULL violation)
INSERT INTO system_events (
        trace_id,
        event_name,
        level,
        account_id,
        user_id,
        metadata
    )
VALUES (
        v_trace_id,
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
    v_account_id,
    'trace_id',
    v_trace_id
);
END;
$$;
-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION track_onboarding_event(TEXT, JSONB) TO authenticated;
COMMENT ON FUNCTION track_onboarding_event IS 'Tracks onboarding events to system_events. Fixes trace_id requirement.';