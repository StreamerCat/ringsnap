-- Migration: Repair production schema
-- ID: 20251218000001_repair_prod_schema.sql
-- Description: Creates missing schema objects (customer_leads, appointments.urgency, operator views) that are likely missing in production.

-- 1. Add urgency to appointments (referenced by dashboard views)
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS urgency TEXT 
CHECK (urgency IN ('low', 'medium', 'high', 'emergency'));

-- 2. Create customer_leads table (referenced by dashboard views)
CREATE TABLE IF NOT EXISTS public.customer_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Account relationship
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  
  -- Call context
  call_id TEXT,
  usage_log_id UUID,
  
  -- Customer info
  customer_name TEXT,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  
  -- Classification
  lead_source TEXT NOT NULL DEFAULT 'phone_call' 
    CHECK (lead_source IN ('phone_call', 'web_form', 'sms', 'email', 'other')),
  lead_status TEXT NOT NULL DEFAULT 'new' 
    CHECK (lead_status IN ('new', 'contacted', 'qualified', 'converted', 'lost', 'spam')),
  intent TEXT 
    CHECK (intent IN ('appointment', 'quote', 'question', 'complaint', 'other', 'unknown')),
  
  -- Details
  call_summary TEXT,
  call_transcript TEXT,
  call_duration_seconds INTEGER,
  job_type TEXT,
  job_description TEXT,
  urgency TEXT CHECK (urgency IN ('low', 'medium', 'high', 'emergency')),
  
  -- Links
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  
  -- Tracking
  last_contacted_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for customer_leads
CREATE INDEX IF NOT EXISTS idx_customer_leads_account_id ON public.customer_leads(account_id);
CREATE INDEX IF NOT EXISTS idx_customer_leads_created_at ON public.customer_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_leads_lead_status ON public.customer_leads(account_id, lead_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_leads_customer_phone ON public.customer_leads(customer_phone);

-- Enable RLS for customer_leads
ALTER TABLE public.customer_leads ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies for customer_leads
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customer_leads' AND policyname = 'Service role full access') THEN
    CREATE POLICY "Service role full access" ON public.customer_leads FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customer_leads' AND policyname = 'Users can view their account leads') THEN
    CREATE POLICY "Users can view their account leads" ON public.customer_leads FOR SELECT TO authenticated USING (
      account_id IN (SELECT account_id FROM public.account_members WHERE user_id = auth.uid())
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customer_leads' AND policyname = 'Users can create leads for their account') THEN
    CREATE POLICY "Users can create leads for their account" ON public.customer_leads FOR INSERT TO authenticated WITH CHECK (
      account_id IN (SELECT account_id FROM public.account_members WHERE user_id = auth.uid())
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customer_leads' AND policyname = 'Users can update their account leads') THEN
    CREATE POLICY "Users can update their account leads" ON public.customer_leads FOR UPDATE TO authenticated USING (
      account_id IN (SELECT account_id FROM public.account_members WHERE user_id = auth.uid())
    ) WITH CHECK (
      account_id IN (SELECT account_id FROM public.account_members WHERE user_id = auth.uid())
    );
  END IF;
END $$;

-- 3. Create Dashboard Views

-- View: Calls today by account
CREATE OR REPLACE VIEW public.operator_calls_today AS
SELECT
  account_id,
  COUNT(*) as calls_count,
  SUM(duration_seconds) as total_duration_seconds,
  SUM(cost) as total_cost_cents,
  ROUND(AVG(duration_seconds)) as avg_duration_seconds,
  MAX(started_at) as last_call_at
FROM public.call_logs
WHERE started_at >= CURRENT_DATE
  AND started_at < CURRENT_DATE + INTERVAL '1 day'
GROUP BY account_id;

-- View: Leads today by account
CREATE OR REPLACE VIEW public.operator_leads_today AS
SELECT
  account_id,
  COUNT(*) as leads_count,
  COUNT(*) FILTER (WHERE lead_status = 'new') as new_count,
  COUNT(*) FILTER (WHERE lead_status = 'contacted') as contacted_count,
  COUNT(*) FILTER (WHERE intent = 'appointment') as appointment_intent_count,
  COUNT(*) FILTER (WHERE intent = 'quote') as quote_intent_count,
  COUNT(*) FILTER (WHERE urgency = 'emergency') as emergency_count,
  COUNT(*) FILTER (WHERE urgency = 'high') as high_urgency_count,
  MAX(created_at) as last_lead_at
FROM public.customer_leads
WHERE created_at >= CURRENT_DATE
  AND created_at < CURRENT_DATE + INTERVAL '1 day'
GROUP BY account_id;

-- View: Pending appointments by account
CREATE OR REPLACE VIEW public.operator_pending_appointments AS
SELECT
  account_id,
  COUNT(*) as pending_count,
  COUNT(*) FILTER (WHERE urgency = 'emergency') as emergency_count,
  COUNT(*) FILTER (WHERE urgency = 'high') as high_urgency_count,
  MIN(created_at) as oldest_pending_at,
  MAX(created_at) as newest_pending_at
FROM public.appointments
WHERE status = 'pending_confirmation'
GROUP BY account_id;

-- Combined operator dashboard view
CREATE OR REPLACE VIEW public.operator_dashboard_summary AS
SELECT
  a.id as account_id,
  a.company_name,
  a.trade,
  COALESCE(c.calls_count, 0) as calls_today,
  COALESCE(c.total_duration_seconds, 0) as call_duration_seconds_today,
  COALESCE(l.leads_count, 0) as leads_today,
  COALESCE(l.new_count, 0) as new_leads_today,
  COALESCE(l.appointment_intent_count, 0) as appointment_requests_today,
  COALESCE(l.emergency_count, 0) as emergency_leads_today,
  COALESCE(p.pending_count, 0) as pending_appointments,
  COALESCE(p.emergency_count, 0) as emergency_appointments,
  c.last_call_at,
  l.last_lead_at,
  p.oldest_pending_at,
  p.newest_pending_at
FROM public.accounts a
LEFT JOIN public.operator_calls_today c ON c.account_id = a.id
LEFT JOIN public.operator_leads_today l ON l.account_id = a.id
LEFT JOIN public.operator_pending_appointments p ON p.account_id = a.id;

-- Grant permissions on views
ALTER VIEW public.operator_calls_today OWNER TO postgres;
ALTER VIEW public.operator_leads_today OWNER TO postgres;
ALTER VIEW public.operator_pending_appointments OWNER TO postgres;
ALTER VIEW public.operator_dashboard_summary OWNER TO postgres;

GRANT SELECT ON public.operator_calls_today TO authenticated;
GRANT SELECT ON public.operator_leads_today TO authenticated;
GRANT SELECT ON public.operator_pending_appointments TO authenticated;
GRANT SELECT ON public.operator_dashboard_summary TO authenticated;
