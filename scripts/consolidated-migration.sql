-- =====================================================
-- RINGSNAP CONSOLIDATED DATABASE MIGRATION
-- =====================================================
-- Run this entire file in Supabase SQL Editor
-- Project: rmyvvbqnccpfeyowidrq
-- URL: https://rmyvvbqnccpfeyowidrq.supabase.co
-- =====================================================
--
-- This combines all 20 migrations in chronological order
-- Execute the entire file at once in SQL Editor
--
-- Expected outcome:
-- - All tables created
-- - All RLS policies applied
-- - All functions and triggers installed
-- - Database fully initialized
--
-- =====================================================


-- =====================================================
-- MIGRATION 1: 20251027211152_e2e5d7a8-b527-4b60-89ca-8ccdbab70ffb.sql
-- =====================================================

-- Create revenue_report_leads table to store calculator form submissions
CREATE TABLE public.revenue_report_leads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  name text NOT NULL,
  email text NOT NULL,
  business text NOT NULL,
  trade text,
  customer_calls integer,
  lost_revenue numeric,
  recovered_revenue numeric,
  net_gain numeric,
  roi numeric,
  payback_days integer
);

-- Enable Row Level Security
ALTER TABLE public.revenue_report_leads ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anonymous inserts for revenue report leads
CREATE POLICY "Anyone can create revenue report leads"
ON public.revenue_report_leads
FOR INSERT
TO anon
WITH CHECK (true);
-- =====================================================
-- MIGRATION 2: 20251104034002_17094ffe-8e7d-48a2-bbbf-b9ffe965d0ac.sql
-- =====================================================

-- Create enum types for roles and subscription status
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'user');
CREATE TYPE public.subscription_status AS ENUM ('trial', 'active', 'cancelled', 'expired');

-- Create accounts table (company/organization level)
CREATE TABLE public.accounts (
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
CREATE TABLE public.profiles (
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
CREATE TABLE public.user_roles (
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
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_signup();

-- RLS Policies for accounts table
CREATE POLICY "Users can view their own account"
  ON public.accounts FOR SELECT
  TO authenticated
  USING (id = public.get_user_account_id(auth.uid()));

CREATE POLICY "Account owners can update their account"
  ON public.accounts FOR UPDATE
  TO authenticated
  USING (
    id = public.get_user_account_id(auth.uid()) 
    AND public.has_role(auth.uid(), 'owner')
  );

-- RLS Policies for profiles table
CREATE POLICY "Users can view profiles in their account"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (account_id = public.get_user_account_id(auth.uid()));

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Owners and admins can update team profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    account_id = public.get_user_account_id(auth.uid())
    AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'))
  );

-- RLS Policies for user_roles table
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

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
CREATE TRIGGER update_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
-- =====================================================
-- MIGRATION 3: 20251104035300_5708d916-9343-456a-97aa-aaaf4ea079c9.sql
-- =====================================================

-- Fix type casting in handle_new_user_signup trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  
  -- Assign role: owner for first user, regular user for others (with explicit type casting)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN _is_first_user THEN 'owner'::app_role ELSE 'user'::app_role END);
  
  RETURN NEW;
END;
$function$;
-- =====================================================
-- MIGRATION 4: 20251104035338_2b49b3eb-dba5-4451-8c44-4721594b26fd.sql
-- =====================================================

-- Fix type casting in handle_new_user_signup trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  
  -- Assign role: owner for first user, regular user for others (with explicit type casting)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN _is_first_user THEN 'owner'::app_role ELSE 'user'::app_role END);
  
  RETURN NEW;
END;
$function$;
-- =====================================================
-- MIGRATION 5: 20251104035411_2189a9a7-41e9-4c39-a4b2-625442b57f04.sql
-- =====================================================

-- Fix search_path for security on utility functions

