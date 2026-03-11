-- =============================================================================
-- Migration: Fix Supabase Security Warnings
-- Date: 2026-03-11
-- Purpose: Address all security warnings from Supabase linter:
--   - ERROR: policy_exists_rls_disabled (signup_leads, staff_roles)
--   - ERROR: security_definer_view (13 views)
--   - ERROR: rls_disabled_in_public (7 tables)
--   - WARN:  function_search_path_mutable (24 functions)
--   - WARN:  rls_policy_always_true (3 policies)
-- NOTE: auth_leaked_password_protection must be fixed in Supabase dashboard.
-- =============================================================================

-- =============================================================================
-- PART 1: Enable RLS on tables that have policies but RLS was never activated
-- =============================================================================

-- signup_leads: RLS policies exist but RLS itself is off
ALTER TABLE public.signup_leads ENABLE ROW LEVEL SECURITY;

-- staff_roles: RLS policies exist but RLS itself is off
ALTER TABLE public.staff_roles ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- PART 2: Enable RLS on public tables with no RLS at all
-- =============================================================================

-- voice_library: reference data table (voices available for selection)
-- Read access is intentionally public; writes are admin-only via service_role
ALTER TABLE public.voice_library ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'voice_library' AND policyname = 'Anyone can view voice library'
  ) THEN
    CREATE POLICY "Anyone can view voice library"
      ON public.voice_library FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'voice_library' AND policyname = 'Service role manages voice library'
  ) THEN
    CREATE POLICY "Service role manages voice library"
      ON public.voice_library FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- vapi_assistants: internal integration table, accessed only by service_role and account members
ALTER TABLE public.vapi_assistants ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'vapi_assistants' AND policyname = 'Service role manages vapi_assistants'
  ) THEN
    CREATE POLICY "Service role manages vapi_assistants"
      ON public.vapi_assistants FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'vapi_assistants' AND policyname = 'Account members can view their vapi_assistants'
  ) THEN
    CREATE POLICY "Account members can view their vapi_assistants"
      ON public.vapi_assistants FOR SELECT
      TO authenticated
      USING (public.check_account_access(account_id));
  END IF;
END $$;

-- vapi_numbers: internal integration table, accessed only by service_role and account members
ALTER TABLE public.vapi_numbers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'vapi_numbers' AND policyname = 'Service role manages vapi_numbers'
  ) THEN
    CREATE POLICY "Service role manages vapi_numbers"
      ON public.vapi_numbers FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'vapi_numbers' AND policyname = 'Account members can view their vapi_numbers'
  ) THEN
    CREATE POLICY "Account members can view their vapi_numbers"
      ON public.vapi_numbers FOR SELECT
      TO authenticated
      USING (public.check_account_access(account_id));
  END IF;
END $$;

-- provisioning_jobs: internal job queue, accessed only by service_role and account members
ALTER TABLE public.provisioning_jobs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'provisioning_jobs' AND policyname = 'Service role manages provisioning_jobs'
  ) THEN
    CREATE POLICY "Service role manages provisioning_jobs"
      ON public.provisioning_jobs FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'provisioning_jobs' AND policyname = 'Account members can view their provisioning_jobs'
  ) THEN
    CREATE POLICY "Account members can view their provisioning_jobs"
      ON public.provisioning_jobs FOR SELECT
      TO authenticated
      USING (public.check_account_access(account_id));
  END IF;
END $$;

-- provisioning_state_transitions: audit log, service_role writes, account members read
ALTER TABLE public.provisioning_state_transitions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'provisioning_state_transitions'
      AND policyname = 'Service role manages provisioning_state_transitions'
  ) THEN
    CREATE POLICY "Service role manages provisioning_state_transitions"
      ON public.provisioning_state_transitions FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'provisioning_state_transitions'
      AND policyname = 'Account members can view their state transitions'
  ) THEN
    CREATE POLICY "Account members can view their state transitions"
      ON public.provisioning_state_transitions FOR SELECT
      TO authenticated
      USING (public.check_account_access(account_id));
  END IF;
END $$;

