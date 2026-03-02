-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: pricing_restructure
-- DATE: 2026-03-02
-- PURPOSE: Introduce new 4-plan pricing structure for RingSnap launch.
--   - New `plans` table replaces `plan_definitions` for dashboard logic
--   - Extends `accounts`/subscriptions columns with new billing fields
--   - Creates `usage_alerts` table
--   - Adds overflow behavior and Night & Weekend restriction fields
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. PLANS TABLE
--    Creates or alters the `plans` table. The old `plan_definitions` table
--    is left intact as a read-only archive; this new table drives all logic.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.plans (
  plan_key                         text PRIMARY KEY,
  display_name                     text NOT NULL,
  base_price_cents                 int  NOT NULL,
  included_minutes                 int  NOT NULL,
  overage_rate_cents               int  NOT NULL,
  system_overage_ceiling_minutes   int  NOT NULL, -- hard max overage (non-user-configurable)
  stripe_price_id                  text NOT NULL DEFAULT '',
  stripe_overage_price_id          text NOT NULL DEFAULT '',
  stripe_product_id                text NOT NULL DEFAULT '',
  trial_days                       int  NOT NULL DEFAULT 3,
  trial_minutes                    int  NOT NULL DEFAULT 50,
  is_active                        boolean NOT NULL DEFAULT true,
  sort_order                       int  NOT NULL,
  description                      text,
  badge_text                       text,         -- e.g. 'Best Value', 'Recommended'
  is_recommended                   boolean NOT NULL DEFAULT false,
  coverage_hours                   text          -- 'after_hours_only' | '24_7'
);

-- Seed all 4 plans (idempotent via ON CONFLICT)
INSERT INTO public.plans
  (plan_key, display_name, base_price_cents, included_minutes, overage_rate_cents,
   system_overage_ceiling_minutes, trial_days, trial_minutes, is_active,
   sort_order, description, badge_text, is_recommended, coverage_hours)
VALUES
  ('night_weekend', 'Night & Weekend', 5900, 150, 45, 100,
   3, 50, true, 1,
   'After-hours and weekend coverage to capture emergency revenue',
   NULL, false, 'after_hours_only'),

  ('lite', 'Lite', 12900, 300, 38, 150,
   3, 50, true, 2,
   '24/7 coverage for handymen, painters, and roofers',
   NULL, false, '24_7'),

  ('core', 'Core', 22900, 600, 28, 200,
   3, 50, true, 3,
   '24/7 coverage for plumbers and HVAC contractors',
   'Best Value', true, '24_7'),

  ('pro', 'Pro', 39900, 1200, 22, 300,
   3, 50, true, 4,
   'High-volume contractors and multi-truck operations',
   NULL, false, '24_7')

ON CONFLICT (plan_key) DO UPDATE SET
  display_name                   = EXCLUDED.display_name,
  base_price_cents               = EXCLUDED.base_price_cents,
  included_minutes               = EXCLUDED.included_minutes,
  overage_rate_cents             = EXCLUDED.overage_rate_cents,
  system_overage_ceiling_minutes = EXCLUDED.system_overage_ceiling_minutes,
  trial_days                     = EXCLUDED.trial_days,
  trial_minutes                  = EXCLUDED.trial_minutes,
  is_active                      = EXCLUDED.is_active,
  sort_order                     = EXCLUDED.sort_order,
  description                    = EXCLUDED.description,
  badge_text                     = EXCLUDED.badge_text,
  is_recommended                 = EXCLUDED.is_recommended,
  coverage_hours                 = EXCLUDED.coverage_hours;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ACCOUNTS TABLE — NEW SUBSCRIPTION & USAGE COLUMNS
-- ─────────────────────────────────────────────────────────────────────────────

-- plan_key references new plans table
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS plan_key text REFERENCES public.plans(plan_key);

-- Usage tracking (per billing period)
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS minutes_used_current_period     int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overage_minutes_current_period  int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_period_start            timestamptz,
  ADD COLUMN IF NOT EXISTS current_period_end              timestamptz;

-- Trial tracking
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS trial_minutes_used   int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trial_minutes_limit  int NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS trial_active         boolean NOT NULL DEFAULT false;

-- Alert dedup tracking
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS alerts_sent          jsonb NOT NULL DEFAULT '{}';

