-- Fix persistent infinite recursion in staff_roles RLS.
--
-- Root cause: 20251108000003 created "Admins can manage staff roles" as FOR ALL,
-- which has cmd='ALL' in pg_policies. The previous nuclear reset (20260314000002)
-- only dropped cmd='SELECT' policies, so this recursive FOR ALL policy survived.
-- When Postgres evaluates a SELECT on staff_roles it applies BOTH the SELECT
-- policy AND the FOR ALL policy; the FOR ALL policy's USING clause re-queries
-- staff_roles, causing infinite recursion.
--
-- Fix: drop ALL policies on staff_roles (no cmd filter) and recreate correctly.

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'staff_roles'
    -- intentionally no cmd filter — catches FOR ALL, FOR SELECT, etc.
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.staff_roles', pol.policyname);
  END LOOP;
END $$;

-- Non-recursive SELECT: each staff user sees only their own row
CREATE POLICY "Staff can view their own role"
  ON public.staff_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Block all writes from regular authenticated users (service_role bypasses RLS)
CREATE POLICY "Only service role can modify staff roles"
  ON public.staff_roles
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);
