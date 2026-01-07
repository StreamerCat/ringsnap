-- ============================================================================
-- Migration: Tighten permissive RLS policies
-- Version: 20260107000004
-- Purpose: Address security advisor warnings about overly permissive policies:
--          1. call_webhook_inbox - policy allows all roles, should be service_role only
--          2. revenue_report_leads - anon INSERT with no constraints
-- ============================================================================

-- ============================================================================
-- PART 1: Fix call_webhook_inbox policy
-- Issue: Policy "Service role full access to inbox" uses FOR ALL with true/true
--        which applies to ALL roles, not just service_role
-- Fix: Remove the redundant policy since service_role bypasses RLS anyway.
--      Add explicit deny for other roles if needed.
-- ============================================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Service role full access to inbox" ON public.call_webhook_inbox;

-- Service role bypasses RLS by default, so we don't need a policy for it.
-- Instead, create restrictive policies for other roles:

-- Platform admins can view inbox for debugging
DROP POLICY IF EXISTS "call_webhook_inbox_admin_read" ON public.call_webhook_inbox;
CREATE POLICY "call_webhook_inbox_admin_read"
  ON public.call_webhook_inbox
  FOR SELECT
  TO authenticated
  USING (
    public.is_platform_staff(auth.uid())
  );

-- No authenticated user can modify the inbox directly
-- All writes go through edge functions using service role
DROP POLICY IF EXISTS "call_webhook_inbox_deny_write" ON public.call_webhook_inbox;
CREATE POLICY "call_webhook_inbox_deny_write"
  ON public.call_webhook_inbox
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "call_webhook_inbox_deny_update" ON public.call_webhook_inbox;
CREATE POLICY "call_webhook_inbox_deny_update"
  ON public.call_webhook_inbox
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "call_webhook_inbox_deny_delete" ON public.call_webhook_inbox;
CREATE POLICY "call_webhook_inbox_deny_delete"
  ON public.call_webhook_inbox
  FOR DELETE
  TO authenticated
  USING (false);

-- Anonymous users have no access
-- (default deny when RLS is enabled)

COMMENT ON TABLE public.call_webhook_inbox IS
  'Dead letter queue for failed webhook events. Service-role only for writes, platform admins for reads.';

-- ============================================================================
-- PART 2: Tighten revenue_report_leads policy
-- Issue: Anon INSERT with true allows any data to be inserted
-- Fix: Add constraints to prevent abuse while still allowing lead capture
-- ============================================================================

-- First, add constraints to the table (if not already present)
DO $$
BEGIN
  -- Add length constraint on name (prevent abuse)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'revenue_report_leads_name_length'
    AND conrelid = 'public.revenue_report_leads'::regclass
  ) THEN
    ALTER TABLE public.revenue_report_leads
    ADD CONSTRAINT revenue_report_leads_name_length
    CHECK (char_length(name) BETWEEN 1 AND 200);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not add name length constraint: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- Add length constraint on email
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'revenue_report_leads_email_length'
    AND conrelid = 'public.revenue_report_leads'::regclass
  ) THEN
    ALTER TABLE public.revenue_report_leads
    ADD CONSTRAINT revenue_report_leads_email_length
    CHECK (char_length(email) BETWEEN 5 AND 320);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not add email length constraint: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- Add basic email format check (contains @)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'revenue_report_leads_email_format'
    AND conrelid = 'public.revenue_report_leads'::regclass
  ) THEN
    ALTER TABLE public.revenue_report_leads
    ADD CONSTRAINT revenue_report_leads_email_format
    CHECK (email LIKE '%@%.%');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not add email format constraint: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- Add length constraint on business
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'revenue_report_leads_business_length'
    AND conrelid = 'public.revenue_report_leads'::regclass
  ) THEN
    ALTER TABLE public.revenue_report_leads
    ADD CONSTRAINT revenue_report_leads_business_length
    CHECK (char_length(business) BETWEEN 1 AND 500);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not add business length constraint: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- Add length constraint on trade (optional field)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'revenue_report_leads_trade_length'
    AND conrelid = 'public.revenue_report_leads'::regclass
  ) THEN
    ALTER TABLE public.revenue_report_leads
    ADD CONSTRAINT revenue_report_leads_trade_length
    CHECK (trade IS NULL OR char_length(trade) BETWEEN 1 AND 200);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not add trade length constraint: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- Add reasonable bounds on numeric fields
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'revenue_report_leads_numeric_bounds'
    AND conrelid = 'public.revenue_report_leads'::regclass
  ) THEN
    ALTER TABLE public.revenue_report_leads
    ADD CONSTRAINT revenue_report_leads_numeric_bounds
    CHECK (
      (customer_calls IS NULL OR (customer_calls >= 0 AND customer_calls <= 1000000))
      AND (lost_revenue IS NULL OR (lost_revenue >= 0 AND lost_revenue <= 1000000000))
      AND (recovered_revenue IS NULL OR (recovered_revenue >= 0 AND recovered_revenue <= 1000000000))
      AND (net_gain IS NULL OR (net_gain >= -1000000000 AND net_gain <= 1000000000))
      AND (roi IS NULL OR (roi >= -1000 AND roi <= 100000))
      AND (payback_days IS NULL OR (payback_days >= 0 AND payback_days <= 36500))
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not add numeric bounds constraint: %', SQLERRM;
END $$;

-- Update the policy to be more specific while still allowing anon inserts
DROP POLICY IF EXISTS "Anyone can create revenue report leads" ON public.revenue_report_leads;
CREATE POLICY "anon_can_insert_revenue_report_leads"
  ON public.revenue_report_leads
  FOR INSERT
  TO anon
  WITH CHECK (
    -- Rely on table constraints for validation
    -- Policy just ensures the basic fields are provided
    name IS NOT NULL
    AND email IS NOT NULL
    AND business IS NOT NULL
  );

-- Platform staff can view all leads
DROP POLICY IF EXISTS "revenue_report_leads_admin_read" ON public.revenue_report_leads;
CREATE POLICY "revenue_report_leads_admin_read"
  ON public.revenue_report_leads
  FOR SELECT
  TO authenticated
  USING (
    public.is_platform_staff(auth.uid())
  );

-- Service role has full access for backend processing
-- (No policy needed - service_role bypasses RLS)

COMMENT ON TABLE public.revenue_report_leads IS
  'Lead capture from revenue calculator. Anon INSERT with validation constraints, admin read.';

-- ============================================================================
-- PART 3: Note about leaked password protection
-- Issue: Supabase Auth setting "Leaked password protection" is disabled
-- Fix: This is a Supabase Dashboard setting, not a migration
-- Action: Enable in Supabase Dashboard > Authentication > Settings
-- ============================================================================

-- NOTE TO JOSH:
-- The Security Advisor also flagged "Leaked password protection disabled".
-- This is an Auth setting in the Supabase Dashboard, not something we can
-- fix via migration. To enable:
-- 1. Go to Supabase Dashboard
-- 2. Navigate to Authentication > Settings
-- 3. Enable "Leaked password protection"
--
-- This feature checks passwords against known breached password databases
-- (like HaveIBeenPwned) during signup and password changes.
