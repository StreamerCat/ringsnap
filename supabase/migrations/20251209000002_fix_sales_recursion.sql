-- Fix infinite recursion caused by legacy Sales Rep policies
-- These policies create a loop: accounts -> profiles -> accounts
-- This migration drops the problematic policies and re-implements them safely
-- using SECURITY DEFINER functions to bypass RLS during permission checks.

-- Helper function to getting sales rep name safely (bypassing RLS)
CREATE OR REPLACE FUNCTION public.get_current_user_name()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT name FROM profiles WHERE id = auth.uid();
$$;

-- Drop problematic recursive policies
DROP POLICY IF EXISTS "Sales reps can view their assigned accounts" ON public.accounts;
DROP POLICY IF EXISTS "Sales reps can view members of their assigned accounts" ON public.account_members;
DROP POLICY IF EXISTS "Sales reps can view profiles in their assigned accounts" ON public.profiles;

-- Re-create safe policies using helper function and checking roles directly

-- 1. Accounts: Sales reps view assigned accounts
CREATE POLICY "Sales reps can view their assigned accounts"
ON public.accounts
FOR SELECT
TO authenticated
USING (
  public.user_is_staff(ARRAY['sales']) 
  AND 
  sales_rep_name = public.get_current_user_name()
);

-- 2. Account Members: Sales reps view members of assigned accounts
CREATE POLICY "Sales reps can view members of their assigned accounts"
ON public.account_members
FOR SELECT
TO authenticated
USING (
  public.user_is_staff(ARRAY['sales'])
  AND
  EXISTS (
    SELECT 1 FROM accounts a
    WHERE a.id = account_members.account_id
    AND a.sales_rep_name = public.get_current_user_name()
  )
);

-- 3. Profiles: Sales reps view profiles in assigned accounts
CREATE POLICY "Sales reps can view profiles in their assigned accounts"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.user_is_staff(ARRAY['sales'])
  AND
  EXISTS (
    SELECT 1 FROM accounts a
    WHERE a.id = profiles.account_id
    AND a.sales_rep_name = public.get_current_user_name()
  )
);