-- Update extract_email_domain function
CREATE OR REPLACE FUNCTION public.extract_email_domain(email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT lower(split_part(email, '@', 2));
$function$;

-- Update is_generic_email_domain function
CREATE OR REPLACE FUNCTION public.is_generic_email_domain(domain text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT domain IN ('gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'protonmail.com', 'mail.com');
$function$;

-- Update update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;
-- =====================================================
-- MIGRATION 6: 20251104215138_add_sales_tracking_fields.sql
-- =====================================================

-- Add sales rep tracking to accounts table
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS sales_rep_name TEXT,
ADD COLUMN IF NOT EXISTS service_area TEXT,
ADD COLUMN IF NOT EXISTS business_hours JSONB,
ADD COLUMN IF NOT EXISTS emergency_policy TEXT,
ADD COLUMN IF NOT EXISTS plan_type TEXT CHECK (plan_type IN ('starter', 'professional', 'premium'));

-- Add sales rep tracking to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS sales_rep_name TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.accounts.plan_type IS 'Plan type selected during sales signup: starter (≤80 calls), professional (≤160 calls), premium (>160 calls)';
COMMENT ON COLUMN public.accounts.sales_rep_name IS 'Name of sales representative who created this account';
COMMENT ON COLUMN public.accounts.service_area IS 'Geographic service area for the business';
COMMENT ON COLUMN public.accounts.business_hours IS 'Business hours in JSONB format (e.g., {"monday": {"open": "08:00", "close": "17:00"}})';
COMMENT ON COLUMN public.accounts.emergency_policy IS 'Emergency call handling policy';

-- =====================================================
-- MIGRATION 7: 20251105174239_fb4f01dc-6d03-40b7-adc7-2362ac2b4923.sql
-- =====================================================

-- Add Stripe integration columns to accounts table
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'starter';

-- Add VAPI integration columns
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS vapi_assistant_id TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS vapi_phone_number TEXT;

-- Add business configuration columns
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS sales_rep_name TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS service_area TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT '{"monday": "9-5", "tuesday": "9-5", "wednesday": "9-5", "thursday": "9-5", "friday": "9-5"}'::jsonb;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS emergency_policy TEXT DEFAULT 'Transfer all emergency calls immediately';

-- Add provisioning status tracking
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS provisioning_status TEXT DEFAULT 'pending';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS provisioning_error TEXT;

-- Add past_due to subscription_status enum
DO $$ BEGIN
  ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'past_due';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create usage tracking table
CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  call_id TEXT,
  call_duration_seconds INTEGER,
  call_cost_cents INTEGER,
  call_type TEXT,
  customer_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB
);

-- Enable RLS on usage_logs
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their account usage
CREATE POLICY "Users can view their account usage"
ON usage_logs FOR SELECT
USING (account_id = get_user_account_id(auth.uid()));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_usage_logs_account_id ON usage_logs(account_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_accounts_stripe_customer ON accounts(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_accounts_vapi_assistant ON accounts(vapi_assistant_id);
-- =====================================================
-- MIGRATION 8: 20251105190549_710be8cd-1c1b-4006-b660-38b15c349ffb.sql
-- =====================================================

-- =====================================================
-- BATCH 3: COMPLETE MVP SCHEMA
-- Plan-based limits, multi-assistant, anti-abuse, referrals, SMS, recording
-- =====================================================

-- 1. PLAN DEFINITIONS TABLE
CREATE TABLE plan_definitions (
  plan_type TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  monthly_minutes_limit INTEGER NOT NULL,
  max_phone_numbers INTEGER NOT NULL,
  max_assistants INTEGER NOT NULL,
  call_recording_enabled BOOLEAN DEFAULT false,
  sms_enabled BOOLEAN DEFAULT false,
  price_cents INTEGER NOT NULL,
  overage_rate_cents INTEGER NOT NULL,
  stripe_price_id TEXT
);

-- Seed plans with correct limits and overage rates
INSERT INTO plan_definitions VALUES
  ('trial', 'Free Trial', 150, 1, 1, false, false, 0, 0, NULL),
  ('starter', 'Starter', 500, 1, 1, false, false, 29700, 90, 'price_starter_monthly'),
  ('professional', 'Professional', 1000, 5, 3, true, true, 79700, 70, 'price_pro_monthly'),
  ('premium', 'Premium', 2500, 5, 5, true, true, 149700, 50, 'price_premium_monthly');

-- 2. EXTEND ACCOUNTS TABLE
ALTER TABLE accounts 
  ADD COLUMN monthly_minutes_limit INTEGER DEFAULT 150,
  ADD COLUMN monthly_minutes_used INTEGER DEFAULT 0,
  ADD COLUMN overage_minutes_used INTEGER DEFAULT 0,
  ADD COLUMN billing_cycle_start DATE DEFAULT CURRENT_DATE,
  ADD COLUMN overage_cap_percentage INTEGER DEFAULT 200,
  ADD COLUMN last_usage_warning_sent_at TIMESTAMPTZ,
  ADD COLUMN last_usage_warning_level TEXT CHECK (last_usage_warning_level IN ('80', '95', '100', 'cap')),
  ADD COLUMN account_status TEXT DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'disabled', 'cancelled')),
  ADD COLUMN zip_code TEXT,
  ADD COLUMN assistant_gender TEXT DEFAULT 'female' CHECK (assistant_gender IN ('male', 'female')),
  ADD COLUMN phone_number_area_code TEXT,
  ADD COLUMN phone_number_status TEXT DEFAULT 'pending' CHECK (phone_number_status IN ('pending', 'active', 'suspended', 'held', 'released')),
  ADD COLUMN phone_number_held_until TIMESTAMPTZ,
  ADD COLUMN call_recording_enabled BOOLEAN DEFAULT false,
  ADD COLUMN call_recording_consent_accepted BOOLEAN DEFAULT false,
  ADD COLUMN call_recording_consent_date TIMESTAMPTZ,
  ADD COLUMN call_recording_retention_days INTEGER DEFAULT 30,
  ADD COLUMN billing_state TEXT,
  ADD COLUMN company_website TEXT,
  ADD COLUMN service_specialties TEXT,
  ADD COLUMN custom_instructions TEXT CHECK (LENGTH(custom_instructions) <= 500),
  ADD COLUMN sms_enabled BOOLEAN DEFAULT false,
  ADD COLUMN sms_appointment_confirmations BOOLEAN DEFAULT true,
  ADD COLUMN sms_reminders BOOLEAN DEFAULT true,
  ADD COLUMN daily_sms_quota INTEGER DEFAULT 100,
  ADD COLUMN daily_sms_sent INTEGER DEFAULT 0,
  ADD COLUMN signup_ip TEXT,
  ADD COLUMN device_fingerprint TEXT,
  ADD COLUMN is_flagged_for_review BOOLEAN DEFAULT false,
  ADD COLUMN flagged_reason TEXT,
  ADD COLUMN phone_verified BOOLEAN DEFAULT false,
  ADD COLUMN email_verified BOOLEAN DEFAULT false;

-- 3. EXTEND TRIAL SIGNUPS TABLE (SKIPPED - table does not exist in base schema)
-- The trial_signups table was from an earlier Lovable iteration
-- Commenting out to avoid migration errors
--
-- ALTER TABLE trial_signups
--   ADD COLUMN assistant_gender TEXT DEFAULT 'female' CHECK (assistant_gender IN ('male', 'female')),
--   ADD COLUMN zip_code TEXT,
--   ADD COLUMN referral_code TEXT;

-- 4. PHONE NUMBERS TABLE (Multi-phone support)
CREATE TABLE phone_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL UNIQUE,
  area_code TEXT NOT NULL,
  vapi_phone_id TEXT UNIQUE,
  label TEXT,
  purpose TEXT CHECK (purpose IN ('primary', 'secondary', 'spanish', 'overflow', 'after-hours')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'held', 'released')),
  held_until TIMESTAMPTZ,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_phone_numbers_primary ON phone_numbers(account_id, is_primary) WHERE is_primary = true;

-- 5. ASSISTANTS TABLE (Multi-assistant support)
CREATE TABLE assistants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  phone_number_id UUID REFERENCES phone_numbers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  vapi_assistant_id TEXT UNIQUE,
  voice_id TEXT NOT NULL,
  voice_gender TEXT CHECK (voice_gender IN ('male', 'female')),
  language TEXT DEFAULT 'en-US',
  custom_instructions TEXT CHECK (LENGTH(custom_instructions) <= 500),
  is_primary BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_assistants_primary ON assistants(account_id, is_primary) WHERE is_primary = true;

-- 6. VOICE LIBRARY TABLE
CREATE TABLE voice_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'elevenlabs',
  voice_id TEXT NOT NULL UNIQUE,
  voice_name TEXT NOT NULL,
  gender TEXT CHECK (gender IN ('male', 'female', 'neutral')),
  accent TEXT,
  tone TEXT,
  sample_url TEXT,
  is_premium BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default voices
INSERT INTO voice_library (voice_id, voice_name, gender, accent, tone) VALUES
  ('jennifer-professional', 'Sarah', 'female', 'american', 'professional'),
  ('michael-professional', 'Michael', 'male', 'american', 'professional');

-- 7. STATE RECORDING LAWS TABLE
CREATE TABLE state_recording_laws (
  state_code TEXT PRIMARY KEY,
  state_name TEXT NOT NULL,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('one-party', 'two-party', 'all-party')),
  requires_notification BOOLEAN DEFAULT true,
  notification_text TEXT DEFAULT 'This call may be recorded for quality and training purposes.'
);

