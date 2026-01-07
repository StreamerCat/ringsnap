-- ============================================================================
-- Migration: Fix SECURITY DEFINER views
-- Version: 20260107000001
-- Purpose: Replace direct view access with secure RPC functions for admin views
--          and fix operator views to use proper account scoping
-- ============================================================================

-- ============================================================================
-- PART 1: Create helper function to check if user is platform admin/owner
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_platform_staff(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_roles
    WHERE user_id = _user_id
    AND role IN ('platform_owner', 'platform_admin')
  );
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.is_platform_staff(uuid) TO authenticated;

-- ============================================================================
-- PART 2: Create secure RPC functions for admin views
-- These functions check for platform_owner/platform_admin role before returning data
-- ============================================================================

-- Function: Get provisioning status counts (admin only)
CREATE OR REPLACE FUNCTION public.rpc_admin_provisioning_status_counts()
RETURNS TABLE (
  provisioning_status text,
  account_count bigint,
  accounts_with_errors bigint,
  last_failure_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Check authorization
  IF NOT public.is_platform_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: platform_owner or platform_admin role required';
  END IF;

  RETURN QUERY
  SELECT
    coalesce(a.provisioning_status, 'unknown')::text AS provisioning_status,
    count(*)::bigint AS account_count,
    count(*) FILTER (WHERE a.provisioning_error IS NOT NULL)::bigint AS accounts_with_errors,
    max(a.updated_at) FILTER (WHERE a.provisioning_error IS NOT NULL) AS last_failure_at
  FROM public.accounts a
  GROUP BY coalesce(a.provisioning_status, 'unknown');
END;
$$;

-- Function: Get provisioning failures (admin only)
CREATE OR REPLACE FUNCTION public.rpc_admin_provisioning_failures()
RETURNS TABLE (
  account_id uuid,
  company_name text,
  provisioning_status text,
  provisioning_error text,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Check authorization
  IF NOT public.is_platform_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: platform_owner or platform_admin role required';
  END IF;

  RETURN QUERY
  SELECT
    a.id AS account_id,
    a.company_name,
    coalesce(a.provisioning_status, 'unknown')::text AS provisioning_status,
    a.provisioning_error,
    greatest(a.updated_at, a.created_at) AS updated_at
  FROM public.accounts a
  WHERE a.provisioning_error IS NOT NULL
     OR coalesce(a.provisioning_status, '') IN ('failed', 'provisioning');
END;
$$;

-- Function: Get daily call stats (admin only)
CREATE OR REPLACE FUNCTION public.rpc_admin_daily_call_stats()
RETURNS TABLE (
  call_date date,
  call_count bigint,
  total_call_seconds bigint,
  total_call_minutes numeric,
  total_cost_cents bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Check authorization
  IF NOT public.is_platform_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: platform_owner or platform_admin role required';
  END IF;

  RETURN QUERY
  SELECT
    (date_trunc('day', ul.created_at))::date AS call_date,
    count(*)::bigint AS call_count,
    coalesce(sum(ul.call_duration_seconds), 0)::bigint AS total_call_seconds,
    (coalesce(sum(ul.call_duration_seconds), 0)::numeric / 60) AS total_call_minutes,
    coalesce(sum(ul.call_cost_cents), 0)::bigint AS total_cost_cents
  FROM public.usage_logs ul
  WHERE ul.created_at IS NOT NULL
  GROUP BY (date_trunc('day', ul.created_at))::date;
END;
$$;

-- Function: Get edge function errors (admin only)
CREATE OR REPLACE FUNCTION public.rpc_admin_edge_function_error_feed()
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  alert_type text,
  severity text,
  account_id uuid,
  company_name text,
  alert_details jsonb,
  function_name text,
  error_message text,
  request_id text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Check authorization
  IF NOT public.is_platform_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: platform_owner or platform_admin role required';
  END IF;

  RETURN QUERY
  SELECT
    cpa.id,
    cpa.created_at,
    cpa.alert_type,
    cpa.severity,
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
END;
$$;

-- Function: Get flagged accounts (admin only)
CREATE OR REPLACE FUNCTION public.rpc_admin_flagged_accounts()
RETURNS TABLE (
  account_id uuid,
  company_name text,
  plan_type text,
  provisioning_status text,
  provisioning_error text,
  account_status text,
  is_flagged_for_review boolean,
  flagged_reason text,
  monthly_minutes_used integer,
  monthly_minutes_limit integer,
  created_at timestamptz,
  updated_at timestamptz,
  total_alerts bigint,
  last_alert_at timestamptz,
  alert_types text[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Check authorization
  IF NOT public.is_platform_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: platform_owner or platform_admin role required';
  END IF;

  RETURN QUERY
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
      cpa.account_id,
      count(*)::bigint AS total_alerts,
      max(cpa.created_at) AS last_alert_at,
      array_remove(array_agg(DISTINCT cpa.alert_type), NULL) AS alert_types
    FROM public.call_pattern_alerts cpa
    GROUP BY cpa.account_id
  ) alerts ON alerts.account_id = a.id
  WHERE coalesce(a.is_flagged_for_review, false) = true
     OR a.flagged_reason IS NOT NULL
     OR a.provisioning_error IS NOT NULL
     OR (a.account_status IS NOT NULL AND a.account_status <> 'active')
     OR coalesce(alerts.total_alerts, 0) > 0;
END;
$$;

-- Grant execute on admin RPC functions to authenticated users
-- (The functions themselves check for platform_owner/platform_admin role)
GRANT EXECUTE ON FUNCTION public.rpc_admin_provisioning_status_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_provisioning_failures() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_daily_call_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_edge_function_error_feed() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_flagged_accounts() TO authenticated;

-- ============================================================================
-- PART 3: Revoke direct SELECT on admin views from authenticated role
-- Keep service_role access for internal use
-- ============================================================================

REVOKE SELECT ON public.admin_provisioning_status_counts FROM authenticated;
REVOKE SELECT ON public.admin_provisioning_failures FROM authenticated;
REVOKE SELECT ON public.admin_daily_call_stats FROM authenticated;
REVOKE SELECT ON public.admin_edge_function_error_feed FROM authenticated;
REVOKE SELECT ON public.admin_flagged_accounts FROM authenticated;

-- ============================================================================
-- PART 4: Fix operator views to use account-scoped access
-- Create RPC functions that scope data to the caller's account
-- ============================================================================

-- Function: Get operator dashboard summary for current user's account
CREATE OR REPLACE FUNCTION public.rpc_operator_dashboard_summary(_account_id uuid DEFAULT NULL)
RETURNS TABLE (
  account_id uuid,
  company_name text,
  calls_today bigint,
  call_minutes_today numeric,
  leads_today bigint,
  hot_leads_today bigint,
  pending_appointments bigint,
  newest_pending_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_account_id uuid;
BEGIN
  -- Resolve account_id: use provided if authorized, otherwise use user's account
  IF _account_id IS NOT NULL THEN
    -- Check if user has access to the specified account
    IF NOT public.check_account_access(_account_id) THEN
      RAISE EXCEPTION 'Unauthorized: no access to account %', _account_id;
    END IF;
    v_account_id := _account_id;
  ELSE
    -- Use the caller's account
    v_account_id := public.get_user_account_id(auth.uid());
    IF v_account_id IS NULL THEN
      RAISE EXCEPTION 'No account associated with current user';
    END IF;
  END IF;

  RETURN QUERY
  WITH calls_today AS (
    SELECT
      cl.account_id,
      count(*)::bigint AS call_count,
      coalesce(sum(cl.call_duration_seconds)::numeric / 60, 0) AS call_minutes
    FROM public.call_logs cl
    WHERE cl.account_id = v_account_id
      AND cl.created_at >= date_trunc('day', now())
    GROUP BY cl.account_id
  ),
  leads_today AS (
    SELECT
      cl.account_id,
      count(*)::bigint AS lead_count,
      count(*) FILTER (WHERE cl.caller_temperature = 'hot')::bigint AS hot_lead_count
    FROM public.customer_leads cl
    WHERE cl.account_id = v_account_id
      AND cl.created_at >= date_trunc('day', now())
    GROUP BY cl.account_id
  ),
  pending_appts AS (
    SELECT
      appt.account_id,
      count(*)::bigint AS pending_count,
      max(appt.created_at) AS newest_pending_at
    FROM public.appointments appt
    WHERE appt.account_id = v_account_id
      AND appt.status = 'pending'
    GROUP BY appt.account_id
  )
  SELECT
    a.id AS account_id,
    a.company_name,
    coalesce(ct.call_count, 0)::bigint AS calls_today,
    coalesce(ct.call_minutes, 0) AS call_minutes_today,
    coalesce(lt.lead_count, 0)::bigint AS leads_today,
    coalesce(lt.hot_lead_count, 0)::bigint AS hot_leads_today,
    coalesce(pa.pending_count, 0)::bigint AS pending_appointments,
    pa.newest_pending_at
  FROM public.accounts a
  LEFT JOIN calls_today ct ON ct.account_id = a.id
  LEFT JOIN leads_today lt ON lt.account_id = a.id
  LEFT JOIN pending_appts pa ON pa.account_id = a.id
  WHERE a.id = v_account_id;
END;
$$;

-- Function: Get daily account usage for current user's account
CREATE OR REPLACE FUNCTION public.rpc_daily_account_usage(_account_id uuid DEFAULT NULL)
RETURNS TABLE (
  account_id uuid,
  company_name text,
  usage_date date,
  call_count bigint,
  call_minutes numeric,
  cost_cents bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_account_id uuid;
BEGIN
  -- Resolve account_id
  IF _account_id IS NOT NULL THEN
    IF NOT public.check_account_access(_account_id) THEN
      RAISE EXCEPTION 'Unauthorized: no access to account %', _account_id;
    END IF;
    v_account_id := _account_id;
  ELSE
    v_account_id := public.get_user_account_id(auth.uid());
    IF v_account_id IS NULL THEN
      RAISE EXCEPTION 'No account associated with current user';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    a.id AS account_id,
    a.company_name,
    (date_trunc('day', ul.created_at))::date AS usage_date,
    count(*)::bigint AS call_count,
    coalesce(sum(ul.call_duration_seconds)::numeric / 60, 0) AS call_minutes,
    coalesce(sum(ul.call_cost_cents), 0)::bigint AS cost_cents
  FROM public.usage_logs ul
  JOIN public.accounts a ON a.id = ul.account_id
  WHERE ul.account_id = v_account_id
  GROUP BY a.id, a.company_name, (date_trunc('day', ul.created_at))::date
  ORDER BY usage_date DESC;
END;
$$;

-- Function: Get account service hours
CREATE OR REPLACE FUNCTION public.rpc_account_service_hours(_account_id uuid DEFAULT NULL)
RETURNS TABLE (
  account_id uuid,
  business_hours jsonb,
  timezone text,
  booking_buffer_hours integer,
  max_daily_bookings integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_account_id uuid;
BEGIN
  -- Resolve account_id
  IF _account_id IS NOT NULL THEN
    IF NOT public.check_account_access(_account_id) THEN
      RAISE EXCEPTION 'Unauthorized: no access to account %', _account_id;
    END IF;
    v_account_id := _account_id;
  ELSE
    v_account_id := public.get_user_account_id(auth.uid());
    IF v_account_id IS NULL THEN
      RAISE EXCEPTION 'No account associated with current user';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    a.id AS account_id,
    a.business_hours,
    a.timezone,
    a.booking_buffer_hours,
    a.max_daily_bookings
  FROM public.accounts a
  WHERE a.id = v_account_id
    AND a.business_hours IS NOT NULL;
END;
$$;

-- Grant execute on operator RPC functions
GRANT EXECUTE ON FUNCTION public.rpc_operator_dashboard_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_daily_account_usage(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_account_service_hours(uuid) TO authenticated;

-- ============================================================================
-- PART 5: Revoke direct SELECT on operator views from authenticated role
-- The views are replaced by account-scoped RPC functions
-- ============================================================================

-- Revoke direct access to operator views (use RPC functions instead)
REVOKE SELECT ON public.operator_dashboard_summary FROM authenticated;
REVOKE SELECT ON public.operator_calls_today FROM authenticated;
REVOKE SELECT ON public.operator_leads_today FROM authenticated;
REVOKE SELECT ON public.operator_pending_appointments FROM authenticated;
REVOKE SELECT ON public.daily_account_usage FROM authenticated;
REVOKE SELECT ON public.account_service_hours FROM authenticated;

-- ============================================================================
-- PART 6: Handle phone_number_identity view
-- This is used for debugging - create RPC with platform staff check
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_phone_number_identity(_vapi_phone_id text DEFAULT NULL)
RETURNS TABLE (
  vapi_phone_id text,
  phone_number text,
  account_id uuid,
  company_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only platform staff can look up arbitrary phone identities
  IF NOT public.is_platform_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: platform_owner or platform_admin role required';
  END IF;

  RETURN QUERY
  SELECT
    pn.vapi_phone_id,
    pn.phone_number,
    pn.account_id,
    a.company_name
  FROM public.phone_numbers pn
  LEFT JOIN public.accounts a ON a.id = pn.account_id
  WHERE (_vapi_phone_id IS NULL OR pn.vapi_phone_id = _vapi_phone_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_phone_number_identity(text) TO authenticated;

-- Revoke direct SELECT on phone_number_identity view
REVOKE SELECT ON public.phone_number_identity FROM authenticated;

-- ============================================================================
-- PART 7: Add comments for documentation
-- ============================================================================

COMMENT ON FUNCTION public.is_platform_staff(uuid) IS 'Check if user has platform_owner or platform_admin role';
COMMENT ON FUNCTION public.rpc_admin_provisioning_status_counts() IS 'Get provisioning status counts (admin only)';
COMMENT ON FUNCTION public.rpc_admin_provisioning_failures() IS 'Get provisioning failures (admin only)';
COMMENT ON FUNCTION public.rpc_admin_daily_call_stats() IS 'Get daily call statistics (admin only)';
COMMENT ON FUNCTION public.rpc_admin_edge_function_error_feed() IS 'Get edge function errors (admin only)';
COMMENT ON FUNCTION public.rpc_admin_flagged_accounts() IS 'Get flagged accounts (admin only)';
COMMENT ON FUNCTION public.rpc_operator_dashboard_summary(uuid) IS 'Get operator dashboard summary for account';
COMMENT ON FUNCTION public.rpc_daily_account_usage(uuid) IS 'Get daily usage for account';
COMMENT ON FUNCTION public.rpc_account_service_hours(uuid) IS 'Get service hours configuration for account';
COMMENT ON FUNCTION public.rpc_phone_number_identity(text) IS 'Look up phone number identity (admin only)';
