-- =====================================================
-- COMPLETE SCHEMA EXPORT FOR ORIGINAL SUPABASE PROJECT
-- Project ID: jwoprcqnvheuljjxwrbu
-- =====================================================

-- Step 1: Create Enums
-- =====================================================

CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'user');
CREATE TYPE public.subscription_status AS ENUM ('trial', 'active', 'past_due', 'canceled');

-- Step 2: Create Tables
-- =====================================================

-- Accounts table
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  company_domain TEXT,
  trade TEXT,
  wants_advanced_voice BOOLEAN DEFAULT false,
  subscription_status subscription_status DEFAULT 'trial'::subscription_status,
  trial_start_date TIMESTAMPTZ DEFAULT now(),
  trial_end_date TIMESTAMPTZ DEFAULT (now() + interval '3 days'),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user'::app_role,
  UNIQUE (user_id, role)
);

-- Trial signups table
CREATE TABLE public.trial_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  trade TEXT,
  wants_advanced_voice BOOLEAN DEFAULT false,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Revenue report leads table
CREATE TABLE public.revenue_report_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  business TEXT NOT NULL,
  trade TEXT,
  customer_calls INTEGER,
  lost_revenue NUMERIC,
  recovered_revenue NUMERIC,
  net_gain NUMERIC,
  roi NUMERIC,
  payback_days INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Step 3: Enable Row Level Security
-- =====================================================

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_signups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_report_leads ENABLE ROW LEVEL SECURITY;

-- Step 4: Create Utility Functions
-- =====================================================

-- Extract email domain
CREATE OR REPLACE FUNCTION public.extract_email_domain(email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(split_part(email, '@', 2));
$$;

-- Check if domain is generic
CREATE OR REPLACE FUNCTION public.is_generic_email_domain(domain text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT domain IN ('gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'protonmail.com', 'mail.com');
$$;

-- Check if user has role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
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

-- Get user's account ID
CREATE OR REPLACE FUNCTION public.get_user_account_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT account_id
  FROM public.profiles
  WHERE id = _user_id;
$$;

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS trigger
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
      'trial'::subscription_status,
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
  VALUES (NEW.id, CASE WHEN _is_first_user THEN 'owner'::app_role ELSE 'user'::app_role END);
  
  RETURN NEW;
END;
$$;

-- Step 5: Create Triggers
-- =====================================================

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_signup();

-- Triggers for updated_at columns
CREATE TRIGGER update_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Step 6: Create RLS Policies
-- =====================================================

-- Accounts policies
CREATE POLICY "Users can view their own account"
  ON public.accounts FOR SELECT
  USING (id = get_user_account_id(auth.uid()));

CREATE POLICY "Account owners can update their account"
  ON public.accounts FOR UPDATE
  USING (id = get_user_account_id(auth.uid()) AND has_role(auth.uid(), 'owner'::app_role));

-- Profiles policies
CREATE POLICY "Users can view profiles in their account"
  ON public.profiles FOR SELECT
  USING (account_id = get_user_account_id(auth.uid()));

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Owners and admins can update team profiles"
  ON public.profiles FOR UPDATE
  USING (
    account_id = get_user_account_id(auth.uid()) 
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  );

-- User roles policies
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Owners can view all roles in their account"
  ON public.user_roles FOR SELECT
  USING (
    has_role(auth.uid(), 'owner'::app_role) 
    AND user_id IN (
      SELECT id FROM public.profiles 
      WHERE account_id = get_user_account_id(auth.uid())
    )
  );

-- Trial signups policies
CREATE POLICY "Anyone can create trial signups"
  ON public.trial_signups FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Only owners can view trial signups"
  ON public.trial_signups FOR SELECT
  USING (has_role(auth.uid(), 'owner'::app_role));

-- Revenue report leads policies
CREATE POLICY "Anyone can create revenue report leads"
  ON public.revenue_report_leads FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Only owners can view revenue reports"
  ON public.revenue_report_leads FOR SELECT
  USING (has_role(auth.uid(), 'owner'::app_role));

-- Step 7: Insert Current Data
-- =====================================================

-- Insert accounts
INSERT INTO public.accounts (id, company_name, company_domain, trade, wants_advanced_voice, subscription_status, trial_start_date, trial_end_date, created_at, updated_at)
VALUES ('8bb5d993-d21b-4b05-bbb4-6ae004bb099f', 'email.com', 'email.com', 'roofing', true, 'trial', '2025-11-04 03:54:20.489827+00', '2025-11-07 03:54:20.489827+00', '2025-11-04 03:54:20.489827+00', '2025-11-04 03:54:20.489827+00');

-- Insert trial signups
INSERT INTO public.trial_signups (id, name, email, phone, trade, wants_advanced_voice, source, created_at)
VALUES 
  ('4579780d-3758-4bf1-a332-0bd853d38837', 'josh test', 'josh.sturgeon@gmail.com', '9705565583', NULL, true, 'pricing', '2025-10-27 20:57:03.904471+00'),
  ('3181c7f9-5a84-4fec-927c-9f5623aef3d7', 'Steve Jobs', 'Steve@email.com', '5555555555', 'pest_control', true, 'hero', '2025-11-04 03:29:34.913203+00');

-- NOTE: You'll need to recreate the auth.users entry and profiles/user_roles manually
-- after the user signs up again through your app, OR you can export/import the auth.users
-- data manually from the Supabase dashboard if needed.

-- =====================================================
-- NEXT STEPS:
-- =====================================================
-- 1. Run this SQL in your original Supabase project (jwoprcqnvheuljjxwrbu)
-- 2. Update your .env file with the original project credentials
-- 3. Test the signup/login flow
-- 4. Verify edge functions are working
-- =====================================================