-- Seed two-party consent states (11 states)
INSERT INTO state_recording_laws VALUES
  ('CA', 'California', 'two-party', true, 'This call may be recorded for quality and training purposes.'),
  ('CT', 'Connecticut', 'two-party', true, 'This call may be recorded for quality and training purposes.'),
  ('FL', 'Florida', 'two-party', true, 'This call may be recorded for quality and training purposes.'),
  ('IL', 'Illinois', 'two-party', true, 'This call may be recorded for quality and training purposes.'),
  ('MD', 'Maryland', 'two-party', true, 'This call may be recorded for quality and training purposes.'),
  ('MA', 'Massachusetts', 'two-party', true, 'This call may be recorded for quality and training purposes.'),
  ('MT', 'Montana', 'two-party', true, 'This call may be recorded for quality and training purposes.'),
  ('NH', 'New Hampshire', 'two-party', true, 'This call may be recorded for quality and training purposes.'),
  ('PA', 'Pennsylvania', 'two-party', true, 'This call may be recorded for quality and training purposes.'),
  ('WA', 'Washington', 'two-party', true, 'This call may be recorded for quality and training purposes.'),
  ('HI', 'Hawaii', 'two-party', true, 'This call may be recorded for quality and training purposes.');

-- 8. ANTI-ABUSE: SIGNUP ATTEMPTS TABLE
CREATE TABLE signup_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  phone TEXT,
  ip_address TEXT NOT NULL,
  device_fingerprint TEXT,
  success BOOLEAN DEFAULT false,
  blocked_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_signup_attempts_ip ON signup_attempts(ip_address, created_at);
CREATE INDEX idx_signup_attempts_email ON signup_attempts(email, created_at);

-- 9. ANTI-ABUSE: CALL PATTERN ALERTS TABLE
CREATE TABLE call_pattern_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id),
  alert_type TEXT NOT NULL,
  alert_details JSONB,
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  auto_flagged BOOLEAN DEFAULT false,
  reviewed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_call_pattern_alerts_account ON call_pattern_alerts(account_id, created_at);

-- 10. REFERRAL CODES TABLE
CREATE TABLE referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_referral_codes_account ON referral_codes(account_id);

-- 11. REFERRALS TABLE
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_account_id UUID REFERENCES accounts(id),
  referee_account_id UUID REFERENCES accounts(id),
  referral_code TEXT REFERENCES referral_codes(code),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'converted', 'expired')),
  referrer_credit_cents INTEGER DEFAULT 5000,
  referee_credit_cents INTEGER DEFAULT 2500,
  referee_signup_ip TEXT,
  referee_phone TEXT,
  referee_email TEXT,
  is_flagged BOOLEAN DEFAULT false,
  flag_reason TEXT,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_referrals_referrer ON referrals(referrer_account_id);
CREATE INDEX idx_referrals_referee ON referrals(referee_account_id);

-- 12. ACCOUNT CREDITS TABLE
CREATE TABLE account_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id),
  amount_cents INTEGER NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('referral', 'promotion', 'refund', 'compensation')),
  source_id UUID,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'applied', 'expired')),
  applied_to_invoice_id TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_account_credits_account ON account_credits(account_id, status);

-- 13. SMS MESSAGES TABLE
CREATE TABLE sms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id),
  phone_number_id UUID REFERENCES phone_numbers(id),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  message_body TEXT NOT NULL,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed', 'pending')),
  vapi_message_id TEXT,
  conversation_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sms_messages_account ON sms_messages(account_id, created_at);

-- 14. EXTEND USAGE LOGS TABLE
ALTER TABLE usage_logs
  ADD COLUMN assistant_id UUID REFERENCES assistants(id),
  ADD COLUMN phone_number_id UUID REFERENCES phone_numbers(id),
  ADD COLUMN recording_url TEXT,
  ADD COLUMN recording_duration_seconds INTEGER,
  ADD COLUMN recording_expires_at TIMESTAMPTZ,
  ADD COLUMN was_transferred BOOLEAN DEFAULT false,
  ADD COLUMN was_emergency BOOLEAN DEFAULT false,
  ADD COLUMN appointment_booked BOOLEAN DEFAULT false,
  ADD COLUMN is_overage BOOLEAN DEFAULT false;

