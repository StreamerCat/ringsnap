-- Create enum types for roles and subscription status
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'user');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM ('trial', 'active', 'cancelled', 'expired');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create accounts table (company/organization level)
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  company_domain TEXT UNIQUE,
  trade TEXT,
  wants_advanced_voice BOOLEAN DEFAULT false,
  subscription_status public.subscription_status DEFAULT 'trial',
  trial_start_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  trial_end_date TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '3 days'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create profiles table (user level - linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  source TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create user_roles table (separate for security - prevents privilege escalation)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  UNIQUE(user_id, role)
);

-- Enable RLS on all tables
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Helper function: Extract domain from email
CREATE OR REPLACE FUNCTION public.extract_email_domain(email TEXT)
RETURNS TEXT AS $$
  SELECT lower(split_part(email, '@', 2));
$$ LANGUAGE SQL IMMUTABLE;

-- Helper function: Check if email domain is generic
CREATE OR REPLACE FUNCTION public.is_generic_email_domain(domain TEXT)
RETURNS BOOLEAN AS $$
  SELECT domain IN ('gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'protonmail.com', 'mail.com');
$$ LANGUAGE SQL IMMUTABLE;

-- Security definer function: Check if user has specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

-- Security definer function: Get user's account_id
CREATE OR REPLACE FUNCTION public.get_user_account_id(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT account_id
  FROM public.profiles
  WHERE id = _user_id;
$$;

-- Main trigger function: Handle new user signup
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
  -- Extract metadata from auth user
  _email_domain := public.extract_email_domain(NEW.email);
  _is_generic := public.is_generic_email_domain(_email_domain);
  _company_name := COALESCE(NEW.raw_user_meta_data->>'company_name', _email_domain);
  
  -- Determine if account already exists
  IF _is_generic THEN
    -- For generic emails, match by exact company_name
    SELECT id INTO _account_id
    FROM public.accounts
    WHERE company_name = _company_name
      AND company_domain IS NULL
    LIMIT 1;
  ELSE
    -- For business emails, match by domain
    SELECT id INTO _account_id
    FROM public.accounts
    WHERE company_domain = _email_domain
    LIMIT 1;
  END IF;
  
  -- Create new account if doesn't exist
  IF _account_id IS NULL THEN
    INSERT INTO public.accounts (
      company_name,
      company_domain,
      trade,
      wants_advanced_voice,
      subscription_status,
      trial_start_date,
      trial_end_date
    ) VALUES (
      _company_name,
      CASE WHEN _is_generic THEN NULL ELSE _email_domain END,
      NEW.raw_user_meta_data->>'trade',
      COALESCE((NEW.raw_user_meta_data->>'wants_advanced_voice')::boolean, false),
      'trial',
      now(),
      now() + interval '3 days'
    )
    RETURNING id INTO _account_id;
    
    _is_first_user := true;
  ELSE
    _is_first_user := false;
  END IF;
  
  -- Create profile for user
  INSERT INTO public.profiles (
    id,
    account_id,
    name,
    phone,
    is_primary,
    source
  ) VALUES (
    NEW.id,
    _account_id,
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'phone',
    _is_first_user,
    COALESCE(NEW.raw_user_meta_data->>'source', 'website')
  );
  
  -- Assign role: owner for first user, regular user for others
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN _is_first_user THEN 'owner' ELSE 'user' END);
  
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_signup();

-- RLS Policies for accounts table
DROP POLICY IF EXISTS "Users can view their own account" ON public.accounts;
CREATE POLICY "Users can view their own account"
  ON public.accounts FOR SELECT
  TO authenticated
  USING (id = public.get_user_account_id(auth.uid()));

DROP POLICY IF EXISTS "Account owners can update their account" ON public.accounts;
CREATE POLICY "Account owners can update their account"
  ON public.accounts FOR UPDATE
  TO authenticated
  USING (
    id = public.get_user_account_id(auth.uid()) 
    AND public.has_role(auth.uid(), 'owner')
  );

-- RLS Policies for profiles table
DROP POLICY IF EXISTS "Users can view profiles in their account" ON public.profiles;
CREATE POLICY "Users can view profiles in their account"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (account_id = public.get_user_account_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Owners and admins can update team profiles" ON public.profiles;
CREATE POLICY "Owners and admins can update team profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    account_id = public.get_user_account_id(auth.uid())
    AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'))
  );

-- RLS Policies for user_roles table
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Owners can view all roles in their account" ON public.user_roles;
CREATE POLICY "Owners can view all roles in their account"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner')
    AND user_id IN (
      SELECT id FROM public.profiles WHERE account_id = public.get_user_account_id(auth.uid())
    )
  );

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_accounts_updated_at ON public.accounts;
CREATE TRIGGER update_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();