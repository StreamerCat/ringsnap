-- ============================================================================
-- Migration: Create crew_events table
-- Version: 20260313000001
-- Purpose: Records CrewAI crew execution outcomes. Part of PostHog → CrewAI
--          signal bridge layer. Linked to posthog_signals via signal_id FK
--          (FK constraint added in next migration after posthog_signals exists).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.crew_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  crew_target text NOT NULL,
  input_payload jsonb NOT NULL DEFAULT '{}',
  output_payload jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  account_id uuid,
  -- signal_id references posthog_signals; FK added in 20260313000002
  signal_id uuid
);

-- Indexes for signal consumer polling and reporting
CREATE INDEX IF NOT EXISTS idx_crew_events_status ON public.crew_events(status, created_at);
CREATE INDEX IF NOT EXISTS idx_crew_events_crew_target ON public.crew_events(crew_target, created_at);
CREATE INDEX IF NOT EXISTS idx_crew_events_signal_id ON public.crew_events(signal_id);

-- RLS: service role has full access; no direct user access needed
ALTER TABLE public.crew_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to crew_events"
  ON public.crew_events
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.crew_events IS
  'Records CrewAI crew execution outcomes triggered by PostHog signals. '
  'Status lifecycle: pending → running → completed | failed. '
  'Linked to posthog_signals via signal_id. Part of PostHog/CrewAI bridge.';
