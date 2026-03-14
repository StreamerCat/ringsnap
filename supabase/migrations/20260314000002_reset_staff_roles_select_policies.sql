-- Nuclear reset of staff_roles SELECT policies.
--
-- Problem: Recursive policies from early migrations (20251106163142 and others)
-- that were never fully cleaned up continue to cause infinite recursion.
-- "Platform owners can view all staff roles" calls has_platform_role() which
-- queries staff_roles → infinite recursion on every staff_roles SELECT.
--
-- The migration 20251111000001 created the correct non-recursive policy but
-- did NOT drop the recursive ones. 20260314000001 dropped two by name but may
-- have missed others depending on when the DB was last migrated from scratch.
--
-- This migration drops ALL SELECT policies on staff_roles then recreates
-- exactly the one correct policy. It is fully idempotent.

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'staff_roles'
      AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.staff_roles', pol.policyname);
  END LOOP;
END $$;

-- Single correct non-recursive SELECT policy: each user can only see their own row.
-- No function calls, no subqueries — cannot recurse.
CREATE POLICY "Staff can view their own role"
  ON public.staff_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