-- 15. UPDATE TRIGGERS FOR TIMESTAMPS
CREATE TRIGGER update_phone_numbers_updated_at
  BEFORE UPDATE ON phone_numbers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assistants_updated_at
  BEFORE UPDATE ON assistants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
-- =====================================================
-- MIGRATION 9: 20251105200007_973e8572-0df1-4577-ab89-4671fe3e90e1.sql
-- =====================================================

-- Drop existing trigger function
DROP FUNCTION IF EXISTS public.handle_new_user_signup() CASCADE;

-- Recreate with provisioning_status set to 'pending'
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_signup();
-- =====================================================
-- MIGRATION 10: 20251106121500_admin_monitoring_views.sql
-- =====================================================

-- Supporting views for admin monitoring dashboard

create or replace view admin_provisioning_status_counts as
select
  coalesce(provisioning_status, 'unknown') as provisioning_status,
  count(*)::bigint as account_count,
  count(*) filter (where provisioning_error is not null)::bigint as accounts_with_errors,
  max(updated_at) filter (where provisioning_error is not null) as last_failure_at
from accounts
group by coalesce(provisioning_status, 'unknown');

create or replace view admin_provisioning_failures as
select
  a.id as account_id,
  a.company_name,
  coalesce(a.provisioning_status, 'unknown') as provisioning_status,
  a.provisioning_error,
  greatest(a.updated_at, a.created_at) as updated_at
from accounts a
where a.provisioning_error is not null
   or coalesce(a.provisioning_status, '') in ('failed', 'provisioning');

create or replace view admin_daily_call_stats as
select
  (date_trunc('day', created_at))::date as call_date,
  count(*)::bigint as call_count,
  coalesce(sum(call_duration_seconds), 0)::bigint as total_call_seconds,
  (coalesce(sum(call_duration_seconds), 0)::numeric / 60) as total_call_minutes,
  coalesce(sum(call_cost_cents), 0)::bigint as total_cost_cents
from usage_logs
where created_at is not null
group by (date_trunc('day', created_at))::date;

create or replace view admin_edge_function_error_feed as
select
  cpa.id,
  cpa.created_at,
  cpa.alert_type,
  cpa.severity,
  cpa.auto_flagged,
  cpa.reviewed,
  cpa.account_id,
  a.company_name,
  cpa.alert_details,
  coalesce(cpa.alert_details ->> 'function_name', cpa.alert_details ->> 'function') as function_name,
  coalesce(cpa.alert_details ->> 'error_message', cpa.alert_details ->> 'message') as error_message,
  cpa.alert_details ->> 'request_id' as request_id
from call_pattern_alerts cpa
left join accounts a on a.id = cpa.account_id
where cpa.alert_type is not null
  and lower(cpa.alert_type) like 'edge_function%';

create or replace view admin_flagged_accounts as
select
  a.id as account_id,
  a.company_name,
  a.plan_type,
  a.provisioning_status,
  a.provisioning_error,
  a.account_status,
  a.is_flagged_for_review,
  a.flagged_reason,
  a.monthly_minutes_used,
  a.monthly_minutes_limit,
  a.created_at,
  a.updated_at,
  coalesce(alerts.total_alerts, 0)::bigint as total_alerts,
  alerts.last_alert_at,
  alerts.alert_types
from accounts a
left join (
  select
    account_id,
    count(*)::bigint as total_alerts,
    max(created_at) as last_alert_at,
    array_remove(array_agg(distinct alert_type), null) as alert_types
  from call_pattern_alerts
  group by account_id
) alerts on alerts.account_id = a.id
where coalesce(a.is_flagged_for_review, false) = true
   or a.flagged_reason is not null
   or a.provisioning_error is not null
   or (a.account_status is not null and a.account_status <> 'active')
   or coalesce(alerts.total_alerts, 0) > 0;

-- Allow authenticated dashboard users to read the monitoring views
grant select on admin_provisioning_status_counts to authenticated, service_role;
grant select on admin_provisioning_failures to authenticated, service_role;
grant select on admin_daily_call_stats to authenticated, service_role;
grant select on admin_edge_function_error_feed to authenticated, service_role;
grant select on admin_flagged_accounts to authenticated, service_role;

-- =====================================================
-- MIGRATION 11: 20251106155719_c550bea9-4717-47f8-9090-3acd8d8a22d6.sql
-- =====================================================

