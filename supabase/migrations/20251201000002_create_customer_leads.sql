-- Migration: Create customer_leads table
-- Stores leads captured from incoming phone calls via Vapi

CREATE TABLE IF NOT EXISTS public.customer_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Account relationship (multi-tenancy)
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,

  -- Call relationship (optional - lead might come from other sources later)
  call_id TEXT, -- References usage_logs.call_id
  usage_log_id UUID, -- References usage_logs.id if we add it

  -- Customer information
  customer_name TEXT,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,

  -- Lead classification
  lead_source TEXT NOT NULL DEFAULT 'phone_call'
    CHECK (lead_source IN ('phone_call', 'web_form', 'sms', 'email', 'other')),

  lead_status TEXT NOT NULL DEFAULT 'new'
    CHECK (lead_status IN ('new', 'contacted', 'qualified', 'converted', 'lost', 'spam')),

  intent TEXT
    CHECK (intent IN ('appointment', 'quote', 'question', 'complaint', 'other', 'unknown')),

  -- Call/interaction details
  call_summary TEXT,
  call_transcript TEXT,
  call_duration_seconds INTEGER,

  -- Business context
  job_type TEXT,
  job_description TEXT,
  urgency TEXT CHECK (urgency IN ('low', 'medium', 'high', 'emergency')),

  -- Appointment link (if booking was requested)
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,

  -- Tracking
  last_contacted_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_leads_account_id
  ON public.customer_leads(account_id);

CREATE INDEX IF NOT EXISTS idx_customer_leads_call_id
  ON public.customer_leads(call_id)
  WHERE call_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customer_leads_customer_phone
  ON public.customer_leads(customer_phone);

CREATE INDEX IF NOT EXISTS idx_customer_leads_created_at
  ON public.customer_leads(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_leads_lead_status
  ON public.customer_leads(account_id, lead_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_leads_intent
  ON public.customer_leads(account_id, intent)
  WHERE intent IS NOT NULL;

-- Enable RLS (multi-tenancy)
ALTER TABLE public.customer_leads ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Service role can do everything
CREATE POLICY "Service role full access"
  ON public.customer_leads
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can only see leads for their account
CREATE POLICY "Users can view their account leads"
  ON public.customer_leads
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid()
    )
  );

-- Authenticated users can insert leads for their account
CREATE POLICY "Users can create leads for their account"
  ON public.customer_leads
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid()
    )
  );

-- Authenticated users can update leads for their account
CREATE POLICY "Users can update their account leads"
  ON public.customer_leads
  FOR UPDATE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid()
    )
  );

-- Staff can view all leads
CREATE POLICY "Staff can view all leads"
  ON public.customer_leads
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_roles
      WHERE user_id = auth.uid()
    )
  );

-- Updated at trigger
CREATE TRIGGER update_customer_leads_updated_at
  BEFORE UPDATE ON public.customer_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE public.customer_leads IS 'Leads captured from phone calls and other customer interactions';
COMMENT ON COLUMN public.customer_leads.account_id IS 'Which business account this lead belongs to';
COMMENT ON COLUMN public.customer_leads.call_id IS 'Vapi call ID if lead came from a phone call';
COMMENT ON COLUMN public.customer_leads.customer_phone IS 'Customer phone number';
COMMENT ON COLUMN public.customer_leads.lead_source IS 'Where the lead came from (phone_call, web_form, etc)';
COMMENT ON COLUMN public.customer_leads.lead_status IS 'Current status of the lead (new, contacted, qualified, etc)';
COMMENT ON COLUMN public.customer_leads.intent IS 'What the customer wanted (appointment, quote, question, etc)';
COMMENT ON COLUMN public.customer_leads.call_summary IS 'AI-generated summary of the call';
COMMENT ON COLUMN public.customer_leads.appointment_id IS 'Linked appointment if booking was made';
