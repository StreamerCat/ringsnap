-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: call_based_pricing_v1
-- DATE: 2026-03-29
-- PURPOSE: Introduce call-based billing for all new plans (v1).
--
--   New pricing:
--     Night & Weekend: $59/mo, 60 calls, $1.10/overage, max +40 overage
--     Lite:            $129/mo, 125 calls, $0.95/overage, max +50 overage
--     Core:            $229/mo, 250 calls, $0.85/overage, max +75 overage
--     Pro:             $449/mo, 450 calls, $0.75/overage, max +90 overage
--
--   Additive only. Legacy minute-based columns are preserved for existing
--   customers. New columns are added alongside them. Feature flag
--   `billing_call_based_v1` controls which path is active per-account.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. PLANS TABLE — add call-based columns
-- ─────────────────────────────────────────────────────────────────────────────

-- Billing unit: 'minute' (legacy) | 'call' (new)
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS billing_unit text NOT NULL DEFAULT 'minute'
    CHECK (billing_unit IN ('minute', 'call'));

-- Call-based plan limits
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS included_calls               int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overage_rate_calls_cents     int NOT NULL DEFAULT 0, -- cents per overage call
  ADD COLUMN IF NOT EXISTS max_overage_calls            int NOT NULL DEFAULT 0, -- hard ceiling above included_calls
  ADD COLUMN IF NOT EXISTS plan_version                 int NOT NULL DEFAULT 1; -- 1=legacy, 2=call-based

-- Upsert call-based plan values for the 4 plans (idempotent)
-- These values are authoritative for plan_version=2 billing.
UPDATE public.plans SET
  billing_unit              = 'call',
  included_calls            = 60,
  overage_rate_calls_cents  = 110,   -- $1.10
  max_overage_calls         = 40,
  plan_version              = 2
WHERE plan_key = 'night_weekend';

UPDATE public.plans SET
  billing_unit              = 'call',
  included_calls            = 125,
  overage_rate_calls_cents  = 95,    -- $0.95
  max_overage_calls         = 50,
  plan_version              = 2
WHERE plan_key = 'lite';

UPDATE public.plans SET
  billing_unit              = 'call',
  included_calls            = 250,
  overage_rate_calls_cents  = 85,    -- $0.85
  max_overage_calls         = 75,
  plan_version              = 2
WHERE plan_key = 'core';

UPDATE public.plans SET
  billing_unit              = 'call',
  included_calls            = 450,
  overage_rate_calls_cents  = 75,    -- $0.75
  max_overage_calls         = 90,
  plan_version              = 2
WHERE plan_key = 'pro';

-- Also update base_price_cents to match new pricing
UPDATE public.plans SET base_price_cents = 5900  WHERE plan_key = 'night_weekend';
UPDATE public.plans SET base_price_cents = 12900 WHERE plan_key = 'lite';
UPDATE public.plans SET base_price_cents = 22900 WHERE plan_key = 'core';
UPDATE public.plans SET base_price_cents = 44900 WHERE plan_key = 'pro';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ACCOUNTS TABLE — call-based usage tracking
-- ─────────────────────────────────────────────────────────────────────────────

-- Call-based period counters (analogous to minutes_used_current_period)
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS calls_used_current_period      int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overage_calls_current_period   int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS blocked_calls_current_period   int NOT NULL DEFAULT 0;

-- Trial call tracking (new standalone trial model)
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS trial_live_calls_used          int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trial_live_calls_limit         int NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS verification_calls_used        int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verification_calls_limit       int NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS selected_post_trial_plan       text REFERENCES public.plans(plan_key),
  ADD COLUMN IF NOT EXISTS post_trial_plan_preselect_reason text; -- 'trade_hvac_plumbing' | 'multi_truck' | 'high_volume' | 'after_hours_only' | 'default'

-- Feature flag gate: once set true, account uses call-based billing
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS billing_call_based             boolean NOT NULL DEFAULT false;