-- Create audit log table for tracking role changes
CREATE TABLE public.role_change_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  changed_by_user_id UUID NOT NULL,
  target_user_id UUID NOT NULL,
  old_role app_role,
  new_role app_role NOT NULL,
  change_type TEXT NOT NULL, -- 'added', 'updated', 'removed'
  context TEXT, -- 'internal_staff' or 'customer_team'
  account_id UUID REFERENCES public.accounts(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.role_change_audit ENABLE ROW LEVEL SECURITY;

-- Only owners can view audit logs
CREATE POLICY "Owners can view all audit logs"
ON public.role_change_audit
FOR SELECT
USING (has_role(auth.uid(), 'owner'));

-- Account owners can view their account's audit logs
CREATE POLICY "Account owners can view their account audit logs"
ON public.role_change_audit
FOR SELECT
USING (
  account_id = get_user_account_id(auth.uid()) 
  AND has_role(auth.uid(), 'owner')
);

-- Create index for better query performance
CREATE INDEX idx_role_audit_target_user ON public.role_change_audit(target_user_id);
CREATE INDEX idx_role_audit_changed_by ON public.role_change_audit(changed_by_user_id);
CREATE INDEX idx_role_audit_account ON public.role_change_audit(account_id);
-- =====================================================
-- MIGRATION 12: 20251106163142_53bd04d2-c541-4c79-9f0f-c2798e99487e.sql
-- =====================================================

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
-- =====================================================
-- MIGRATION 13: 20251106214906_35c80a3d-d992-4b82-9d08-0999345f8edc.sql
-- =====================================================

-- Enable Row Level Security on all unprotected tables
ALTER TABLE public.account_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_pattern_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signup_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;

-- Account Credits Policies
CREATE POLICY "Users can view their account credits"
  ON public.account_credits FOR SELECT
  USING (account_id = get_user_account_id(auth.uid()));

CREATE POLICY "Platform owners can manage all credits"
  ON public.account_credits FOR ALL
  USING (has_platform_role(auth.uid(), 'platform_owner'::staff_role));

-- Assistants Policies
CREATE POLICY "Users can view their account assistants"
  ON public.assistants FOR SELECT
  USING (account_id = get_user_account_id(auth.uid()));

CREATE POLICY "Users can manage their account assistants"
  ON public.assistants FOR ALL
  USING (account_id = get_user_account_id(auth.uid()));

-- Call Pattern Alerts Policies
CREATE POLICY "Platform owners can view all alerts"
  ON public.call_pattern_alerts FOR SELECT
  USING (has_platform_role(auth.uid(), 'platform_owner'::staff_role));

CREATE POLICY "Users can view their account alerts"
  ON public.call_pattern_alerts FOR SELECT
  USING (account_id = get_user_account_id(auth.uid()));

-- Phone Numbers Policies
CREATE POLICY "Users can view their account phone numbers"
  ON public.phone_numbers FOR SELECT
  USING (account_id = get_user_account_id(auth.uid()));

CREATE POLICY "Users can manage their account phone numbers"
  ON public.phone_numbers FOR ALL
  USING (account_id = get_user_account_id(auth.uid()));

-- Plan Definitions Policies (read-only for all authenticated users)
CREATE POLICY "Authenticated users can view plan definitions"
  ON public.plan_definitions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Platform owners can manage plan definitions"
  ON public.plan_definitions FOR ALL
  USING (has_platform_role(auth.uid(), 'platform_owner'::staff_role));

-- Referral Codes Policies
CREATE POLICY "Users can view their own referral codes"
  ON public.referral_codes FOR SELECT
  USING (account_id = get_user_account_id(auth.uid()));

CREATE POLICY "Platform owners can manage all referral codes"
  ON public.referral_codes FOR ALL
  USING (has_platform_role(auth.uid(), 'platform_owner'::staff_role));

-- Referrals Policies
CREATE POLICY "Users can view their referrals as referrer"
  ON public.referrals FOR SELECT
  USING (referrer_account_id = get_user_account_id(auth.uid()));

CREATE POLICY "Users can view their referrals as referee"
  ON public.referrals FOR SELECT
  USING (referee_account_id = get_user_account_id(auth.uid()));

CREATE POLICY "Platform owners can manage all referrals"
  ON public.referrals FOR ALL
  USING (has_platform_role(auth.uid(), 'platform_owner'::staff_role));

-- Signup Attempts Policies (admin only)
CREATE POLICY "Platform owners can view all signup attempts"
  ON public.signup_attempts FOR SELECT
  USING (has_platform_role(auth.uid(), 'platform_owner'::staff_role));

-- SMS Messages Policies
CREATE POLICY "Users can view their account SMS messages"
  ON public.sms_messages FOR SELECT
  USING (account_id = get_user_account_id(auth.uid()));

CREATE POLICY "Users can send SMS from their account"
  ON public.sms_messages FOR INSERT
  WITH CHECK (account_id = get_user_account_id(auth.uid()));

CREATE POLICY "Platform owners can view all SMS messages"
  ON public.sms_messages FOR SELECT
  USING (has_platform_role(auth.uid(), 'platform_owner'::staff_role));
-- =====================================================
-- MIGRATION 14: 20251107123000_provisioning_tables.sql
-- =====================================================

create table if not exists public.vapi_assistants (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  vapi_assistant_id text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.vapi_numbers (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  vapi_number_id text not null,
  phone_e164 text not null,
  country text,
  created_at timestamptz not null default now()
);

create table if not exists public.provisioning_jobs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  user_id uuid not null,
  status text not null default 'queued',
  step text,
  error text,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.vapi_assistants disable row level security;
alter table if exists public.vapi_numbers disable row level security;
alter table if exists public.provisioning_jobs disable row level security;

alter table if exists public.accounts
  add column if not exists vapi_assistant_id text,
  add column if not exists vapi_number_id text,
  add column if not exists phone_number_e164 text;

-- =====================================================
-- MIGRATION 15: 20251107130000_add_phone_provisioning.sql
-- =====================================================

-- Add provisioning-related columns to accounts table
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS provisioning_status text DEFAULT 'idle' CHECK (provisioning_status IN ('idle', 'provisioning', 'pending', 'active', 'failed')),
  ADD COLUMN IF NOT EXISTS vapi_phone_number_id uuid REFERENCES public.phone_numbers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS phone_provisioned_at timestamptz;

-- Add provisioning-related columns to phone_numbers table
ALTER TABLE public.phone_numbers
  ADD COLUMN IF NOT EXISTS vapi_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS provisioning_attempts int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_polled_at timestamptz,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS raw jsonb;

-- Create phone_number_notifications table for tracking notifications
CREATE TABLE IF NOT EXISTS public.phone_number_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number_id uuid NOT NULL REFERENCES public.phone_numbers(id) ON DELETE CASCADE,
  notification_type text NOT NULL, -- 'sms' | 'email'
  recipient text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at timestamptz,
  error_details text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_phone_notifications_status ON public.phone_number_notifications(status);
CREATE INDEX IF NOT EXISTS idx_phone_notifications_phone_id ON public.phone_number_notifications(phone_number_id);

-- Create provisioning_logs table for audit trail
CREATE TABLE IF NOT EXISTS public.provisioning_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  operation text NOT NULL, -- 'create_started' | 'create_success' | 'create_failed' | 'poll_success' | 'poll_failed' | 'notification_sent'
  details jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provisioning_logs_account_id ON public.provisioning_logs(account_id);

-- Enable RLS on new tables
ALTER TABLE public.phone_number_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provisioning_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can read their own notifications
CREATE POLICY "users_can_read_own_notifications"
ON public.phone_number_notifications FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.phone_numbers pn
    JOIN public.accounts a ON a.id = pn.account_id
    WHERE pn.id = phone_number_notifications.phone_number_id
    AND a.user_id = auth.uid()
  )
);

