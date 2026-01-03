-- Enhanced RLS Policies for Tenant Isolation
-- Ensures proper data access control based on account_id and roles

-- Drop existing conflicting policies if they exist (optional - be careful in production)
-- This ensures clean slate for the new policies

-- Profiles table RLS
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR
  -- Staff can view profiles in their scope
  EXISTS (
    SELECT 1 FROM public.staff_roles
    WHERE user_id = auth.uid()
    AND role::text IN ('admin', 'support', 'sales', 'platform_admin', 'platform_owner')
  )
);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Accounts table RLS - tenant isolation
DROP POLICY IF EXISTS "Users can view their own account" ON public.accounts;
DROP POLICY IF EXISTS "Users can update their own account" ON public.accounts;

CREATE POLICY "Users can view their own account"
ON public.accounts FOR SELECT
TO authenticated
USING (
  -- User belongs to this account
  id IN (
    SELECT account_id FROM public.profiles WHERE id = auth.uid()
  )
  OR
  -- User is a member of this account
  id IN (
    SELECT account_id FROM public.account_members WHERE user_id = auth.uid()
  )
  OR
  -- Staff with appropriate roles can view accounts
  EXISTS (
    SELECT 1 FROM public.staff_roles
    WHERE user_id = auth.uid()
    AND role::text IN ('admin', 'support', 'billing', 'platform_admin', 'platform_owner')
  )
  OR
  -- Sales reps can view their assigned accounts
  EXISTS (
    SELECT 1 FROM public.staff_roles sr
    JOIN public.profiles p ON p.id = sr.user_id
    WHERE sr.user_id = auth.uid()
    AND sr.role::text = 'sales'
    AND accounts.sales_rep_name = p.name
  )
);

