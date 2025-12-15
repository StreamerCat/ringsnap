-- Fix Recursive RLS between profiles and account_members
-- The issue was: profiles policy queried account_members, and account_members policy queried profiles.
-- We fix this by making account_members the source of truth and removing the dependency on profiles.

-- 1. Fix account_members policy: Remove lookup of profiles.account_id
DROP POLICY IF EXISTS "Users can view members of their account" ON public.account_members;

CREATE POLICY "Users can view members of their account"
ON public.account_members FOR SELECT
TO authenticated
USING (
  -- Allow viewing own membership explicitly (Base case for recursion)
  user_id = auth.uid()
  OR
  -- Member of the same account (found via account_members self-join)
  account_id IN (
    SELECT account_id FROM public.account_members WHERE user_id = auth.uid()
  )
  OR
  -- Staff can view members
  EXISTS (
    SELECT 1 FROM public.staff_roles
    WHERE user_id = auth.uid()
    AND role IN ('platform_owner', 'platform_admin', 'support', 'sales')
  )
);

-- 2. Fix profiles policy: Remove lookup of profiles.account_id (for current user)
DROP POLICY IF EXISTS "Users can view profiles in their account" ON public.profiles;

CREATE POLICY "Users can view profiles in their account"
ON public.profiles FOR SELECT
TO authenticated
USING (
  -- Target profile belongs to an account accessible to the current user (via account_members)
  account_id IN (
    SELECT account_id FROM public.account_members WHERE user_id = auth.uid()
  )
);
