-- ============================================================================
-- Migration: Add step tracking columns to signup_leads
-- Version: 20251230000002
-- Purpose: Support GTM observability - track signup progression
-- ============================================================================

-- Add last_step column to track how far user got in signup
ALTER TABLE signup_leads ADD COLUMN IF NOT EXISTS last_step integer;

-- Add trace_id column for request correlation
ALTER TABLE signup_leads ADD COLUMN IF NOT EXISTS trace_id text;

-- Add index for querying by trace_id
CREATE INDEX IF NOT EXISTS idx_signup_leads_trace_id ON signup_leads(trace_id) WHERE trace_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN signup_leads.last_step IS 'Last signup step completed (1=email, 2=phone, 3=company, etc.)';
COMMENT ON COLUMN signup_leads.trace_id IS 'Trace ID for correlating with system_events and Sentry';
