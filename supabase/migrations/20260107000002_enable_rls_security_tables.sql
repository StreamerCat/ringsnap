-- ============================================================================
-- Migration: Enable RLS on security-flagged tables
-- Version: 20260107000002
-- Purpose: Enable RLS on tables identified by Supabase Security Advisor:
--          - provisioning_state_transitions
--          - voice_library
--          - vapi_assistants
--          - vapi_numbers
--          - provisioning_jobs
--          - call_outcome_events (re-enable if disabled)
--          - signup_leads (re-enable if disabled)
--          - staff_roles (re-enable if disabled)
--
-- Safety: This migration is additive. RLS defaults to deny-all when enabled
--         without policies, so we add policies before or after enabling.
-- ============================================================================

-- ============================================================================
-- PART 1: provisioning_state_transitions
-- Access: Service role only (audit logging from edge functions)
-- ============================================================================

ALTER TABLE IF EXISTS public.provisioning_state_transitions ENABLE ROW LEVEL SECURITY;

-- No policies needed for authenticated users
-- Service role bypasses RLS by default
COMMENT ON TABLE public.provisioning_state_transitions IS
  'Audit log of provisioning state changes. Service-role only access.';

-- ============================================================================
-- PART 2: voice_library
-- Access: Read-only reference table for all authenticated users
-- ============================================================================

ALTER TABLE IF EXISTS public.voice_library ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read voice library (reference data)
DROP POLICY IF EXISTS "voice_library_read_authenticated" ON public.voice_library;
CREATE POLICY "voice_library_read_authenticated"
  ON public.voice_library
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow service role to manage voice library
DROP POLICY IF EXISTS "voice_library_service_role" ON public.voice_library;
CREATE POLICY "voice_library_service_role"
  ON public.voice_library
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.voice_library IS
  'Reference table of available voices. Read access for all authenticated users.';

-- ============================================================================
-- PART 3: vapi_assistants
-- Access: Service role only (provisioning), read for account members
-- ============================================================================

ALTER TABLE IF EXISTS public.vapi_assistants ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own account's assistants
DROP POLICY IF EXISTS "vapi_assistants_read_own_account" ON public.vapi_assistants;
CREATE POLICY "vapi_assistants_read_own_account"
  ON public.vapi_assistants
  FOR SELECT
  TO authenticated
  USING (
    account_id IS NOT NULL AND
    public.check_account_access(account_id)
  );

-- Service role manages assistants (provisioning)
DROP POLICY IF EXISTS "vapi_assistants_service_role" ON public.vapi_assistants;
CREATE POLICY "vapi_assistants_service_role"
  ON public.vapi_assistants
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.vapi_assistants IS
  'Vapi assistant configurations. Service-role for management, read for account members.';

-- ============================================================================
-- PART 4: vapi_numbers
-- Access: Service role only (provisioning)
-- ============================================================================

ALTER TABLE IF EXISTS public.vapi_numbers ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own account's vapi numbers
DROP POLICY IF EXISTS "vapi_numbers_read_own_account" ON public.vapi_numbers;
CREATE POLICY "vapi_numbers_read_own_account"
  ON public.vapi_numbers
  FOR SELECT
  TO authenticated
  USING (
    account_id IS NOT NULL AND
    public.check_account_access(account_id)
  );

-- Service role manages vapi numbers (provisioning)
DROP POLICY IF EXISTS "vapi_numbers_service_role" ON public.vapi_numbers;
CREATE POLICY "vapi_numbers_service_role"
  ON public.vapi_numbers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.vapi_numbers IS
  'Vapi phone number assignments. Service-role for management, read for account members.';

-- ============================================================================
-- PART 5: provisioning_jobs
-- Access: Service role for management, read for account members via API
-- ============================================================================

ALTER TABLE IF EXISTS public.provisioning_jobs ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own account's provisioning jobs
DROP POLICY IF EXISTS "provisioning_jobs_read_own_account" ON public.provisioning_jobs;
CREATE POLICY "provisioning_jobs_read_own_account"
  ON public.provisioning_jobs
  FOR SELECT
  TO authenticated
  USING (
    account_id IS NOT NULL AND
    public.check_account_access(account_id)
  );

