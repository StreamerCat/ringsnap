-- Drop orphaned staff_roles policies from the original migration
-- (20251106163142) that were never cleaned up by subsequent fixes.
--
-- "Platform owners can view all staff roles" calls has_platform_role()
-- which queries staff_roles, causing infinite recursion.
--
-- "Users can view their own staff role" is superseded by the
-- "Staff can view their own role" policy (user_id = auth.uid())
-- added in 20251111000001_fix_staff_roles_infinite_recursion.sql.

DROP POLICY IF EXISTS "Platform owners can view all staff roles" ON public.staff_roles;
DROP POLICY IF EXISTS "Users can view their own staff role" ON public.staff_roles;