CREATE POLICY "Admins and owners can update accounts"
ON public.accounts FOR UPDATE
TO authenticated
USING (
  -- Account owners
  id IN (
    SELECT account_id FROM public.profiles WHERE id = auth.uid()
  )
  OR
  -- Account members with owner/admin role
  id IN (
    SELECT account_id FROM public.account_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
  OR
  -- Staff admins
  EXISTS (
    SELECT 1 FROM public.staff_roles
    WHERE user_id = auth.uid() AND role::text IN ('admin', 'platform_admin', 'platform_owner')
  )
)
WITH CHECK (
  -- Same as USING clause
  id IN (
    SELECT account_id FROM public.profiles WHERE id = auth.uid()
  )
  OR
  id IN (
    SELECT account_id FROM public.account_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
  OR
  EXISTS (
    SELECT 1 FROM public.staff_roles
    WHERE user_id = auth.uid() AND role::text IN ('admin', 'platform_admin', 'platform_owner')
  )
);

-- Account members table RLS
DROP POLICY IF EXISTS "Users can view members of their account" ON public.account_members;
DROP POLICY IF EXISTS "Owners can manage account members" ON public.account_members;

CREATE POLICY "Users can view members of their account"
ON public.account_members FOR SELECT
TO authenticated
USING (
  -- Member of the same account
  account_id IN (
    SELECT account_id FROM public.profiles WHERE id = auth.uid()
  )
  OR
  account_id IN (
    SELECT account_id FROM public.account_members WHERE user_id = auth.uid()
  )
  OR
  -- Staff can view members
  EXISTS (
    SELECT 1 FROM public.staff_roles
    WHERE user_id = auth.uid()
    AND role::text IN ('admin', 'support', 'sales', 'platform_admin', 'platform_owner')
  )
);

CREATE POLICY "Owners and admins can manage account members"
ON public.account_members FOR ALL
TO authenticated
USING (
  -- Account owner
  account_id IN (
    SELECT account_id FROM public.profiles WHERE id = auth.uid()
  )
  OR
  -- Account admin
  account_id IN (
    SELECT account_id FROM public.account_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
  OR
  -- Staff admin
  EXISTS (
    SELECT 1 FROM public.staff_roles
    WHERE user_id = auth.uid() AND role::text IN ('admin', 'platform_admin', 'platform_owner')
  )
)
WITH CHECK (
  account_id IN (
    SELECT account_id FROM public.profiles WHERE id = auth.uid()
  )
  OR
  account_id IN (
    SELECT account_id FROM public.account_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
  OR
  EXISTS (
    SELECT 1 FROM public.staff_roles
    WHERE user_id = auth.uid() AND role::text IN ('admin', 'platform_admin', 'platform_owner')
  )
);

-- Phone numbers table RLS - tenant isolation
DROP POLICY IF EXISTS "Users can view their account phone numbers" ON public.phone_numbers;
DROP POLICY IF EXISTS "Users can manage their account phone numbers" ON public.phone_numbers;

CREATE POLICY "Users can view their account phone numbers"
ON public.phone_numbers FOR SELECT
TO authenticated
USING (
  account_id IN (
    SELECT account_id FROM public.profiles WHERE id = auth.uid()
  )
  OR
  account_id IN (
    SELECT account_id FROM public.account_members WHERE user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.staff_roles
    WHERE user_id = auth.uid()
    AND role::text IN ('admin', 'support', 'platform_admin', 'platform_owner')
  )
);

CREATE POLICY "Owners can manage their account phone numbers"
ON public.phone_numbers FOR ALL
TO authenticated
USING (
  account_id IN (
    SELECT account_id FROM public.profiles WHERE id = auth.uid()
  )
  OR
  account_id IN (
    SELECT account_id FROM public.account_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
  OR
  EXISTS (
    SELECT 1 FROM public.staff_roles
    WHERE user_id = auth.uid() AND role::text IN ('admin', 'platform_admin', 'platform_owner')
  )
)
WITH CHECK (
  account_id IN (
    SELECT account_id FROM public.profiles WHERE id = auth.uid()
  )
  OR
  account_id IN (
    SELECT account_id FROM public.account_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
  OR
  EXISTS (
    SELECT 1 FROM public.staff_roles
    WHERE user_id = auth.uid() AND role::text IN ('admin', 'platform_admin', 'platform_owner')
  )
);

-- Assistants table RLS - tenant isolation
DROP POLICY IF EXISTS "Users can view their account assistants" ON public.assistants;
DROP POLICY IF EXISTS "Users can manage their account assistants" ON public.assistants;

CREATE POLICY "Users can view their account assistants"
ON public.assistants FOR SELECT
TO authenticated
USING (
  account_id IN (
    SELECT account_id FROM public.profiles WHERE id = auth.uid()
  )
  OR
  account_id IN (
    SELECT account_id FROM public.account_members WHERE user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.staff_roles
    WHERE user_id = auth.uid()
    AND role::text IN ('admin', 'support', 'platform_admin', 'platform_owner')
  )
);

CREATE POLICY "Owners can manage their account assistants"
ON public.assistants FOR ALL
TO authenticated
USING (
  account_id IN (
    SELECT account_id FROM public.profiles WHERE id = auth.uid()
  )
  OR
  account_id IN (
    SELECT account_id FROM public.account_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
  OR
  EXISTS (
    SELECT 1 FROM public.staff_roles
    WHERE user_id = auth.uid() AND role::text IN ('admin', 'platform_admin', 'platform_owner')
  )
)
WITH CHECK (
  account_id IN (
    SELECT account_id FROM public.profiles WHERE id = auth.uid()
  )
  OR
  account_id IN (
    SELECT account_id FROM public.account_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
  OR
  EXISTS (
    SELECT 1 FROM public.staff_roles
    WHERE user_id = auth.uid() AND role::text IN ('admin', 'platform_admin', 'platform_owner')
  )
);

-- Staff roles table RLS
DROP POLICY IF EXISTS "Staff can view their own role" ON public.staff_roles;
DROP POLICY IF EXISTS "Admins can manage staff roles" ON public.staff_roles;

CREATE POLICY "Staff can view their own role"
ON public.staff_roles FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.staff_roles
    WHERE user_id = auth.uid() AND role::text IN ('admin', 'platform_admin', 'platform_owner')
  )
);

CREATE POLICY "Admins can manage staff roles"
ON public.staff_roles FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.staff_roles
    WHERE user_id = auth.uid() AND role::text IN ('admin', 'platform_admin', 'platform_owner')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.staff_roles
    WHERE user_id = auth.uid() AND role::text IN ('admin', 'platform_admin', 'platform_owner')
  )
);

-- Usage logs table RLS - tenant isolation
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'usage_logs') THEN
    DROP POLICY IF EXISTS "Users can view their account usage" ON public.usage_logs;

    CREATE POLICY "Users can view their account usage"
    ON public.usage_logs FOR SELECT
    TO authenticated
    USING (
      account_id IN (
        SELECT account_id FROM public.profiles WHERE id = auth.uid()
      )
      OR
      account_id IN (
        SELECT account_id FROM public.account_members WHERE user_id = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM public.staff_roles
        WHERE user_id = auth.uid()
        AND role::text IN ('admin', 'support', 'billing', 'platform_admin', 'platform_owner')
      )
    );
  END IF;
END $$;

-- Ensure all existing tables have RLS enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_roles ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.accounts TO authenticated;
GRANT SELECT, UPDATE ON public.accounts TO authenticated;
GRANT ALL ON public.account_members TO authenticated;
GRANT ALL ON public.phone_numbers TO authenticated;
GRANT ALL ON public.assistants TO authenticated;
GRANT SELECT ON public.staff_roles TO authenticated;