-- call_outcome_events: re-enable RLS (was enabled but may have drifted in some envs)
ALTER TABLE public.call_outcome_events ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- PART 3: Fix SECURITY DEFINER views
-- Recreate views with security_invoker = on so the querying user's RLS applies.
-- This is the correct model: each user sees only what their own permissions allow.
-- =============================================================================

-- Admin monitoring views (read from accounts, call_pattern_alerts, usage_logs)
CREATE OR REPLACE VIEW public.admin_provisioning_status_counts
  WITH (security_invoker = on)
AS
SELECT
  coalesce(provisioning_status, 'unknown') AS provisioning_status,
  count(*)::bigint AS account_count,
  count(*) FILTER (WHERE provisioning_error IS NOT NULL)::bigint AS accounts_with_errors,
  max(updated_at) FILTER (WHERE provisioning_error IS NOT NULL) AS last_failure_at
FROM public.accounts
GROUP BY coalesce(provisioning_status, 'unknown');

CREATE OR REPLACE VIEW public.admin_provisioning_failures
  WITH (security_invoker = on)
AS
SELECT
  a.id AS account_id,
  a.company_name,
  coalesce(a.provisioning_status, 'unknown') AS provisioning_status,
  a.provisioning_error,
  greatest(a.updated_at, a.created_at) AS updated_at
FROM public.accounts a
WHERE a.provisioning_error IS NOT NULL
   OR coalesce(a.provisioning_status, '') IN ('failed', 'provisioning');

CREATE OR REPLACE VIEW public.admin_daily_call_stats
  WITH (security_invoker = on)
AS
SELECT
  (date_trunc('day', created_at))::date AS call_date,
  count(*)::bigint AS call_count,
  coalesce(sum(call_duration_seconds), 0)::bigint AS total_call_seconds,
  (coalesce(sum(call_duration_seconds), 0)::numeric / 60) AS total_call_minutes,
  coalesce(sum(call_cost_cents), 0)::bigint AS total_cost_cents
FROM public.usage_logs
WHERE created_at IS NOT NULL
GROUP BY (date_trunc('day', created_at))::date;

CREATE OR REPLACE VIEW public.admin_edge_function_error_feed
  WITH (security_invoker = on)
AS
SELECT
  cpa.id,
  cpa.created_at,
  cpa.alert_type,
  cpa.severity,
  cpa.auto_flagged,
  cpa.reviewed,
  cpa.account_id,
  a.company_name,
  cpa.alert_details,
  coalesce(cpa.alert_details ->> 'function_name', cpa.alert_details ->> 'function') AS function_name,
  coalesce(cpa.alert_details ->> 'error_message', cpa.alert_details ->> 'message') AS error_message,
  cpa.alert_details ->> 'request_id' AS request_id
FROM public.call_pattern_alerts cpa
LEFT JOIN public.accounts a ON a.id = cpa.account_id
WHERE cpa.alert_type IS NOT NULL
  AND lower(cpa.alert_type) LIKE 'edge_function%';

CREATE OR REPLACE VIEW public.admin_flagged_accounts
  WITH (security_invoker = on)
AS
SELECT
  a.id AS account_id,
  a.company_name,
  a.plan_type,
  a.provisioning_status,
  a.provisioning_error,
  a.account_status,
  a.is_flagged_for_review,
  a.flagged_reason,
  a.monthly_minutes_used,
  a.monthly_minutes_limit,
  a.created_at,
  a.updated_at,
  coalesce(alerts.total_alerts, 0)::bigint AS total_alerts,
  alerts.last_alert_at,
  alerts.alert_types
FROM public.accounts a
LEFT JOIN (
  SELECT
    account_id,
    count(*)::bigint AS total_alerts,
    max(created_at) AS last_alert_at,
    array_remove(array_agg(DISTINCT alert_type), NULL) AS alert_types
  FROM public.call_pattern_alerts
  GROUP BY account_id
) alerts ON alerts.account_id = a.id
WHERE coalesce(a.is_flagged_for_review, false) = true
   OR a.flagged_reason IS NOT NULL
   OR a.provisioning_error IS NOT NULL
   OR (a.account_status IS NOT NULL AND a.account_status <> 'active')
   OR coalesce(alerts.total_alerts, 0) > 0;

