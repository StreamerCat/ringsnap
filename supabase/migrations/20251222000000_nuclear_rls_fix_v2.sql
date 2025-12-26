-- NUCLEAR RLS FIX v2
-- This migration MUST be applied AFTER all other RLS migrations to fix recursion
-- It drops ALL policies that could cause recursion and recreates them safely

-- =============================================================================
-- STEP 1: Create/Replace the SECURITY DEFINER helper function
-- This function bypasses RLS when checking account membership
-- =============================================================================

CREATE OR REPLACE FUNCTION public.check_account_access(_account_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  -- Check 1: User is directly a member of this account
  IF EXISTS (
    SELECT 1 FROM public.account_members
    WHERE account_id = _account_id
    AND user_id = auth.uid()
  ) THEN
    RETURN true;
  END IF;

  -- Check 2: User's profile belongs to this account
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE account_id = _account_id
    AND id = auth.uid()
  ) THEN
    RETURN true;
  END IF;

  -- Check 3: User is staff with view access
  IF EXISTS (
    SELECT 1 FROM public.staff_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'support', 'platform_owner', 'platform_admin', 'sales')
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_account_access(uuid) TO authenticated;

-- =============================================================================
-- STEP 2: DROP ALL potentially conflicting policies
-- =============================================================================

-- account_members policies
DROP POLICY IF EXISTS "Users can view members of their account" ON public.account_members;
DROP POLICY IF EXISTS "simple_view_own_membership" ON public.account_members;
DROP POLICY IF EXISTS "account_members_view_self" ON public.account_members;
DROP POLICY IF EXISTS "account_members_view_account" ON public.account_members;
DROP POLICY IF EXISTS "Users can view their own account membership" ON public.account_members;
DROP POLICY IF EXISTS "final_account_members_select" ON public.account_members;
DROP POLICY IF EXISTS "Owners and admins can manage account members" ON public.account_members;

-- customer_leads policies
DROP POLICY IF EXISTS "Users can view their account leads" ON public.customer_leads;
DROP POLICY IF EXISTS "Users can create leads for their account" ON public.customer_leads;
DROP POLICY IF EXISTS "Users can update their account leads" ON public.customer_leads;
DROP POLICY IF EXISTS "Staff can view all leads" ON public.customer_leads;

-- call_logs policies
DROP POLICY IF EXISTS "safe_view_call_logs" ON public.call_logs;
DROP POLICY IF EXISTS "final_view_call_logs" ON public.call_logs;
DROP POLICY IF EXISTS "final_call_logs_select" ON public.call_logs;
DROP POLICY IF EXISTS "Users can view their account call logs" ON public.call_logs;
DROP POLICY IF EXISTS "Account members can view call logs" ON public.call_logs;
DROP POLICY IF EXISTS "view_call_logs" ON public.call_logs;

-- accounts policies
DROP POLICY IF EXISTS "Users can view their own account" ON public.accounts;
DROP POLICY IF EXISTS "final_accounts_select" ON public.accounts;

-- profiles policies
DROP POLICY IF EXISTS "Users can view profiles in their account" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- =============================================================================
-- STEP 3: RECREATE policies using SECURITY DEFINER function
-- =============================================================================

-- ACCOUNT_MEMBERS: Simple self-view + SD function
ALTER TABLE public.account_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rls_account_members_select"
ON public.account_members
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()  -- Always see own membership (base case)
  OR
  public.check_account_access(account_id)  -- SD function for others
);

CREATE POLICY "rls_account_members_manage"
ON public.account_members
FOR ALL
TO authenticated
USING (
  public.check_account_access(account_id)
)
WITH CHECK (
  public.check_account_access(account_id)
);

-- CUSTOMER_LEADS: Use SD function
ALTER TABLE public.customer_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rls_customer_leads_select"
ON public.customer_leads
FOR SELECT
TO authenticated
USING (
  public.check_account_access(account_id)
);

CREATE POLICY "rls_customer_leads_insert"
ON public.customer_leads
FOR INSERT
TO authenticated
WITH CHECK (
  public.check_account_access(account_id)
);

CREATE POLICY "rls_customer_leads_update"
ON public.customer_leads
FOR UPDATE
TO authenticated
USING (
  public.check_account_access(account_id)
)
WITH CHECK (
  public.check_account_access(account_id)
);

-- CALL_LOGS: Use SD function
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rls_call_logs_select"
ON public.call_logs
FOR SELECT
TO authenticated
USING (
  public.check_account_access(account_id)
);

-- ACCOUNTS: Use SD function
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rls_accounts_select"
ON public.accounts
FOR SELECT
TO authenticated
USING (
  public.check_account_access(id)
);

-- PROFILES: Own profile + SD function
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rls_profiles_select"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()  -- Always see own profile
  OR
  public.check_account_access(account_id)  -- See profiles in my account
);

-- =============================================================================
-- STEP 4: Ensure service_role policies exist where needed
-- =============================================================================

-- Ensure service_role can manage all tables
DO $$
BEGIN
  -- call_logs
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'call_logs' AND policyname = 'Service role can manage call logs') THEN
    CREATE POLICY "Service role can manage call logs"
    ON public.call_logs FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
  END IF;

  -- customer_leads (already has "Service role full access", skip)

  -- account_members
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'account_members' AND policyname = 'Service role full access') THEN
    CREATE POLICY "Service role full access"
    ON public.account_members FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;