-- RLS Policy: Users can read their own provisioning logs
CREATE POLICY "users_can_read_own_provisioning_logs"
ON public.provisioning_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.accounts a
    WHERE a.id = provisioning_logs.account_id
    AND a.user_id = auth.uid()
  )
);

-- Update indexes for performance
CREATE INDEX IF NOT EXISTS idx_accounts_provisioning_status ON public.accounts(provisioning_status);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_status ON public.phone_numbers(status);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_vapi_id ON public.phone_numbers(vapi_id);

-- =====================================================
-- MIGRATION 16: 20251107234915_010f4fb4-e906-4324-9b25-07e73d198239.sql
-- =====================================================

-- Add 'sales' to staff_role enum
ALTER TYPE staff_role ADD VALUE IF NOT EXISTS 'sales';
-- =====================================================
-- MIGRATION 17: 20251107234936_f3a30f98-1883-4ddc-a0d9-8eccdd28e026.sql
-- =====================================================

-- Create RLS policy for sales reps to view their assigned accounts
CREATE POLICY "Sales reps can view their assigned accounts"
ON accounts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM staff_roles sr
    JOIN profiles p ON p.id = sr.user_id
    WHERE sr.user_id = auth.uid()
    AND sr.role = 'sales'
    AND accounts.sales_rep_name = p.name
  )
);

-- Create RLS policy for sales reps to view account members of their accounts
CREATE POLICY "Sales reps can view members of their assigned accounts"
ON account_members
FOR SELECT
TO authenticated
USING (
  account_id IN (
    SELECT a.id
    FROM accounts a
    JOIN staff_roles sr ON sr.user_id = auth.uid()
    JOIN profiles p ON p.id = sr.user_id
    WHERE sr.role = 'sales'
    AND a.sales_rep_name = p.name
  )
);

-- Create RLS policy for sales reps to view profiles in their accounts
CREATE POLICY "Sales reps can view profiles in their assigned accounts"
ON profiles
FOR SELECT
TO authenticated
USING (
  account_id IN (
    SELECT a.id
    FROM accounts a
    JOIN staff_roles sr ON sr.user_id = auth.uid()
    JOIN profiles p ON p.id = sr.user_id
    WHERE sr.role = 'sales'
    AND a.sales_rep_name = p.name
  )
);
-- =====================================================
-- MIGRATION 18: 20251108000001_create_auth_system_tables.sql
-- =====================================================

-- Auth System Tables Migration
-- Creates tables for magic links, tokens, sessions, passkeys, and audit logging

-- Auth tokens table for magic links, invites, and one-time tokens
CREATE TABLE IF NOT EXISTS public.auth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_type text NOT NULL CHECK (token_type IN ('magic_link', 'invite', 'password_reset', 'finish_setup')),
  token_hash text NOT NULL UNIQUE,
  email text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  meta jsonb DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  device_nonce text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_auth_tokens_token_hash ON public.auth_tokens(token_hash);
CREATE INDEX idx_auth_tokens_email ON public.auth_tokens(email);
CREATE INDEX idx_auth_tokens_expires_at ON public.auth_tokens(expires_at);
CREATE INDEX idx_auth_tokens_user_id ON public.auth_tokens(user_id);

-- Auth events table for security audit logging
CREATE TABLE IF NOT EXISTS public.auth_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_data jsonb DEFAULT '{}'::jsonb,
  ip_address inet,
  user_agent text,
  success boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_auth_events_user_id ON public.auth_events(user_id);
CREATE INDEX idx_auth_events_account_id ON public.auth_events(account_id);
CREATE INDEX idx_auth_events_created_at ON public.auth_events(created_at);
CREATE INDEX idx_auth_events_event_type ON public.auth_events(event_type);

-- Email events table for tracking deliverability via Resend webhooks
CREATE TABLE IF NOT EXISTS public.email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id text,
  email_type text NOT NULL,
  recipient text NOT NULL,
  event text NOT NULL,
  event_data jsonb DEFAULT '{}'::jsonb,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_email_events_email_id ON public.email_events(email_id);
CREATE INDEX idx_email_events_recipient ON public.email_events(recipient);
CREATE INDEX idx_email_events_user_id ON public.email_events(user_id);
CREATE INDEX idx_email_events_created_at ON public.email_events(created_at);

-- Passkeys/WebAuthn credentials table
CREATE TABLE IF NOT EXISTS public.passkeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id text NOT NULL UNIQUE,
  public_key text NOT NULL,
  counter bigint DEFAULT 0,
  device_name text,
  transports text[] DEFAULT ARRAY[]::text[],
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_passkeys_user_id ON public.passkeys(user_id);
CREATE INDEX idx_passkeys_credential_id ON public.passkeys(credential_id);

-- Extended sessions table for tracking active sessions with device info
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token text NOT NULL UNIQUE,
  device_info jsonb DEFAULT '{}'::jsonb,
  ip_address inet,
  user_agent text,
  expires_at timestamptz NOT NULL,
  last_activity_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX idx_user_sessions_session_token ON public.user_sessions(session_token);
CREATE INDEX idx_user_sessions_expires_at ON public.user_sessions(expires_at);

-- Rate limiting table for abuse prevention
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  action text NOT NULL,
  count integer DEFAULT 1,
  window_start timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX idx_rate_limits_identifier_action ON public.rate_limits(identifier, action, window_start);