-- Operator dashboard views (read from call_logs, customer_leads, appointments)
CREATE OR REPLACE VIEW public.operator_calls_today
  WITH (security_invoker = on)
AS
SELECT
  account_id,
  COUNT(*) AS calls_count,
  SUM(duration_seconds) AS total_duration_seconds,
  SUM(cost) AS total_cost_cents,
  ROUND(AVG(duration_seconds)) AS avg_duration_seconds,
  MAX(started_at) AS last_call_at
FROM public.call_logs
WHERE started_at >= CURRENT_DATE
  AND started_at < CURRENT_DATE + INTERVAL '1 day'
GROUP BY account_id;

CREATE OR REPLACE VIEW public.operator_leads_today
  WITH (security_invoker = on)
AS
SELECT
  account_id,
  COUNT(*) AS leads_count,
  COUNT(*) FILTER (WHERE lead_status = 'new') AS new_count,
  COUNT(*) FILTER (WHERE lead_status = 'contacted') AS contacted_count,
  COUNT(*) FILTER (WHERE intent = 'appointment') AS appointment_intent_count,
  COUNT(*) FILTER (WHERE intent = 'quote') AS quote_intent_count,
  COUNT(*) FILTER (WHERE urgency = 'emergency') AS emergency_count,
  COUNT(*) FILTER (WHERE urgency = 'high') AS high_urgency_count,
  MAX(created_at) AS last_lead_at
FROM public.customer_leads
WHERE created_at >= CURRENT_DATE
  AND created_at < CURRENT_DATE + INTERVAL '1 day'
GROUP BY account_id;

CREATE OR REPLACE VIEW public.operator_pending_appointments
  WITH (security_invoker = on)
AS
SELECT
  account_id,
  COUNT(*) AS pending_count,
  COUNT(*) FILTER (WHERE urgency = 'emergency') AS emergency_count,
  COUNT(*) FILTER (WHERE urgency = 'high') AS high_urgency_count,
  MIN(created_at) AS oldest_pending_at,
  MAX(created_at) AS newest_pending_at
FROM public.appointments
WHERE status = 'pending_confirmation'
GROUP BY account_id;

CREATE OR REPLACE VIEW public.operator_dashboard_summary
  WITH (security_invoker = on)
AS
SELECT
  a.id AS account_id,
  a.company_name,
  a.trade,
  COALESCE(c.calls_count, 0) AS calls_today,
  COALESCE(c.total_duration_seconds, 0) AS call_duration_seconds_today,
  COALESCE(l.leads_count, 0) AS leads_today,
  COALESCE(l.new_count, 0) AS new_leads_today,
  COALESCE(l.appointment_intent_count, 0) AS appointment_requests_today,
  COALESCE(l.emergency_count, 0) AS emergency_leads_today,
  COALESCE(p.pending_count, 0) AS pending_appointments,
  COALESCE(p.emergency_count, 0) AS emergency_appointments,
  c.last_call_at,
  l.last_lead_at,
  p.oldest_pending_at,
  p.newest_pending_at
FROM public.accounts a
LEFT JOIN public.operator_calls_today c ON c.account_id = a.id
LEFT JOIN public.operator_leads_today l ON l.account_id = a.id
LEFT JOIN public.operator_pending_appointments p ON p.account_id = a.id;

-- account_service_hours: convenience view of business hours
CREATE OR REPLACE VIEW public.account_service_hours
  WITH (security_invoker = on)
AS
SELECT
  a.id AS account_id,
  a.company_name,
  a.business_hours,
  a.booking_mode,
  a.default_appointment_duration_minutes,
  a.destination_phone
FROM public.accounts a
WHERE a.business_hours IS NOT NULL;

-- daily_account_usage: aggregated usage view for billing/reporting
CREATE OR REPLACE VIEW public.daily_account_usage
  WITH (security_invoker = on)