-- Onboarding signals for post-trial plan preselection
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS onboarding_trade               text,
  ADD COLUMN IF NOT EXISTS onboarding_team_size           text,    -- 'solo' | '2-5' | '6-10' | '10+'
  ADD COLUMN IF NOT EXISTS onboarding_coverage_preference text;   -- 'after_hours_only' | '24_7'

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. CALL BILLING LEDGER
--    One row per handled call. Source of truth for billing.
--    Idempotent on (account_id, provider_call_id).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.call_billing_ledger (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  account_id                    uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  provider_call_id              text NOT NULL,           -- Vapi call ID (dedupe key)
  call_log_id                   uuid REFERENCES public.call_logs(id),

  -- Timing
  call_started_at               timestamptz NOT NULL,
  call_ended_at                 timestamptz,
  duration_seconds              int NOT NULL DEFAULT 0,

  -- Classification
  call_kind                     text NOT NULL DEFAULT 'live'
    CHECK (call_kind IN ('live', 'verification', 'excluded')),
  billable                      boolean NOT NULL DEFAULT false,
  billable_reason               text,    -- why counted as billable
  excluded_reason               text,    -- why excluded if not billable
  blocked_over_limit            boolean NOT NULL DEFAULT false,
  blocked_reason                text,

  -- Plan snapshot at time of call (immutable record of billing context)
  plan_key_snapshot             text,
  plan_version_snapshot         int,
  billing_unit_snapshot         text NOT NULL DEFAULT 'call',
  included_calls_snapshot       int,
  overage_rate_cents_snapshot   int,
  max_overage_calls_snapshot    int,
  overflow_mode_snapshot        text,

  -- Usage counters at time of call (for audit / reconciliation)
  calls_used_before             int,     -- calls_used_current_period before this call
  calls_used_after              int,     -- calls_used_current_period after this call

  -- Billing cycle
  billing_period_start          timestamptz,
  billing_period_end            timestamptz,

  -- Usage tracking state
  counted_in_usage              boolean NOT NULL DEFAULT false,
  counted_at                    timestamptz,

  -- COGS estimation (internal, optional)
  estimated_cogs_cents          int,     -- rough COGS for margin monitoring

  -- Audit
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now(),

  -- Dedupe constraint
  CONSTRAINT call_billing_ledger_dedupe UNIQUE (account_id, provider_call_id)
);

CREATE INDEX IF NOT EXISTS idx_cbl_account_id
  ON public.call_billing_ledger(account_id);
CREATE INDEX IF NOT EXISTS idx_cbl_provider_call_id
  ON public.call_billing_ledger(provider_call_id);
