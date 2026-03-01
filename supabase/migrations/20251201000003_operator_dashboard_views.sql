-- Migration: Create operator dashboard views
-- Provides efficient queries for contractor daily dashboard
--
-- IMPORTANT: Depends on public.call_logs existing (hard requirement)
-- Optional dependencies: customer_leads, appointments (views skipped if missing)
-- This should run AFTER 20251201000002_create_call_logs.sql

-- ==============================================================================
-- PART 0: Verify hard requirements and check optional dependencies
-- ==============================================================================

DO $$
DECLARE
  v_has_customer_leads BOOLEAN;
  v_has_appointments BOOLEAN;
BEGIN
  -- Hard requirement: call_logs must exist
  IF to_regclass('public.call_logs') IS NULL THEN
    RAISE EXCEPTION 'Cannot create operator dashboard views: public.call_logs table does not exist. Ensure 20251201000002_create_call_logs.sql ran first.';
  END IF;

  -- Check optional dependencies
  v_has_customer_leads := to_regclass('public.customer_leads') IS NOT NULL;
  v_has_appointments := to_regclass('public.appointments') IS NOT NULL;

  IF NOT v_has_customer_leads THEN
    RAISE NOTICE 'public.customer_leads not found - skipping operator_leads_today view';
  END IF;

  IF NOT v_has_appointments THEN
    RAISE NOTICE 'public.appointments not found - skipping operator_pending_appointments view';
  END IF;

  RAISE NOTICE 'Creating operator dashboard views (call_logs required, others optional)';
END $$;

-- ==============================================================================
-- PART 1: Create views that depend ONLY on call_logs
-- ==============================================================================

-- View: Calls today by account (always created - call_logs is required)
CREATE OR REPLACE VIEW public.operator_calls_today AS
SELECT
  account_id,
  COUNT(*) as calls_count,
  SUM(duration_seconds) as total_duration_seconds,
  SUM(cost) as total_cost_cents,
  ROUND(AVG(duration_seconds)) as avg_duration_seconds,
  MAX(started_at) as last_call_at
FROM public.call_logs
WHERE started_at >= CURRENT_DATE
  AND started_at < CURRENT_DATE + INTERVAL '1 day'
GROUP BY account_id;

-- ==============================================================================
-- PART 2: Create views that depend on OPTIONAL tables (dynamic SQL)
-- ==============================================================================

-- View: Leads today by account (created only if customer_leads exists)
DO $$
BEGIN
  IF to_regclass('public.customer_leads') IS NOT NULL THEN
    EXECUTE $view$
      CREATE OR REPLACE VIEW public.operator_leads_today AS
      SELECT
        account_id,
        COUNT(*) as leads_count,
        COUNT(*) FILTER (WHERE lead_status = 'new') as new_count,
        COUNT(*) FILTER (WHERE lead_status = 'contacted') as contacted_count,
        COUNT(*) FILTER (WHERE intent = 'appointment') as appointment_intent_count,
        COUNT(*) FILTER (WHERE intent = 'quote') as quote_intent_count,
        COUNT(*) FILTER (WHERE urgency = 'emergency') as emergency_count,
        COUNT(*) FILTER (WHERE urgency = 'high') as high_urgency_count,
        MAX(created_at) as last_lead_at
      FROM public.customer_leads
      WHERE created_at >= CURRENT_DATE
        AND created_at < CURRENT_DATE + INTERVAL '1 day'
      GROUP BY account_id
    $view$;
    RAISE NOTICE 'Created view: operator_leads_today';
  ELSE
    -- Clean up stale view if table is missing
    DROP VIEW IF EXISTS public.operator_leads_today;
    RAISE NOTICE 'Skipped view: operator_leads_today (customer_leads table missing)';
  END IF;
END $$;

-- View: Pending appointments by account (created only if appointments exists)
DO $$
DECLARE
  v_has_urgency_column BOOLEAN;
BEGIN
  IF to_regclass('public.appointments') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'appointments'
        AND column_name = 'urgency'
    ) INTO v_has_urgency_column;

    IF v_has_urgency_column THEN
      EXECUTE $view$
        CREATE OR REPLACE VIEW public.operator_pending_appointments AS
        SELECT
          account_id,
          COUNT(*) as pending_count,
          COUNT(*) FILTER (WHERE urgency = 'emergency') as emergency_count,
          COUNT(*) FILTER (WHERE urgency = 'high') as high_urgency_count,
          MIN(created_at) as oldest_pending_at,
          MAX(created_at) as newest_pending_at
        FROM public.appointments
        WHERE status = 'pending_confirmation'
        GROUP BY account_id
      $view$;
      RAISE NOTICE 'Created view: operator_pending_appointments (with urgency)';
    ELSE
      EXECUTE $view$
        CREATE OR REPLACE VIEW public.operator_pending_appointments AS
        SELECT
          account_id,
          COUNT(*) as pending_count,
          0::bigint as emergency_count,
          0::bigint as high_urgency_count,
          MIN(created_at) as oldest_pending_at,
          MAX(created_at) as newest_pending_at
        FROM public.appointments
        WHERE status = 'pending_confirmation'
        GROUP BY account_id
      $view$;
      RAISE NOTICE 'Created view: operator_pending_appointments (urgency column missing; counts default to 0)';
    END IF;
  ELSE
    -- Clean up stale view if table is missing
    DROP VIEW IF EXISTS public.operator_pending_appointments;
    RAISE NOTICE 'Skipped view: operator_pending_appointments (appointments table missing)';
  END IF;