AS
SELECT
  account_id,
  date_trunc('day', occurred_at) AS date,
  count(*) AS total_calls,
  coalesce(sum(duration_seconds), 0) / 60 AS total_minutes,
  count(*) FILTER (WHERE outcome = 'new_lead') AS total_leads
FROM public.call_outcome_events
GROUP BY 1, 2;

-- phone_number_identity: canonical phone identity view
CREATE OR REPLACE VIEW public.phone_number_identity
  WITH (security_invoker = on)
AS
SELECT
  pn.id,
  pn.account_id,
  COALESCE(pn.e164_number, pn.phone_number) AS canonical_number,
  pn.provider_phone_number_id,
  pn.e164_number,
  pn.phone_number,
  pn.vapi_phone_id,
  pn.status,
  pn.lifecycle_status,
  pn.assigned_account_id,
  pn.is_primary,
  pn.area_code,
  pn.created_at
FROM public.phone_numbers pn;

-- Re-grant permissions that were on the old views
GRANT SELECT ON public.admin_provisioning_status_counts TO authenticated, service_role;
GRANT SELECT ON public.admin_provisioning_failures TO authenticated, service_role;
GRANT SELECT ON public.admin_daily_call_stats TO authenticated, service_role;
GRANT SELECT ON public.admin_edge_function_error_feed TO authenticated, service_role;
GRANT SELECT ON public.admin_flagged_accounts TO authenticated, service_role;
GRANT SELECT ON public.operator_calls_today TO authenticated;
GRANT SELECT ON public.operator_leads_today TO authenticated;
GRANT SELECT ON public.operator_pending_appointments TO authenticated;
GRANT SELECT ON public.operator_dashboard_summary TO authenticated;
GRANT SELECT ON public.account_service_hours TO authenticated;
GRANT SELECT ON public.daily_account_usage TO authenticated;
GRANT SELECT ON public.phone_number_identity TO authenticated, service_role;

-- =============================================================================
-- PART 4: Fix functions with mutable search_path
-- Using ALTER FUNCTION to safely set search_path without recreating function bodies.
-- =============================================================================

-- Functions with known signatures (from migration files):

ALTER FUNCTION public.profiles_set_updated_at()
  SET search_path = 'public';

ALTER FUNCTION public.create_profile_if_missing_on_auth_user_insert()
  SET search_path = 'public';

ALTER FUNCTION public.is_within_service_hours(UUID, TIMESTAMPTZ)
  SET search_path = 'public';

-- create_account_transaction: find the function dynamically since its signature
-- may vary (signup_channel_type was rolled back and replaced with TEXT in some envs)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT oid::regprocedure::text AS sig
    FROM pg_proc
    WHERE proname = 'create_account_transaction'
      AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = ''public''', r.sig);
    RAISE NOTICE 'Fixed search_path for %', r.sig;
  END LOOP;
END $$;

ALTER FUNCTION public.get_pool_stats()
  SET search_path = 'public';

ALTER FUNCTION public.get_recent_calls(UUID, INTEGER)
  SET search_path = 'public';

ALTER FUNCTION public.sync_phone_legacy_status()
  SET search_path = 'public';

ALTER FUNCTION public.allocate_phone_number_from_pool(UUID, INTERVAL)
  SET search_path = 'public';

ALTER FUNCTION public.record_stripe_event(TEXT, TEXT, JSONB, TEXT, TEXT)
  SET search_path = 'public';

ALTER FUNCTION public.get_calls_today(UUID)
  SET search_path = 'public';

ALTER FUNCTION public.mark_stripe_event_processed(TEXT, UUID, TEXT)
  SET search_path = 'public';

ALTER FUNCTION public.create_auth_user_internal(TEXT, TEXT, JSONB)
  SET search_path = 'public';

ALTER FUNCTION public.refresh_user_jwt(UUID)
  SET search_path = 'public';

ALTER FUNCTION public.cleanup_expired_auth_tokens()
  SET search_path = 'public';

ALTER FUNCTION public.cleanup_old_rate_limits()
  SET search_path = 'public';

ALTER FUNCTION public.log_auth_event(UUID, UUID, TEXT, JSONB, INET, TEXT, BOOLEAN)
  SET search_path = 'public';

ALTER FUNCTION public.check_rate_limit(TEXT, TEXT, INTEGER, INTEGER)
  SET search_path = 'public';

ALTER FUNCTION public.get_user_primary_role(UUID)
  SET search_path = 'public';

ALTER FUNCTION public.get_user_account_id(UUID)
  SET search_path = 'public';

ALTER FUNCTION public.custom_access_token_hook(JSONB)
  SET search_path = 'public';

-- has_role has two overloads: (UUID, TEXT) from jwt_claims_and_rbac and (UUID, app_role) from earlier
ALTER FUNCTION public.has_role(UUID, TEXT)
  SET search_path = 'public';

ALTER FUNCTION public.has_any_role(UUID, TEXT[])
  SET search_path = 'public';

ALTER FUNCTION public.has_account_access(UUID, UUID)
  SET search_path = 'public';

-- For create_account_minimal: dynamically find and fix any matching signature
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT oid::regprocedure::text AS sig
    FROM pg_proc
    WHERE proname = 'create_account_minimal'
      AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = ''public''', r.sig);
    RAISE NOTICE 'Fixed search_path for %', r.sig;
  END LOOP;
