-- Drop old tables
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.role_change_audit CASCADE;

-- Drop old enum if exists
DROP TYPE IF EXISTS public.app_role CASCADE;

-- Create new enums
CREATE TYPE public.staff_role AS ENUM ('platform_owner', 'platform_admin', 'support', 'viewer');
CREATE TYPE public.account_role AS ENUM ('owner', 'admin', 'user');

-- Create staff_roles table (for RingSnap platform staff)
CREATE TABLE public.staff_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role staff_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Create account_members table (for customer account teams)
CREATE TABLE public.account_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  role account_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, account_id)
);

-- Create role audit log
CREATE TABLE public.role_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID NOT NULL,
  changed_by_user_id UUID NOT NULL,
  change_type TEXT NOT NULL,
  old_role TEXT,
  new_role TEXT,
  account_id UUID,
  context TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.staff_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_audit_log ENABLE ROW LEVEL SECURITY;

-- Create security functions
CREATE OR REPLACE FUNCTION public.has_platform_role(_user_id UUID, _role staff_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.has_account_role(_user_id UUID, _account_id UUID, _role account_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.account_members
    WHERE user_id = _user_id
      AND account_id = _account_id
      AND role = _role
  );
$$;

-- RLS Policies for staff_roles
CREATE POLICY "Platform owners can view all staff roles"
  ON public.staff_roles FOR SELECT
  USING (public.has_platform_role(auth.uid(), 'platform_owner'));

CREATE POLICY "Users can view their own staff role"
  ON public.staff_roles FOR SELECT
  USING (user_id = auth.uid());

-- RLS Policies for account_members
CREATE POLICY "Account owners can view their team"
  ON public.account_members FOR SELECT
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

CREATE POLICY "Users can view their own account memberships"
  ON public.account_members FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Account owners can update roles"
  ON public.account_members FOR UPDATE
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- RLS Policies for role_audit_log
CREATE POLICY "Platform owners can view all audit logs"
  ON public.role_audit_log FOR SELECT
  USING (public.has_platform_role(auth.uid(), 'platform_owner'));

CREATE POLICY "Account owners can view their account audit logs"
  ON public.role_audit_log FOR SELECT
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Make profiles.account_id nullable (critical for staff users)
ALTER TABLE public.profiles ALTER COLUMN account_id DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN name DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN phone DROP NOT NULL;

-- Update handle_new_user_signup trigger to work with new structure
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _account_id UUID;
  _email_domain TEXT;
  _is_generic BOOLEAN;
  _company_name TEXT;
  _is_first_user BOOLEAN;
BEGIN
  -- Check if this is a staff signup (no phone number provided)
  IF NEW.raw_user_meta_data->>'phone' IS NULL THEN
    -- Create staff profile without account
    INSERT INTO public.profiles (id, name, phone, account_id)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
      '',
      NULL
    );
    RETURN NEW;
  END IF;

  -- Regular customer account signup flow
  _email_domain := public.extract_email_domain(NEW.email);
  _is_generic := public.is_generic_email_domain(_email_domain);
  _company_name := COALESCE(NEW.raw_user_meta_data->>'company_name', _email_domain);
  
  IF _is_generic THEN
    SELECT id INTO _account_id
    FROM public.accounts
    WHERE company_name = _company_name
      AND company_domain IS NULL
    LIMIT 1;
  ELSE
    SELECT id INTO _account_id
    FROM public.accounts
    WHERE company_domain = _email_domain
    LIMIT 1;
  END IF;
  
  IF _account_id IS NULL THEN
    INSERT INTO public.accounts (
      company_name,
      company_domain,
      trade,
      wants_advanced_voice,
      subscription_status,
      trial_start_date,
      trial_end_date,
      provisioning_status
    ) VALUES (
      _company_name,
      CASE WHEN _is_generic THEN NULL ELSE _email_domain END,
      NEW.raw_user_meta_data->>'trade',
      COALESCE((NEW.raw_user_meta_data->>'wants_advanced_voice')::boolean, false),
      'trial'::subscription_status,
      now(),
      now() + interval '3 days',
      'pending'
    )
    RETURNING id INTO _account_id;
    _is_first_user := true;
  ELSE
    _is_first_user := false;
  END IF;
  
  INSERT INTO public.profiles (id, account_id, name, phone, is_primary, source)
  VALUES (
    NEW.id,
    _account_id,
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'phone',
    _is_first_user,
    COALESCE(NEW.raw_user_meta_data->>'source', 'website')
  );
  
  INSERT INTO public.account_members (user_id, account_id, role)
  VALUES (NEW.id, _account_id, CASE WHEN _is_first_user THEN 'owner'::account_role ELSE 'user'::account_role END);
  
  RETURN NEW;
END;
$$;