-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: sync_trial_usage_summary_rpcs
-- DATE: 2026-03-29
-- PURPOSE: Fix increment_trial_live_calls and increment_verification_calls
--          to keep trial_usage_summary in sync with accounts.
--
--   Bug: trial_usage_summary was created at trial start with all counters = 0,
--   but the RPC functions only updated accounts. The analytics/audit table
--   became immediately stale after the first call.
--
--   Fix: Each RPC now does a second UPDATE on trial_usage_summary WHERE
--   trial_conversion_status = 'pending', ensuring the active trial row
--   stays in sync. Core enforcement is unaffected (uses accounts).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. increment_trial_live_calls — also syncs trial_usage_summary
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.increment_trial_live_calls(
  p_account_id uuid,
  p_delta      int DEFAULT 1
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  -- Primary enforcement counter (source of truth for trial gating)
  UPDATE public.accounts
  SET trial_live_calls_used = trial_live_calls_used + p_delta
  WHERE id = p_account_id;

  -- Analytics/audit counter — kept in sync with accounts
  UPDATE public.trial_usage_summary
  SET
    live_trial_calls_used = live_trial_calls_used + p_delta,
    updated_at            = now()
  WHERE account_id              = p_account_id
    AND trial_conversion_status = 'pending';
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. increment_verification_calls — also syncs trial_usage_summary
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.increment_verification_calls(
  p_account_id uuid,
  p_delta      int DEFAULT 1
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  -- Primary enforcement counter (source of truth for verification gating)
  UPDATE public.accounts
  SET verification_calls_used = verification_calls_used + p_delta
  WHERE id = p_account_id;

  -- Analytics/audit counter — kept in sync with accounts
  UPDATE public.trial_usage_summary
  SET
    verification_calls_used = verification_calls_used + p_delta,
    updated_at              = now()
  WHERE account_id              = p_account_id
    AND trial_conversion_status = 'pending';
END;
$$;