CREATE INDEX idx_rate_limits_window_start ON public.rate_limits(window_start);

-- Add 2FA fields to profiles table if not exists
DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS totp_secret text;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS totp_enabled boolean DEFAULT false;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS totp_backup_codes text[];
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS requires_2fa boolean DEFAULT false;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_2fa_at timestamptz;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS recovery_email text;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- Add step-up auth tracking
DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_step_up_at timestamptz;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- Update staff_roles table to include SSO fields if not exists
DO $$ BEGIN
  ALTER TABLE public.staff_roles ADD COLUMN IF NOT EXISTS sso_provider text;
  ALTER TABLE public.staff_roles ADD COLUMN IF NOT EXISTS sso_id text;
  ALTER TABLE public.staff_roles ADD COLUMN IF NOT EXISTS enforce_2fa boolean DEFAULT true;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- Function to clean up expired tokens (run via cron or periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_auth_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM public.auth_tokens
  WHERE expires_at < now() - interval '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old rate limit records
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM public.rate_limits
  WHERE window_start < now() - interval '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log auth events
CREATE OR REPLACE FUNCTION public.log_auth_event(
  p_user_id uuid,
  p_account_id uuid,
  p_event_type text,
  p_event_data jsonb DEFAULT '{}'::jsonb,
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_success boolean DEFAULT true
)
RETURNS uuid AS $$
DECLARE
  v_event_id uuid;
BEGIN
  INSERT INTO public.auth_events (
    user_id,
    account_id,
    event_type,
    event_data,
    ip_address,
    user_agent,
    success
  ) VALUES (
    p_user_id,
    p_account_id,
    p_event_type,
    p_event_data,
    p_ip_address,
    p_user_agent,
    p_success
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check rate limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier text,
  p_action text,
  p_max_count integer,
  p_window_minutes integer DEFAULT 60
)
RETURNS boolean AS $$
DECLARE
  v_count integer;
  v_window_start timestamptz;
BEGIN
  v_window_start := date_trunc('hour', now()) - (extract(minute from now())::integer % p_window_minutes) * interval '1 minute';

  -- Get or create rate limit record
  INSERT INTO public.rate_limits (identifier, action, count, window_start)
  VALUES (p_identifier, p_action, 1, v_window_start)
  ON CONFLICT (identifier, action, window_start)
  DO UPDATE SET count = rate_limits.count + 1
  RETURNING count INTO v_count;

  RETURN v_count <= p_max_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on new tables
ALTER TABLE public.auth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passkeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS Policies for auth_tokens (admin and owner access only)
CREATE POLICY "Users can view their own auth tokens"
  ON public.auth_tokens FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Service role can manage all auth tokens"
  ON public.auth_tokens FOR ALL
  TO service_role
  USING (true);

-- RLS Policies for auth_events (users can view their own)
CREATE POLICY "Users can view their own auth events"
  ON public.auth_events FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all auth events"
  ON public.auth_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'support')
    )
  );

CREATE POLICY "Service role can manage all auth events"
  ON public.auth_events FOR ALL
  TO service_role
  USING (true);

-- RLS Policies for email_events (users can view their own)
CREATE POLICY "Users can view their own email events"
  ON public.email_events FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage all email events"
  ON public.email_events FOR ALL
  TO service_role
  USING (true);

-- RLS Policies for passkeys (users manage their own)
CREATE POLICY "Users can manage their own passkeys"
  ON public.passkeys FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage all passkeys"
  ON public.passkeys FOR ALL
  TO service_role
  USING (true);

-- RLS Policies for user_sessions (users can view/revoke their own)
CREATE POLICY "Users can manage their own sessions"
  ON public.user_sessions FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage all sessions"
  ON public.user_sessions FOR ALL
  TO service_role
  USING (true);

-- RLS Policies for rate_limits (service role only)
CREATE POLICY "Service role can manage rate limits"
  ON public.rate_limits FOR ALL
  TO service_role
  USING (true);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT ALL ON public.auth_tokens TO service_role;
GRANT ALL ON public.auth_events TO service_role;
GRANT ALL ON public.email_events TO service_role;
GRANT ALL ON public.passkeys TO service_role;
GRANT ALL ON public.user_sessions TO service_role;
GRANT ALL ON public.rate_limits TO service_role;

GRANT SELECT ON public.auth_tokens TO authenticated;
GRANT SELECT ON public.auth_events TO authenticated;
GRANT SELECT ON public.email_events TO authenticated;
GRANT ALL ON public.passkeys TO authenticated;
GRANT ALL ON public.user_sessions TO authenticated;

-- =====================================================
-- MIGRATION 19: 20251108000002_jwt_claims_and_rbac.sql
-- =====================================================

-- JWT Claims and RBAC Migration
-- Sets up custom JWT claims for roles and account context

-- Function to get user's primary role
CREATE OR REPLACE FUNCTION public.get_user_primary_role(p_user_id uuid)
RETURNS text AS $$
DECLARE
  v_role text;
BEGIN
  -- Check if user is staff first (staff roles take precedence)
  SELECT role INTO v_role
  FROM public.staff_roles
  WHERE user_id = p_user_id
  ORDER BY
    CASE role
      WHEN 'admin' THEN 1
      WHEN 'owner' THEN 2
      WHEN 'sales' THEN 3
      WHEN 'support' THEN 4
      WHEN 'billing' THEN 5
      WHEN 'readonly' THEN 6
      ELSE 7
    END
  LIMIT 1;

  IF v_role IS NOT NULL THEN
    RETURN v_role;
  END IF;

  -- Check account_members table
  SELECT am.role INTO v_role
  FROM public.account_members am
  WHERE am.user_id = p_user_id
  ORDER BY
    CASE am.role
      WHEN 'owner' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'member' THEN 3
      ELSE 4
    END
  LIMIT 1;

  IF v_role IS NOT NULL THEN
    RETURN v_role;
  END IF;

  -- Default to 'user' role
  RETURN 'user';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to get user's account_id