-- Service role manages provisioning jobs
DROP POLICY IF EXISTS "provisioning_jobs_service_role" ON public.provisioning_jobs;
CREATE POLICY "provisioning_jobs_service_role"
  ON public.provisioning_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.provisioning_jobs IS
  'Provisioning job queue. Service-role for management, read for account members.';

-- ============================================================================
-- PART 6: call_outcome_events
-- Access: Service role for insert, read/update for account members
-- Note: RLS might have been enabled before, we re-enable for safety
-- ============================================================================

ALTER TABLE IF EXISTS public.call_outcome_events ENABLE ROW LEVEL SECURITY;

-- Ensure account-scoped read policy exists
DROP POLICY IF EXISTS "Users can view call_outcome_events for their account" ON public.call_outcome_events;
CREATE POLICY "call_outcome_events_read_own_account"
  ON public.call_outcome_events
  FOR SELECT
  TO authenticated
  USING (
    account_id IS NOT NULL AND
    public.check_account_access(account_id)
  );

-- Ensure account-scoped insert policy exists
DROP POLICY IF EXISTS "Users can insert call_outcome_events for their account" ON public.call_outcome_events;
CREATE POLICY "call_outcome_events_insert_own_account"
  ON public.call_outcome_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IS NOT NULL AND
    public.check_account_access(account_id)
  );

-- Service role for management
DROP POLICY IF EXISTS "call_outcome_events_service_role" ON public.call_outcome_events;
CREATE POLICY "call_outcome_events_service_role"
  ON public.call_outcome_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- PART 7: signup_leads
-- Access: Edge functions (service role) for management
--         Client can read/update their own leads (via edge function mostly)
-- Note: signup_leads are used during onboarding before user has account
-- ============================================================================

ALTER TABLE IF EXISTS public.signup_leads ENABLE ROW LEVEL SECURITY;

-- Service role has full access (edge functions use this)
DROP POLICY IF EXISTS "signup_leads_service_role" ON public.signup_leads;
CREATE POLICY "signup_leads_service_role"
  ON public.signup_leads
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can view leads they created (matched by auth_user_id)
DROP POLICY IF EXISTS "signup_leads_read_own" ON public.signup_leads;
CREATE POLICY "signup_leads_read_own"
  ON public.signup_leads
  FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

-- Authenticated users can update leads they created
DROP POLICY IF EXISTS "signup_leads_update_own" ON public.signup_leads;
CREATE POLICY "signup_leads_update_own"
  ON public.signup_leads
  FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- Anonymous users cannot directly access signup_leads
-- All anonymous access goes through edge functions with service role

COMMENT ON TABLE public.signup_leads IS
  'Signup funnel leads. Service-role for management, authenticated users can view/update their own.';

-- ============================================================================
-- PART 8: staff_roles
-- Access: Users can view their own role, service role manages all
-- Note: This table is queried by client for authorization checks
-- ============================================================================

ALTER TABLE IF EXISTS public.staff_roles ENABLE ROW LEVEL SECURITY;

-- Staff can view their own role
DROP POLICY IF EXISTS "Staff can view their own role" ON public.staff_roles;
DROP POLICY IF EXISTS "staff_roles_read_own" ON public.staff_roles;
CREATE POLICY "staff_roles_read_own"
  ON public.staff_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Platform admins/owners can view all staff roles
DROP POLICY IF EXISTS "staff_roles_admin_read_all" ON public.staff_roles;
CREATE POLICY "staff_roles_admin_read_all"
  ON public.staff_roles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_roles sr
      WHERE sr.user_id = auth.uid()
      AND sr.role IN ('platform_owner', 'platform_admin')
    )
  );

-- Only service role can modify staff roles (prevents privilege escalation)
DROP POLICY IF EXISTS "Only service role can modify staff roles" ON public.staff_roles;
DROP POLICY IF EXISTS "staff_roles_service_role" ON public.staff_roles;
CREATE POLICY "staff_roles_service_role"
  ON public.staff_roles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.staff_roles IS
  'Platform staff roles. Users can view own, admins can view all, service-role manages.';

-- ============================================================================
-- PART 9: Verification queries (for manual testing)
-- ============================================================================

-- You can run these in Supabase SQL editor to verify RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public'
-- AND tablename IN (
--   'provisioning_state_transitions', 'voice_library', 'vapi_assistants',
--   'vapi_numbers', 'provisioning_jobs', 'call_outcome_events',
--   'signup_leads', 'staff_roles'
-- );
