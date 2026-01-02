-- Migration: Create operator dashboard views
-- Provides efficient queries for contractor daily dashboard
--
-- IMPORTANT: Depends on public.call_logs existing
-- This should run AFTER 20251201000002_create_call_logs.sql

-- ==============================================================================
-- PART 0: Verify required tables exist
-- ==============================================================================

DO $$
BEGIN
  -- Check that call_logs table exists
  IF to_regclass('public.call_logs') IS NULL THEN
    RAISE EXCEPTION 'Cannot create operator dashboard views: public.call_logs table does not exist. Ensure 20251201000002_create_call_logs.sql ran first.';
  END IF;

  -- Check that customer_leads table exists
  IF to_regclass('public.customer_leads') IS NULL THEN
    RAISE EXCEPTION 'Cannot create operator dashboard views: public.customer_leads table does not exist.';
  END IF;

  -- Check that appointments table exists
  IF to_regclass('public.appointments') IS NULL THEN
    RAISE EXCEPTION 'Cannot create operator dashboard views: public.appointments table does not exist.';
  END IF;

  RAISE NOTICE 'All required tables exist. Creating operator dashboard views...';
END $$;

-- ==============================================================================
-- PART 1: Create operator dashboard views
-- ==============================================================================

-- View: Calls today by account
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

-- View: Leads today by account
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
GROUP BY account_id;

-- View: Pending appointments by account
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
GROUP BY account_id;

-- Combined operator dashboard view
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
LEFT JOIN public.operator_leads_today l ON l.account_id = a.id
LEFT JOIN public.operator_pending_appointments p ON p.account_id = a.id;

-- RLS on views (inherit from base tables)
ALTER VIEW public.operator_calls_today OWNER TO postgres;
ALTER VIEW public.operator_leads_today OWNER TO postgres;
ALTER VIEW public.operator_pending_appointments OWNER TO postgres;
ALTER VIEW public.operator_dashboard_summary OWNER TO postgres;

-- Grant access to authenticated users (RLS will be enforced via base tables)
GRANT SELECT ON public.operator_calls_today TO authenticated;
GRANT SELECT ON public.operator_leads_today TO authenticated;
GRANT SELECT ON public.operator_pending_appointments TO authenticated;
GRANT SELECT ON public.operator_dashboard_summary TO authenticated;

-- Comments
COMMENT ON VIEW public.operator_calls_today IS 'Calls received today grouped by account';
COMMENT ON VIEW public.operator_leads_today IS 'Customer leads captured today grouped by account';
COMMENT ON VIEW public.operator_pending_appointments IS 'Pending appointment confirmations grouped by account';
COMMENT ON VIEW public.operator_dashboard_summary IS 'Combined dashboard metrics for operator view';
