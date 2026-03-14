-- ============================================================================
-- Migration: Create posthog_signals table + FK on crew_events
-- Version: 20260313000002
-- Purpose: Durable queue between PostHog workflow webhooks and CrewAI.
--          PostHog workflows POST to /functions/v1/posthog-signal which inserts
--          here. CrewAI polls this table (max every 15 minutes) and routes to
--          the appropriate crew based on crew_target.
--
-- Status lifecycle:
--   pending → processing (when signal consumer picks it up)
--   processing → completed (after crew_event finishes successfully)
--   processing → failed (on error; surfaced in Command Center alerts)
--
-- Dedup: dedup_key = signal_type || ':' || coalesce(entity_id, '')
--        The posthog-signal Edge Function checks for same dedup_key within
--        the last 30 minutes before inserting.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.posthog_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  signal_type text NOT NULL,
  entity_id text,
  entity_type text,
  payload jsonb NOT NULL DEFAULT '{}',
  crew_target text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  processed_at timestamptz,
  crew_event_id uuid REFERENCES public.crew_events(id),
  -- Generated dedup key — signal_type + ':' + entity_id (or just signal_type if no entity)
  dedup_key text GENERATED ALWAYS AS (
    signal_type || ':' || coalesce(entity_id, '')
  ) STORED
);

-- Indexes for signal consumer polling and dedup checks
CREATE INDEX IF NOT EXISTS idx_posthog_signals_status ON public.posthog_signals(status, created_at);
CREATE INDEX IF NOT EXISTS idx_posthog_signals_dedup ON public.posthog_signals(dedup_key, created_at);
CREATE INDEX IF NOT EXISTS idx_posthog_signals_signal_type ON public.posthog_signals(signal_type, created_at);

-- FK from crew_events.signal_id → posthog_signals.id
-- Added here since posthog_signals now exists
ALTER TABLE public.crew_events
  ADD CONSTRAINT IF NOT EXISTS fk_crew_events_signal_id
  FOREIGN KEY (signal_id) REFERENCES public.posthog_signals(id);

-- RLS: service role INSERT/UPDATE from Edge Function and signal consumer
--      No direct authenticated user access needed (admin uses service role)
ALTER TABLE public.posthog_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to posthog_signals"
  ON public.posthog_signals
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.posthog_signals IS
  'Durable signal queue between PostHog workflows and CrewAI. '
  'PostHog workflow webhooks POST to /functions/v1/posthog-signal which inserts here. '
  'CrewAI polls this table max every 15 minutes. '
  'Phase 1 workflows: checkout_failed_spike, onboarding_stalled, lead_gone_cold, '
  'conversion_rate_anomaly, high_cogs_pattern. All inactive until PostHog UI configured.';
