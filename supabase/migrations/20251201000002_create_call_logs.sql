-- Migration: Create call_logs table
-- Purpose: Provider-agnostic call logging for RingSnap accounts
-- Date: 2025-12-01
-- Agent: @schema-migration-agent
--
-- IMPORTANT: This migration MUST run before 20251201000003_operator_dashboard_views.sql
-- because the views reference public.call_logs

-- ==============================================================================
-- PART 1: Create call_logs table
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  phone_number_id UUID REFERENCES public.phone_numbers(id) ON DELETE SET NULL,

  -- Provider Info
  provider TEXT NOT NULL DEFAULT 'vapi',
  provider_call_id TEXT, -- Twilio Call SID or Vapi Call ID
  vapi_call_id TEXT,     -- Specific Vapi ID if available

  -- Call Details
  direction TEXT CHECK (direction IN ('inbound', 'outbound')),
  from_number TEXT,
  to_number TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  status TEXT, -- 'completed', 'failed', 'busy', 'no-answer'

  -- Data
  recording_url TEXT,
  transcript TEXT,
  summary TEXT,
  cost NUMERIC(10, 4),

  -- Tech
  raw_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==============================================================================
-- PART 2: Create indexes for efficient lookups
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_call_logs_account_id
  ON public.call_logs(account_id);

CREATE INDEX IF NOT EXISTS idx_call_logs_phone_id
  ON public.call_logs(phone_number_id);

CREATE INDEX IF NOT EXISTS idx_call_logs_provider_id
  ON public.call_logs(provider, provider_call_id);

CREATE INDEX IF NOT EXISTS idx_call_logs_started_at
  ON public.call_logs(account_id, started_at DESC);

-- ==============================================================================
-- PART 3: Enable RLS and create policies
-- ==============================================================================

ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can view call logs" ON public.call_logs;

CREATE POLICY "Account members can view call logs"
  ON public.call_logs FOR SELECT
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid()
    )
  );

-- ==============================================================================
-- PART 4: Add trigger for updated_at timestamp
-- ==============================================================================

DROP TRIGGER IF EXISTS update_call_logs_updated_at ON public.call_logs;

CREATE TRIGGER update_call_logs_updated_at
  BEFORE UPDATE ON public.call_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ==============================================================================
-- PART 5: Add table documentation
-- ==============================================================================

COMMENT ON TABLE public.call_logs IS
  'Provider-agnostic call logs for RingSnap accounts. Stores call records from Vapi, Twilio, or other telephony providers.';

COMMENT ON COLUMN public.call_logs.provider IS
  'Telephony provider (e.g., vapi, twilio)';

COMMENT ON COLUMN public.call_logs.provider_call_id IS
  'Provider-specific call identifier (Twilio Call SID or Vapi Call ID)';

COMMENT ON COLUMN public.call_logs.cost IS
  'Call cost in cents (stored as numeric for precision)';
