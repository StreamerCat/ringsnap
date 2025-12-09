-- Fix infinite recursion in accounts RLS policies
-- The accounts policy checks account_members, which checks profiles,
-- which can reference accounts again, causing infinite recursion.
--
-- Solution: Use a security definer function to break the recursion chain.
-- These functions bypass RLS when checking ownership, preventing circular evaluation.

-- Create helper function to check if user has access to an account
-- This function runs with invoker's privileges but doesn't trigger RLS on the tables it queries
CREATE OR REPLACE FUNCTION public.user_has_account_access(check_account_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    -- User's profile is linked to this account
    SELECT 1 FROM profiles WHERE id = auth.uid() AND account_id = check_account_id
  ) OR EXISTS (
    -- User is a member of this account
    SELECT 1 FROM account_members WHERE user_id = auth.uid() AND account_id = check_account_id
  );
$$;

-- Create helper function to check if user is staff
-- Valid staff_role values: platform_owner, platform_admin, support, viewer, sales
CREATE OR REPLACE FUNCTION public.user_is_staff(required_roles text[] DEFAULT ARRAY['platform_admin', 'platform_owner', 'support', 'sales'])
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM staff_roles
    WHERE user_id = auth.uid()
    AND role::text = ANY(required_roles)
  );
$$;

-- Create helper function to check if user owns/admins an account
CREATE OR REPLACE FUNCTION public.user_can_manage_account(check_account_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    -- User's profile is linked to this account (primary owner)
    SELECT 1 FROM profiles WHERE id = auth.uid() AND account_id = check_account_id
  ) OR EXISTS (
    -- User has owner or admin role in account_members
    SELECT 1 FROM account_members
    WHERE user_id = auth.uid()
    AND account_id = check_account_id
    AND role IN ('owner', 'admin')
  ) OR EXISTS (
    -- User is a staff platform_admin or platform_owner
    SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('platform_admin', 'platform_owner')
  );
$$;

-- Drop existing accounts policies that cause recursion
DROP POLICY IF EXISTS "Users can view their own account" ON public.accounts;
DROP POLICY IF EXISTS "Admins and owners can update accounts" ON public.accounts;

-- Create new non-recursive accounts SELECT policy
CREATE POLICY "Users can view their own account"
ON public.accounts FOR SELECT
TO authenticated
USING (
  public.user_has_account_access(id)
  OR
  public.user_is_staff(ARRAY['platform_admin', 'platform_owner', 'support', 'sales'])
);

-- Create new non-recursive accounts UPDATE policy
CREATE POLICY "Admins and owners can update accounts"
ON public.accounts FOR UPDATE
TO authenticated
USING (public.user_can_manage_account(id))
WITH CHECK (public.user_can_manage_account(id));

-- Also fix account_members policies to use the helper functions
DROP POLICY IF EXISTS "Users can view members of their account" ON public.account_members;
DROP POLICY IF EXISTS "Owners and admins can manage account members" ON public.account_members;

-- FIXED POLICY: Explicitly check user_id = auth.uid() FIRST to break recursion
CREATE POLICY "Users can view members of their account"
ON public.account_members FOR SELECT
TO authenticated
USING (
  -- 1. I can always see my own membership (Base case for recursion)
  user_id = auth.uid()
  OR
  -- 2. I can see other members if I have access to the account
  -- (This query will now succeed because step 1 allows getting my own row)
  public.user_has_account_access(account_id)
  OR
  public.user_is_staff(ARRAY['platform_admin', 'platform_owner', 'support', 'sales'])
);

CREATE POLICY "Owners and admins can manage account members"
ON public.account_members FOR ALL
TO authenticated
USING (public.user_can_manage_account(account_id))
WITH CHECK (public.user_can_manage_account(account_id));

-- Fix phone_numbers policies
DROP POLICY IF EXISTS "Users can view their account phone numbers" ON public.phone_numbers;
DROP POLICY IF EXISTS "Owners can manage their account phone numbers" ON public.phone_numbers;

CREATE POLICY "Users can view their account phone numbers"
ON public.phone_numbers FOR SELECT
TO authenticated
USING (
  public.user_has_account_access(account_id)
  OR
  public.user_is_staff(ARRAY['platform_admin', 'platform_owner', 'support'])
);

CREATE POLICY "Owners can manage their account phone numbers"
ON public.phone_numbers FOR ALL
TO authenticated
USING (public.user_can_manage_account(account_id))
WITH CHECK (public.user_can_manage_account(account_id));

-- Fix assistants policies
DROP POLICY IF EXISTS "Users can view their account assistants" ON public.assistants;
DROP POLICY IF EXISTS "Owners can manage their account assistants" ON public.assistants;

CREATE POLICY "Users can view their account assistants"
ON public.assistants FOR SELECT
TO authenticated
USING (
  public.user_has_account_access(account_id)
  OR
  public.user_is_staff(ARRAY['platform_admin', 'platform_owner', 'support'])
);

CREATE POLICY "Owners can manage their account assistants"
ON public.assistants FOR ALL
TO authenticated
USING (public.user_can_manage_account(account_id))
WITH CHECK (public.user_can_manage_account(account_id));

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION public.user_has_account_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_staff(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_manage_account(uuid) TO authenticated;

