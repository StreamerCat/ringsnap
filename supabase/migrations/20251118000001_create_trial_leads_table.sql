-- Create trial_leads table to capture partial signups
-- This captures leads even if they abandon the signup flow after Step 1

CREATE TABLE IF NOT EXISTS public.trial_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Contact info (captured in Step 1)
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,

  -- Tracking info
  source TEXT DEFAULT 'website',
  step_reached TEXT DEFAULT 'contact_info',
  ip_address TEXT,

  -- Conversion tracking
  converted_to_trial BOOLEAN DEFAULT FALSE,
  converted_at TIMESTAMPTZ,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_trial_leads_email ON public.trial_leads(email);
CREATE INDEX IF NOT EXISTS idx_trial_leads_created_at ON public.trial_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trial_leads_converted ON public.trial_leads(converted_to_trial);

-- Add RLS policies
ALTER TABLE public.trial_leads ENABLE ROW LEVEL SECURITY;

-- Only admins can view trial leads
CREATE POLICY "Admins can view trial leads"
  ON public.trial_leads
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Service role can insert leads (from edge function)
CREATE POLICY "Service role can insert leads"
  ON public.trial_leads
  FOR INSERT
  WITH CHECK (true);

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_trial_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trial_leads_updated_at
  BEFORE UPDATE ON public.trial_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_trial_leads_updated_at();

-- Add comment
COMMENT ON TABLE public.trial_leads IS 'Captures partial trial signups to track conversion funnel and re-engage abandoners';