CREATE INDEX IF NOT EXISTS idx_cbl_call_started_at
  ON public.call_billing_ledger(call_started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cbl_account_period
  ON public.call_billing_ledger(account_id, billing_period_start, billable);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. BILLING PERIOD USAGE SUMMARY
--    One row per account per billing cycle. Updated after each call.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.billing_period_usage_summary (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id                    uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  plan_key                      text NOT NULL,
  plan_version                  int NOT NULL DEFAULT 2,
  billing_unit                  text NOT NULL DEFAULT 'call',

  cycle_start                   timestamptz NOT NULL,
  cycle_end                     timestamptz NOT NULL,

  included_calls                int NOT NULL DEFAULT 0,
  used_calls                    int NOT NULL DEFAULT 0,
  overage_calls                 int NOT NULL DEFAULT 0,
  blocked_calls                 int NOT NULL DEFAULT 0,

  overflow_mode                 text NOT NULL DEFAULT 'always_answer',
  soft_cap_buffer               int,

  avg_call_duration_seconds     numeric(8,2),
  p95_call_duration_seconds     numeric(8,2),
  estimated_cogs_cents          int,

  -- Notification dedup flags (reset each cycle)
  notified_80_pct               boolean NOT NULL DEFAULT false,
  notified_100_pct              boolean NOT NULL DEFAULT false,
  notified_80_pct_overage       boolean NOT NULL DEFAULT false,
  notified_cap_reached          boolean NOT NULL DEFAULT false,

  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT bpus_account_cycle UNIQUE (account_id, cycle_start)
);

CREATE INDEX IF NOT EXISTS idx_bpus_account_id
  ON public.billing_period_usage_summary(account_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. TRIAL USAGE SUMMARY
--    One row per account trial. Tracks both live and verification calls.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.trial_usage_summary (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id                    uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,

  trial_start                   timestamptz NOT NULL,
  trial_end                     timestamptz NOT NULL,

  live_trial_calls_used         int NOT NULL DEFAULT 0,
  live_trial_calls_limit        int NOT NULL DEFAULT 15,
  verification_calls_used       int NOT NULL DEFAULT 0,
  verification_calls_limit      int NOT NULL DEFAULT 3,

  selected_post_trial_plan      text REFERENCES public.plans(plan_key),
  preselect_reason              text,   -- logic reason for preselected plan

  trial_conversion_status       text NOT NULL DEFAULT 'pending'
    CHECK (trial_conversion_status IN ('pending', 'converted', 'canceled', 'expired')),
  converted_at                  timestamptz,

  -- Notification dedup
  notified_trial_started        boolean NOT NULL DEFAULT false,
  notified_80_pct_live_cap      boolean NOT NULL DEFAULT false,
  notified_live_cap_reached     boolean NOT NULL DEFAULT false,
  notified_24h_before_convert   boolean NOT NULL DEFAULT false,
  notified_6h_before_convert    boolean NOT NULL DEFAULT false,

  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tus_account_start UNIQUE (account_id, trial_start)
);

CREATE INDEX IF NOT EXISTS idx_tus_account_id
  ON public.trial_usage_summary(account_id);
CREATE INDEX IF NOT EXISTS idx_tus_trial_end
  ON public.trial_usage_summary(trial_end) WHERE trial_conversion_status = 'pending';

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. VERIFICATION CALL ALLOWLIST
--    Numbers approved for verification calls during trial.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.verification_call_allowlist (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  phone_number      text NOT NULL,   -- E.164 format
  added_by          uuid,            -- user_id who added
  label             text,            -- "Owner cell" etc.
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT vcal_account_phone UNIQUE (account_id, phone_number)
);

CREATE INDEX IF NOT EXISTS idx_vcal_account_id
  ON public.verification_call_allowlist(account_id) WHERE is_active = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. RLS POLICIES
-- ─────────────────────────────────────────────────────────────────────────────

-- call_billing_ledger: service_role only
ALTER TABLE public.call_billing_ledger ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='call_billing_ledger' AND policyname='cbl_service_role_all') THEN
    CREATE POLICY cbl_service_role_all ON public.call_billing_ledger
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='call_billing_ledger' AND policyname='cbl_owner_select') THEN
    CREATE POLICY cbl_owner_select ON public.call_billing_ledger
      FOR SELECT TO authenticated
      USING (account_id IN (
        SELECT am.account_id FROM public.account_members am
        WHERE am.user_id = auth.uid() AND am.role IN ('owner', 'admin')
      ));
  END IF;
END $$;

-- billing_period_usage_summary: service_role + owner read
ALTER TABLE public.billing_period_usage_summary ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='billing_period_usage_summary' AND policyname='bpus_service_role_all') THEN
    CREATE POLICY bpus_service_role_all ON public.billing_period_usage_summary
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='billing_period_usage_summary' AND policyname='bpus_owner_select') THEN
    CREATE POLICY bpus_owner_select ON public.billing_period_usage_summary
      FOR SELECT TO authenticated
      USING (account_id IN (
        SELECT am.account_id FROM public.account_members am
        WHERE am.user_id = auth.uid() AND am.role IN ('owner', 'admin')
      ));
  END IF;
END $$;

-- trial_usage_summary: service_role + owner read
ALTER TABLE public.trial_usage_summary ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trial_usage_summary' AND policyname='tus_service_role_all') THEN
    CREATE POLICY tus_service_role_all ON public.trial_usage_summary
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trial_usage_summary' AND policyname='tus_owner_select') THEN
    CREATE POLICY tus_owner_select ON public.trial_usage_summary
      FOR SELECT TO authenticated
      USING (account_id IN (
        SELECT am.account_id FROM public.account_members am
        WHERE am.user_id = auth.uid() AND am.role IN ('owner', 'admin')
      ));
  END IF;
END $$;

-- verification_call_allowlist: service_role + owner read/write
ALTER TABLE public.verification_call_allowlist ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='verification_call_allowlist' AND policyname='vcal_service_role_all') THEN
    CREATE POLICY vcal_service_role_all ON public.verification_call_allowlist
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='verification_call_allowlist' AND policyname='vcal_owner_all') THEN
    CREATE POLICY vcal_owner_all ON public.verification_call_allowlist
      FOR ALL TO authenticated
      USING (account_id IN (
        SELECT am.account_id FROM public.account_members am
        WHERE am.user_id = auth.uid() AND am.role IN ('owner', 'admin')
      ))
      WITH CHECK (account_id IN (
        SELECT am.account_id FROM public.account_members am
        WHERE am.user_id = auth.uid() AND am.role IN ('owner', 'admin')
      ));
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. COMMENTS
-- ─────────────────────────────────────────────────────────────────────────────

