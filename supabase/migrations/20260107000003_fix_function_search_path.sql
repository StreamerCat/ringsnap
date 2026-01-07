-- ============================================================================
-- Migration: Fix function_search_path_mutable vulnerability
-- Version: 20260107000003
-- Purpose: Set search_path on SECURITY DEFINER functions to prevent
--          search_path injection attacks.
--
-- The Supabase Security Advisor flags functions with SECURITY DEFINER
-- that don't have an explicit search_path set. This allows potential
-- schema poisoning attacks.
--
-- Fix: ALTER FUNCTION ... SET search_path = 'public'
-- ============================================================================

-- ============================================================================
-- PART 1: Core authentication and RBAC functions
-- ============================================================================

-- has_role (both overloads)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_role' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'ALTER FUNCTION public.has_role SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter has_role: %', SQLERRM;
END $$;

-- has_any_role
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_any_role' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'ALTER FUNCTION public.has_any_role SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter has_any_role: %', SQLERRM;
END $$;

-- has_account_access
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_account_access' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'ALTER FUNCTION public.has_account_access SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter has_account_access: %', SQLERRM;
END $$;

-- get_user_account_id
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_user_account_id' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'ALTER FUNCTION public.get_user_account_id SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter get_user_account_id: %', SQLERRM;
END $$;

-- get_user_primary_role
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_user_primary_role' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'ALTER FUNCTION public.get_user_primary_role SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter get_user_primary_role: %', SQLERRM;
END $$;

-- check_account_access
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_account_access' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'ALTER FUNCTION public.check_account_access SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter check_account_access: %', SQLERRM;
END $$;

-- custom_access_token_hook
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'custom_access_token_hook' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'ALTER FUNCTION public.custom_access_token_hook SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter custom_access_token_hook: %', SQLERRM;
END $$;

-- refresh_user_jwt
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'refresh_user_jwt' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'ALTER FUNCTION public.refresh_user_jwt SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter refresh_user_jwt: %', SQLERRM;
END $$;

-- log_auth_event
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_auth_event' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'ALTER FUNCTION public.log_auth_event SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter log_auth_event: %', SQLERRM;
END $$;

-- ============================================================================
-- PART 2: Provisioning and lifecycle functions
-- ============================================================================

-- update_provisioning_lifecycle
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_provisioning_lifecycle' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'ALTER FUNCTION public.update_provisioning_lifecycle SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter update_provisioning_lifecycle: %', SQLERRM;
END $$;

-- log_provisioning_transition
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_provisioning_transition' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'ALTER FUNCTION public.log_provisioning_transition SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter log_provisioning_transition: %', SQLERRM;
END $$;

-- get_provisioning_history
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_provisioning_history' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'ALTER FUNCTION public.get_provisioning_history SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter get_provisioning_history: %', SQLERRM;
END $$;

-- get_pool_stats
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_pool_stats' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'ALTER FUNCTION public.get_pool_stats SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter get_pool_stats: %', SQLERRM;
END $$;

-- ============================================================================
-- PART 3: Business logic functions
-- ============================================================================

-- is_within_service_hours
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_within_service_hours' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'ALTER FUNCTION public.is_within_service_hours SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter is_within_service_hours: %', SQLERRM;
END $$;

-- get_calls_today
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_calls_today' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'ALTER FUNCTION public.get_calls_today SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter get_calls_today: %', SQLERRM;
END $$;

-- get_account_data
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_account_data' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'ALTER FUNCTION public.get_account_data SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter get_account_data: %', SQLERRM;
END $$;

-- ============================================================================
-- PART 4: Trigger functions
-- ============================================================================

-- handle_new_user_signup
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user_signup' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'ALTER FUNCTION public.handle_new_user_signup SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter handle_new_user_signup: %', SQLERRM;
END $$;

-- handle_updated_at
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_updated_at' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'ALTER FUNCTION public.handle_updated_at SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter handle_updated_at: %', SQLERRM;
END $$;

-- update_updated_at_column
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'ALTER FUNCTION public.update_updated_at_column SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter update_updated_at_column: %', SQLERRM;
END $$;

-- log_role_change
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_role_change' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'ALTER FUNCTION public.log_role_change SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter log_role_change: %', SQLERRM;
END $$;

-- ============================================================================
-- PART 5: Stripe and payment functions
-- ============================================================================

-- process_stripe_event
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'process_stripe_event' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'ALTER FUNCTION public.process_stripe_event SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter process_stripe_event: %', SQLERRM;
END $$;

-- link_orphaned_subscription
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'link_orphaned_subscription' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'ALTER FUNCTION public.link_orphaned_subscription SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter link_orphaned_subscription: %', SQLERRM;
END $$;

-- record_orphaned_resource
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'record_orphaned_resource' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'ALTER FUNCTION public.record_orphaned_resource SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter record_orphaned_resource: %', SQLERRM;
END $$;

-- ============================================================================
-- PART 6: Idempotency and transaction functions
-- ============================================================================

-- check_idempotency
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_idempotency' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'ALTER FUNCTION public.check_idempotency SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter check_idempotency: %', SQLERRM;
END $$;

-- record_idempotency
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'record_idempotency' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'ALTER FUNCTION public.record_idempotency SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter record_idempotency: %', SQLERRM;
END $$;

-- create_account_transaction
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_account_transaction' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'ALTER FUNCTION public.create_account_transaction SET search_path = public';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter create_account_transaction: %', SQLERRM;
END $$;

-- ============================================================================
-- PART 7: Batch update all remaining SECURITY DEFINER functions
-- This catches any functions we may have missed
-- ============================================================================

DO $$
DECLARE
  func_record RECORD;
  alter_sql TEXT;
BEGIN
  FOR func_record IN
    SELECT
      p.proname AS function_name,
      pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prosecdef = true  -- SECURITY DEFINER
      AND p.proconfig IS NULL  -- No configuration (including search_path)
  LOOP
    BEGIN
      alter_sql := format(
        'ALTER FUNCTION public.%I(%s) SET search_path = public',
        func_record.function_name,
        func_record.args
      );
      EXECUTE alter_sql;
      RAISE NOTICE 'Fixed search_path for: %(%)', func_record.function_name, func_record.args;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not fix %: %', func_record.function_name, SQLERRM;
    END;
  END LOOP;
END $$;

-- ============================================================================
-- PART 8: Verification query (for manual testing)
-- ============================================================================

-- You can run this in Supabase SQL editor to verify all SECURITY DEFINER
-- functions have search_path set:
--
-- SELECT
--   p.proname AS function_name,
--   pg_get_function_identity_arguments(p.oid) AS args,
--   p.prosecdef AS is_security_definer,
--   p.proconfig AS config
-- FROM pg_proc p
-- JOIN pg_namespace n ON p.pronamespace = n.oid
-- WHERE n.nspname = 'public'
--   AND p.prosecdef = true
-- ORDER BY p.proname;
--
-- Look for functions where config IS NULL - those still need fixing.