END $$;

-- ==============================================================================
-- PART 3: Create combined dashboard view (handles missing dependencies)
-- ==============================================================================

-- Combined operator dashboard view
-- Note: Uses LEFT JOIN so missing views simply result in NULL values
DO $$
BEGIN
  -- Always try to create the summary view - LEFT JOINs handle missing dependencies
  EXECUTE $view$
    CREATE OR REPLACE VIEW public.operator_dashboard_summary AS
    SELECT
      a.id as account_id,
      a.company_name,
      a.trade,
      COALESCE(c.calls_count, 0) as calls_today,
      COALESCE(c.total_duration_seconds, 0) as call_duration_seconds_today,
      COALESCE(l.leads_count, 0) as leads_today,
      COALESCE(l.new_count, 0) as new_leads_today,
      COALESCE(l.appointment_intent_count, 0) as appointment_requests_today,
      COALESCE(l.emergency_count, 0) as emergency_leads_today,
      COALESCE(p.pending_count, 0) as pending_appointments,
      COALESCE(p.emergency_count, 0) as emergency_appointments,
      c.last_call_at,
      l.last_lead_at,
      p.oldest_pending_at,
      p.newest_pending_at
    FROM public.accounts a
    LEFT JOIN public.operator_calls_today c ON c.account_id = a.id
    LEFT JOIN LATERAL (SELECT * FROM public.operator_leads_today WHERE account_id = a.id) l ON TRUE
    LEFT JOIN LATERAL (SELECT * FROM public.operator_pending_appointments WHERE account_id = a.id) p ON TRUE
  $view$;
  RAISE NOTICE 'Created view: operator_dashboard_summary';
EXCEPTION
  WHEN undefined_table THEN
    -- If operator_leads_today or operator_pending_appointments don't exist, create simplified version
    RAISE NOTICE 'Creating simplified operator_dashboard_summary (some dependency views missing)';
    EXECUTE $view$
      CREATE OR REPLACE VIEW public.operator_dashboard_summary AS
      SELECT
        a.id as account_id,
        a.company_name,
        a.trade,
        COALESCE(c.calls_count, 0) as calls_today,
        COALESCE(c.total_duration_seconds, 0) as call_duration_seconds_today,
        0 as leads_today,
        0 as new_leads_today,
        0 as appointment_requests_today,
        0 as emergency_leads_today,
        0 as pending_appointments,
        0 as emergency_appointments,
        c.last_call_at,
        NULL::timestamptz as last_lead_at,
        NULL::timestamptz as oldest_pending_at,
        NULL::timestamptz as newest_pending_at
      FROM public.accounts a
      LEFT JOIN public.operator_calls_today c ON c.account_id = a.id
    $view$;
END $$;

-- ==============================================================================
-- PART 4: Set ownership and permissions (conditional based on view existence)
-- ==============================================================================

DO $$
BEGIN
  -- Always set ownership for call_logs view
  ALTER VIEW public.operator_calls_today OWNER TO postgres;
  GRANT SELECT ON public.operator_calls_today TO authenticated;

  -- Conditionally set ownership for optional views
  IF to_regclass('public.operator_leads_today') IS NOT NULL THEN
    ALTER VIEW public.operator_leads_today OWNER TO postgres;
    GRANT SELECT ON public.operator_leads_today TO authenticated;
  END IF;

  IF to_regclass('public.operator_pending_appointments') IS NOT NULL THEN
    ALTER VIEW public.operator_pending_appointments OWNER TO postgres;
    GRANT SELECT ON public.operator_pending_appointments TO authenticated;
  END IF;

  -- Always set ownership for summary view
  ALTER VIEW public.operator_dashboard_summary OWNER TO postgres;
  GRANT SELECT ON public.operator_dashboard_summary TO authenticated;
END $$;

-- ==============================================================================
-- PART 5: Add comments (conditional based on view existence)
-- ==============================================================================

DO $$
BEGIN
  COMMENT ON VIEW public.operator_calls_today IS 'Calls received today grouped by account';

  IF to_regclass('public.operator_leads_today') IS NOT NULL THEN
    COMMENT ON VIEW public.operator_leads_today IS 'Customer leads captured today grouped by account';
  END IF;

  IF to_regclass('public.operator_pending_appointments') IS NOT NULL THEN
    COMMENT ON VIEW public.operator_pending_appointments IS 'Pending appointment confirmations grouped by account';
  END IF;

  COMMENT ON VIEW public.operator_dashboard_summary IS 'Combined dashboard metrics for operator view (degrades gracefully if optional tables missing)';
END $$;
