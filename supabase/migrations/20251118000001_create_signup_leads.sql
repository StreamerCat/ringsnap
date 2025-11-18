-- Migration: Create signup_leads table for step 1 lead capture
-- This table captures lead information before full signup completion

CREATE TABLE IF NOT EXISTS public.signup_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Lead information from step 1
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  source TEXT, -- 'homepage', 'sales', etc
  signup_flow TEXT, -- 'trial', 'sales-team', etc

  -- Linking to completed signup (set after successful signup)
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  profile_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Tracking
  completed_at TIMESTAMPTZ,
  ip_address INET,
  user_agent TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_signup_leads_email ON public.signup_leads(email);
CREATE INDEX IF NOT EXISTS idx_signup_leads_created_at ON public.signup_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signup_leads_account_id ON public.signup_leads(account_id) WHERE account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_signup_leads_auth_user_id ON public.signup_leads(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.signup_leads ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow anonymous users to INSERT (for step 1 lead capture)
CREATE POLICY "Anonymous users can insert leads"
  ON public.signup_leads
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow authenticated users to INSERT
CREATE POLICY "Authenticated users can insert leads"
  ON public.signup_leads
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Only authenticated users can SELECT their own leads
CREATE POLICY "Users can view their own leads"
  ON public.signup_leads
  FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

-- Staff can view all leads
CREATE POLICY "Staff can view all leads"
  ON public.signup_leads
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_roles
      WHERE user_id = auth.uid()
    )
  );

-- Service role can do everything
CREATE POLICY "Service role can do everything"
  ON public.signup_leads
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Comments
COMMENT ON TABLE public.signup_leads IS 'Captures lead information from step 1 of signup flows before full account creation';
COMMENT ON COLUMN public.signup_leads.email IS 'Lead email address';
COMMENT ON COLUMN public.signup_leads.full_name IS 'Lead full name from form';
COMMENT ON COLUMN public.signup_leads.phone IS 'Lead phone number';
COMMENT ON COLUMN public.signup_leads.source IS 'Where the lead came from (homepage, sales, etc)';
COMMENT ON COLUMN public.signup_leads.signup_flow IS 'Which signup flow they used (trial, sales-team, etc)';
COMMENT ON COLUMN public.signup_leads.auth_user_id IS 'Linked auth user ID after signup completes';
COMMENT ON COLUMN public.signup_leads.account_id IS 'Linked account ID after signup completes';
COMMENT ON COLUMN public.signup_leads.profile_id IS 'Linked profile ID after signup completes';
COMMENT ON COLUMN public.signup_leads.completed_at IS 'When the lead converted to a full signup';

-- Updated at trigger
CREATE TRIGGER update_signup_leads_updated_at
  BEFORE UPDATE ON public.signup_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