END $$;

-- =============================================================================
-- PART 5: Fix overly permissive RLS policies (rls_policy_always_true)
-- =============================================================================

-- 5a. call_webhook_inbox: "Service role full access to inbox" applies to ALL roles
--     with USING(true)/WITH CHECK(true). service_role already bypasses RLS, so
--     this broad policy accidentally gives anon/authenticated full unrestricted access.
--     Fix: Remove the overly broad policy. Add a staff-only read policy instead.
DROP POLICY IF EXISTS "Service role full access to inbox" ON public.call_webhook_inbox;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'call_webhook_inbox'
      AND policyname = 'Staff can read webhook inbox'
  ) THEN
    CREATE POLICY "Staff can read webhook inbox"
      ON public.call_webhook_inbox FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.staff_roles
          WHERE user_id = auth.uid()
            AND role::text IN ('admin', 'support', 'platform_admin', 'platform_owner')
        )
      );
  END IF;
END $$;

-- 5b. resource_subscriber_leads: "Anyone can insert resource leads" applies to ALL roles.
--     This is an intentional lead-capture form policy, but it should be explicitly
--     scoped to anon + authenticated rather than every possible database role.
DROP POLICY IF EXISTS "Anyone can insert resource leads" ON public.resource_subscriber_leads;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'resource_subscriber_leads'
      AND policyname = 'Anyone can insert resource leads'
  ) THEN
    CREATE POLICY "Anyone can insert resource leads"
      ON public.resource_subscriber_leads FOR INSERT
      TO anon, authenticated
      WITH CHECK (true);
  END IF;
END $$;

-- 5c. revenue_report_leads: "Anyone can create revenue report leads" is TO anon and
--     WITH CHECK(true). This is intentional for the calculator lead form. The warning
--     exists because WITH CHECK(true) allows any row content. The NOT NULL constraints
--     on name, email, business provide the real validation. No functional change needed;
--     we recreate to ensure the TO anon scope is explicit.
DROP POLICY IF EXISTS "Anyone can create revenue report leads" ON public.revenue_report_leads;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'revenue_report_leads'
      AND policyname = 'Anyone can create revenue report leads'
  ) THEN
    CREATE POLICY "Anyone can create revenue report leads"
      ON public.revenue_report_leads FOR INSERT
      TO anon
      WITH CHECK (true);
  END IF;
END $$;

-- =============================================================================
-- VERIFICATION NOTICE
-- =============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Security fix migration complete.';
  RAISE NOTICE 'Remaining manual step: Enable Leaked Password Protection in Supabase Auth dashboard.';
  RAISE NOTICE 'Path: Supabase Dashboard > Authentication > Password Settings > Enable HaveIBeenPwned protection.';
END $$;
