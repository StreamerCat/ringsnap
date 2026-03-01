-- Migration: Create resource_subscriber_leads table for Field Guide downloads
-- This table captures leads from the resource download modal
CREATE TABLE IF NOT EXISTS public.resource_subscriber_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Lead information
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    resource_name TEXT NOT NULL,
    trade TEXT,
    -- 'HVAC', 'Plumbing', etc
    -- Tracking
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);
-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_res_leads_email ON public.resource_subscriber_leads(email);
CREATE INDEX IF NOT EXISTS idx_res_leads_created_at ON public.resource_subscriber_leads(created_at DESC);
-- Enable RLS
ALTER TABLE public.resource_subscriber_leads ENABLE ROW LEVEL SECURITY;
-- RLS Policies
-- Allow anyone to INSERT (anonymous lead capture)
CREATE POLICY "Anyone can insert resource leads" ON public.resource_subscriber_leads FOR
INSERT WITH CHECK (true);
-- Only service role can SELECT/UPDATE/DELETE (full access)
CREATE POLICY "Service role can do everything on resource leads" ON public.resource_subscriber_leads FOR ALL TO service_role USING (true) WITH CHECK (true);
-- Allow staff to view leads
CREATE POLICY "Staff can view resource leads" ON public.resource_subscriber_leads FOR
SELECT TO authenticated USING (
        EXISTS (
            SELECT 1
            FROM public.staff_roles
            WHERE user_id = auth.uid()
        )
    );
-- Function to handle updated_at
CREATE TRIGGER update_resource_subscriber_leads_updated_at BEFORE
UPDATE ON public.resource_subscriber_leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- Comments
COMMENT ON TABLE public.resource_subscriber_leads IS 'Captures leads from the Field Guide resource download modal';
COMMENT ON COLUMN public.resource_subscriber_leads.email IS 'Lead email address';
COMMENT ON COLUMN public.resource_subscriber_leads.full_name IS 'Lead full name from form';
COMMENT ON COLUMN public.resource_subscriber_leads.resource_name IS 'Specific resource being downloaded';
COMMENT ON COLUMN public.resource_subscriber_leads.trade IS 'Target trade of the lead';
COMMENT ON COLUMN public.resource_subscriber_leads.metadata IS 'Additional tracking data (UTMs, etc)';