COMMENT ON COLUMN public.plans.billing_unit IS 'minute = legacy minute-based billing; call = new call-based billing (v2 plans)';
COMMENT ON COLUMN public.plans.included_calls IS 'Number of handled calls included in base price (call-based plans only)';
COMMENT ON COLUMN public.plans.overage_rate_calls_cents IS 'Cost per overage call in cents (call-based plans only)';
COMMENT ON COLUMN public.plans.max_overage_calls IS 'Hard ceiling: max overage calls above included_calls (non-user-configurable)';
COMMENT ON COLUMN public.plans.plan_version IS '1=legacy minute-based, 2=call-based (pricing_call_based_v1)';

COMMENT ON COLUMN public.accounts.billing_call_based IS 'When true, account uses call-based billing (billing_call_based_v1 flag). Legacy minute-based columns still updated for backwards compat.';
COMMENT ON COLUMN public.accounts.calls_used_current_period IS 'Number of billable handled calls this billing period (call-based plans)';
COMMENT ON COLUMN public.accounts.trial_live_calls_used IS 'Live billable calls used during trial (max 15)';
COMMENT ON COLUMN public.accounts.verification_calls_used IS 'Non-billable verification calls used during trial (max 3)';
COMMENT ON COLUMN public.accounts.selected_post_trial_plan IS 'Plan to activate when trial ends (shown and changeable during trial)';

COMMENT ON TABLE public.call_billing_ledger IS 'Source of truth for call billing. One row per call per account. Idempotent on (account_id, provider_call_id).';
COMMENT ON TABLE public.billing_period_usage_summary IS 'Per-account per-billing-cycle usage rollup. Used for dashboard and notification dedup.';
COMMENT ON TABLE public.trial_usage_summary IS 'Per-account trial usage. Tracks live and verification call counts plus conversion state.';
COMMENT ON TABLE public.verification_call_allowlist IS 'Phone numbers approved for non-billable verification calls during trial.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. STORED PROCEDURES / RPCs
-- ─────────────────────────────────────────────────────────────────────────────

-- Atomic increment of calls_used_current_period (avoids race conditions)
CREATE OR REPLACE FUNCTION public.increment_calls_used(
  p_account_id uuid,
  p_delta      int DEFAULT 1
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.accounts
  SET
    calls_used_current_period    = calls_used_current_period + p_delta,
    overage_calls_current_period = GREATEST(0,
      (calls_used_current_period + p_delta) - COALESCE(
        (SELECT included_calls FROM public.plans WHERE plan_key = accounts.plan_key),
        0
      )
    )
  WHERE id = p_account_id;
END;
$$;

-- Atomic increment of trial_live_calls_used
CREATE OR REPLACE FUNCTION public.increment_trial_live_calls(
  p_account_id uuid,
  p_delta      int DEFAULT 1
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.accounts
  SET trial_live_calls_used = trial_live_calls_used + p_delta
  WHERE id = p_account_id;
END;
$$;

-- Atomic increment of verification_calls_used
CREATE OR REPLACE FUNCTION public.increment_verification_calls(
  p_account_id uuid,
  p_delta      int DEFAULT 1
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.accounts
  SET verification_calls_used = verification_calls_used + p_delta
  WHERE id = p_account_id;
END;
$$;

-- Reset call counters at start of new billing cycle
CREATE OR REPLACE FUNCTION public.reset_call_cycle_counters(
  p_account_id        uuid,
  p_new_period_start  timestamptz,
  p_new_period_end    timestamptz
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.accounts
  SET
    calls_used_current_period      = 0,
    overage_calls_current_period   = 0,
    blocked_calls_current_period   = 0,
    ceiling_reject_sent            = false,
    alerts_sent                    = '{}',
    current_period_start           = p_new_period_start,
    current_period_end             = p_new_period_end
  WHERE id = p_account_id;
END;
$$;
