-- Fix RLS Infinite Recursion by using a Security Definer function
-- Recursive trap: account_members policy -> queries account_members -> triggers policy -> recursion.

-- 1. Create a secure function to get account IDs without triggering RLS
CREATE OR REPLACE FUNCTION public.get_my_account_ids()
RETURNS TABLE (account_id UUID)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT account_id FROM public.account_members WHERE user_id = auth.uid();
$$;

-- 2. Fix account_members policy using the secure function
DROP POLICY IF EXISTS "Users can view members of their account" ON public.account_members;

CREATE POLICY "Users can view members of their account"
ON public.account_members FOR SELECT
TO authenticated
USING (
  -- Allow viewing own membership
  user_id = auth.uid()
  OR
  -- Member of the same account (using secure function to avoid recursion)
  account_id IN ( SELECT account_id FROM public.get_my_account_ids() )
  OR
  -- Staff can view members
  EXISTS (
    SELECT 1 FROM public.staff_roles
    WHERE user_id = auth.uid()
    AND role::text IN ('platform_owner', 'platform_admin', 'support', 'sales')
  )
);

-- 3. Fix profiles policy
DROP POLICY IF EXISTS "Users can view profiles in their account" ON public.profiles;

CREATE POLICY "Users can view profiles in their account"
ON public.profiles FOR SELECT
TO authenticated
USING (
  -- Target profile belongs to an account accessible to the current user
  account_id IN ( SELECT account_id FROM public.get_my_account_ids() )
);
