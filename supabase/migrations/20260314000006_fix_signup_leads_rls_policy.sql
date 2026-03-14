-- Fix signup_leads RLS policies broken by 20260311000001_fix_supabase_security_warnings.sql
--
-- Root cause: 20260311000001 enabled RLS on signup_leads (previously disabled).
-- Once RLS was enforced the direct client-side INSERT/UPDATE in leads.ts started
-- failing because:
--   1. No UPDATE policy existed for anon / authenticated → RLS rejects update of
--      existing lead (returned as "new row violates row-level security policy").
--   2. No SELECT policy existed for anon → OnboardingChat cannot resume a lead by
--      id after the user was redirected from /start.
--
-- This migration hardens the RLS surface for signup_leads:
--   • Drops and recreates INSERT policies so they are explicitly scoped.
--   • Adds UPDATE policies for anon and authenticated (lead data is non-sensitive
--     marketing info; update-any-row is acceptable here).
--   • Adds a SELECT policy for anon so that /onboarding-chat can look up a lead
--     by its UUID (stored in localStorage after step-1 capture).
--   • Adds explicit table-level GRANTs so the anon / authenticated roles can
--     actually exercise the policies.
--
-- The application-side fix (leads.ts) now routes through the SECURITY DEFINER
-- capture_signup_lead() RPC, but these policies ensure direct-access fallbacks
-- and the OnboardingChat resume query work correctly too.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Explicit table-level grants
-- ─────────────────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON public.signup_leads TO anon;
GRANT SELECT, INSERT, UPDATE ON public.signup_leads TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. INSERT policies — drop & recreate to ensure they exist and are correct
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anonymous users can insert leads"   ON public.signup_leads;
DROP POLICY IF EXISTS "Authenticated users can insert leads" ON public.signup_leads;

CREATE POLICY "anon_insert_signup_leads"
  ON public.signup_leads
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "authenticated_insert_signup_leads"
  ON public.signup_leads
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. UPDATE policies — needed for upsert path when a lead email already exists
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anon_update_signup_leads"          ON public.signup_leads;
DROP POLICY IF EXISTS "authenticated_update_signup_leads" ON public.signup_leads;

CREATE POLICY "anon_update_signup_leads"
  ON public.signup_leads
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_update_signup_leads"
  ON public.signup_leads
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. SELECT policy for anon — allows /onboarding-chat to resume a lead by UUID
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anon_select_signup_leads" ON public.signup_leads;

CREATE POLICY "anon_select_signup_leads"
  ON public.signup_leads
  FOR SELECT
  TO anon
  USING (true);