-- Stripe overage subscription item ID (for reporting metered usage)
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS stripe_overage_item_id text;

-- Overflow behavior: what happens when included minutes are exhausted
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS overflow_behavior text NOT NULL DEFAULT 'always_answer'
    CHECK (overflow_behavior IN ('always_answer', 'soft_cap', 'hard_cap'));

-- Soft cap: user-defined buffer minutes when overflow_behavior = 'soft_cap'
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS soft_cap_overage_minutes int NOT NULL DEFAULT 100;

-- Night & Weekend: count of daytime calls rejected (resets each period)
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS rejected_daytime_calls int NOT NULL DEFAULT 0;

-- System ceiling alert: tracks if the ceiling alert was sent this period
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS ceiling_reject_sent boolean NOT NULL DEFAULT false;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. USAGE_ALERTS TABLE
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.usage_alerts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id       uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  alert_type       text NOT NULL,  -- '70_pct', '90_pct', 'trial_70_pct', 'trial_90_pct',
                                   -- 'overage_started', 'ceiling_hit', 'trial_ended_minutes',
                                   -- 'trial_ended_time', 'ceiling_reject'
  sent_at          timestamptz NOT NULL DEFAULT now(),
  period_start     timestamptz,
  metadata         jsonb DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_usage_alerts_account_id ON public.usage_alerts(account_id);
CREATE INDEX IF NOT EXISTS idx_usage_alerts_sent_at    ON public.usage_alerts(sent_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. BACKFILL plan_key FROM existing plan_type WHERE possible
-- ─────────────────────────────────────────────────────────────────────────────

-- Map old plan_type values to new plan_key values (best-effort)
UPDATE public.accounts SET plan_key = CASE
  WHEN plan_type = 'starter'      THEN 'lite'
  WHEN plan_type = 'professional' THEN 'core'
  WHEN plan_type = 'premium'      THEN 'pro'
  WHEN plan_type = 'trial'        THEN 'night_weekend'
  ELSE 'night_weekend'
END
WHERE plan_key IS NULL;

-- Default new accounts to night_weekend
ALTER TABLE public.accounts
  ALTER COLUMN plan_key SET DEFAULT 'night_weekend';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS POLICIES
-- ─────────────────────────────────────────────────────────────────────────────

-- plans: public read, service role full access
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'plans' AND policyname = 'plans_public_select'
  ) THEN
    CREATE POLICY plans_public_select ON public.plans
      FOR SELECT TO PUBLIC USING (true);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'plans' AND policyname = 'plans_service_role_all'
  ) THEN
    CREATE POLICY plans_service_role_all ON public.plans
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$$;

-- usage_alerts: service role only (no direct user access)
ALTER TABLE public.usage_alerts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'usage_alerts' AND policyname = 'usage_alerts_service_role_all'
  ) THEN
    CREATE POLICY usage_alerts_service_role_all ON public.usage_alerts
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. INDEXES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_accounts_plan_key ON public.accounts(plan_key);
CREATE INDEX IF NOT EXISTS idx_accounts_trial_active ON public.accounts(trial_active) WHERE trial_active = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. COMMENTS
-- ─────────────────────────────────────────────────────────────────────────────

COMMENT ON TABLE public.plans IS 'RingSnap pricing plans — authoritative source for plan config. Old plan_definitions table preserved as archive.';
COMMENT ON COLUMN public.plans.system_overage_ceiling_minutes IS 'Hard maximum overage minutes beyond included. Non-user-configurable safety ceiling.';
COMMENT ON COLUMN public.plans.coverage_hours IS 'after_hours_only = Night & Weekend plan (6PM-8AM M-F + weekends). 24_7 = all other plans.';
COMMENT ON COLUMN public.accounts.overflow_behavior IS 'User-selected behavior when included minutes are exhausted: always_answer (default), soft_cap, or hard_cap.';
COMMENT ON COLUMN public.accounts.trial_active IS 'True while account is within 3-day trial window. Set false on expiry or conversion.';
COMMENT ON COLUMN public.accounts.alerts_sent IS 'JSONB map of alert_type to timestamp. Used to prevent duplicate alerts within a billing period.';
COMMENT ON TABLE public.usage_alerts IS 'Audit log of all usage threshold alerts sent. Used for dedup and reporting.';