CREATE OR REPLACE FUNCTION public.get_user_account_id(p_user_id uuid)
RETURNS uuid AS $$
DECLARE
  v_account_id uuid;
BEGIN
  -- Get from profiles table first
  SELECT account_id INTO v_account_id
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_account_id IS NOT NULL THEN
    RETURN v_account_id;
  END IF;

  -- Fallback to account_members
  SELECT account_id INTO v_account_id
  FROM public.account_members
  WHERE user_id = p_user_id
  LIMIT 1;

  RETURN v_account_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to set custom JWT claims
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_role text;
  v_account_id uuid;
  v_email_verified boolean;
  v_requires_2fa boolean;
  v_last_2fa_at timestamptz;
BEGIN
  -- Extract user ID from event
  v_user_id := (event->>'user_id')::uuid;

  -- Get user's role
  v_role := public.get_user_primary_role(v_user_id);

  -- Get user's account_id
  v_account_id := public.get_user_account_id(v_user_id);

  -- Get 2FA status
  SELECT email_verified, requires_2fa, last_2fa_at
  INTO v_email_verified, v_requires_2fa, v_last_2fa_at
  FROM public.profiles
  WHERE id = v_user_id;

  -- Add custom claims to the JWT
  event := jsonb_set(event, '{claims,app_metadata}',
    jsonb_build_object(
      'role', COALESCE(v_role, 'user'),
      'account_id', v_account_id,
      'email_verified', COALESCE(v_email_verified, false),
      'requires_2fa', COALESCE(v_requires_2fa, false),
      'last_2fa_at', v_last_2fa_at
    )
  );

  RETURN event;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user has role
CREATE OR REPLACE FUNCTION public.has_role(p_user_id uuid, p_role text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.staff_roles
    WHERE user_id = p_user_id AND role = p_role
  ) OR EXISTS (
    SELECT 1 FROM public.account_members
    WHERE user_id = p_user_id AND role = p_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper function to check if user has any of the roles
CREATE OR REPLACE FUNCTION public.has_any_role(p_user_id uuid, p_roles text[])
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.staff_roles
    WHERE user_id = p_user_id AND role = ANY(p_roles)
  ) OR EXISTS (
    SELECT 1 FROM public.account_members
    WHERE user_id = p_user_id AND role = ANY(p_roles)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper function to check account access
CREATE OR REPLACE FUNCTION public.has_account_access(p_user_id uuid, p_account_id uuid)
RETURNS boolean AS $$
BEGIN
  -- Check if user is staff (staff can access multiple accounts)
  IF EXISTS (
    SELECT 1 FROM public.staff_roles
    WHERE user_id = p_user_id AND role IN ('admin', 'support', 'sales')
  ) THEN
    RETURN true;
  END IF;

  -- Check if user belongs to the account
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id AND account_id = p_account_id
  ) OR EXISTS (
    SELECT 1 FROM public.account_members
    WHERE user_id = p_user_id AND account_id = p_account_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to refresh user's JWT claims (call after role changes)
CREATE OR REPLACE FUNCTION public.refresh_user_jwt(p_user_id uuid)
RETURNS void AS $$
BEGIN
  -- This will be called after role changes to force JWT refresh on next request
  -- The actual JWT refresh happens client-side by calling supabase.auth.refreshSession()
  PERFORM public.log_auth_event(
    p_user_id,
    public.get_user_account_id(p_user_id),
    'jwt_refresh_requested',
    jsonb_build_object('reason', 'role_change')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment on profiles
COMMENT ON COLUMN public.profiles.totp_secret IS 'Encrypted TOTP secret for 2FA';
COMMENT ON COLUMN public.profiles.totp_enabled IS 'Whether 2FA via TOTP is enabled';
COMMENT ON COLUMN public.profiles.totp_backup_codes IS 'Array of hashed backup codes';
COMMENT ON COLUMN public.profiles.requires_2fa IS 'Whether user is required to use 2FA (staff)';
COMMENT ON COLUMN public.profiles.last_2fa_at IS 'Last time user completed 2FA challenge';
COMMENT ON COLUMN public.profiles.last_step_up_at IS 'Last time user completed step-up auth';
COMMENT ON COLUMN public.profiles.email_verified IS 'Whether email is verified';
COMMENT ON COLUMN public.profiles.recovery_email IS 'Recovery email for account recovery';

-- =====================================================
-- MIGRATION 20: 20251108000003_enhanced_rls_policies.sql
-- =====================================================

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
    AND role IN ('admin', 'support', 'sales')
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
    AND role IN ('admin', 'support', 'billing')
  )
  OR
  -- Sales reps can view their assigned accounts
  EXISTS (
    SELECT 1 FROM public.staff_roles sr
    JOIN public.profiles p ON p.id = sr.user_id
    WHERE sr.user_id = auth.uid()
    AND sr.role = 'sales'
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
    WHERE user_id = auth.uid() AND role = 'admin'
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
    WHERE user_id = auth.uid() AND role = 'admin'
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
    AND role IN ('admin', 'support', 'sales')
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
    WHERE user_id = auth.uid() AND role = 'admin'
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
    WHERE user_id = auth.uid() AND role = 'admin'
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
    AND role IN ('admin', 'support')
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
    WHERE user_id = auth.uid() AND role = 'admin'
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
    WHERE user_id = auth.uid() AND role = 'admin'
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
    AND role IN ('admin', 'support')
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
    WHERE user_id = auth.uid() AND role = 'admin'
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
    WHERE user_id = auth.uid() AND role = 'admin'
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
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can manage staff roles"
ON public.staff_roles FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.staff_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.staff_roles
    WHERE user_id = auth.uid() AND role = 'admin'
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
        AND role IN ('admin', 'support', 'billing')
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

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
