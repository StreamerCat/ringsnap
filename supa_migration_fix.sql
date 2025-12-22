-- FIX RLS RECURSION FINAL
-- This migration definitively resolves the infinite recursion in RLS policies
-- by introducing a clean, SECURITY DEFINER helper that bypasses RLS for checks.

-- 1. Create a robust Security Definer function to check membership
-- This runs as the owner (superuser-ish), so it can read `account_members`
-- without triggering that table's RLS policies.
CREATE OR REPLACE FUNCTION public.check_user_account_access(_account_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  -- check if user is directly a member
  IF EXISTS (
    SELECT 1 FROM public.account_members
    WHERE account_id = _account_id
    AND user_id = auth.uid()
  ) THEN
    RETURN true;
  END IF;

  -- check if user is the profile owner of the account
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE account_id = _account_id
    AND id = auth.uid()
  ) THEN
    RETURN true;
  END IF;

  -- check if user is staff (admin/support)
  IF EXISTS (
    SELECT 1 FROM public.staff_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'support', 'platform_owner', 'platform_admin')
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- 2. Fix `account_members` Policy
-- Drop ALL existing policies to ensure no conflicts
DROP POLICY IF EXISTS "Users can view members of their account" ON public.account_members;
DROP POLICY IF EXISTS "simple_view_own_membership" ON public.account_members;
DROP POLICY IF EXISTS "account_members_view_self" ON public.account_members;
DROP POLICY IF EXISTS "account_members_view_account" ON public.account_members;
DROP POLICY IF EXISTS "Users can view their own account membership" ON public.account_members;

ALTER TABLE public.account_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "final_account_members_select"
ON public.account_members
FOR SELECT
TO authenticated
USING (
  -- 1. I can always see my own row (base case)
  user_id = auth.uid()
  OR
  -- 2. I can see others if I have access to the account (using SD function)
  public.check_user_account_access(account_id)
);

-- 3. Fix `call_logs` View Policy
DROP POLICY IF EXISTS "safe_view_call_logs" ON public.call_logs;
DROP POLICY IF EXISTS "final_view_call_logs" ON public.call_logs;
DROP POLICY IF EXISTS "Users can view their account call logs" ON public.call_logs;

CREATE POLICY "final_call_logs_select"
ON public.call_logs
FOR SELECT
TO authenticated
USING (
  public.check_user_account_access(account_id)
);

-- 4. Fix `accounts` View Policy (Just to be safe/consistent)
DROP POLICY IF EXISTS "Users can view their own account" ON public.accounts;

CREATE POLICY "final_accounts_select"
ON public.accounts
FOR SELECT
TO authenticated
USING (
  public.check_user_account_access(id)
);

-- Grant execute to auth users
GRANT EXECUTE ON FUNCTION public.check_user_account_access(uuid) TO authenticated;
