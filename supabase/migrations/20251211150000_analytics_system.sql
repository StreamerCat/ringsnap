/*
  # Analytics System Schema

  1. New Tables
    - `analytics_events`
      - Stores generic lifecycle events (signup, provisioning, etc.)
      - RLS: Account-scoped (viewable by account users)
  
  2. Modifications
    - `call_outcome_events`
      - Add `duration_seconds` (integer, nullable)

  3. Views
    - `daily_account_usage`
      - Aggregates calls, minutes, leads by account/day
*/

-- 1. Analytics Events Table
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view analytics_events for their account"
  ON public.analytics_events
  FOR SELECT
  USING (
    account_id IN (
      SELECT account_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert analytics_events for their account"
  ON public.analytics_events
  FOR INSERT
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Index for querying
CREATE INDEX idx_analytics_events_account_id ON public.analytics_events(account_id);
CREATE INDEX idx_analytics_events_event_type ON public.analytics_events(event_type);
CREATE INDEX idx_analytics_events_created_at ON public.analytics_events(created_at);

-- 2. Modify Call Outcome Events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'call_outcome_events'
    AND column_name = 'duration_seconds'
  ) THEN
    ALTER TABLE public.call_outcome_events ADD COLUMN duration_seconds integer;
  END IF;
END $$;

-- 3. Daily Usage View
CREATE OR REPLACE VIEW public.daily_account_usage AS
SELECT
  account_id,
  date_trunc('day', occurred_at) as date,
  count(*) as total_calls,
  coalesce(sum(duration_seconds), 0) / 60 as total_minutes,
  count(*) filter (where outcomes.outcome = 'new_lead') as total_leads
FROM public.call_outcome_events outcomes
GROUP BY 1, 2;

-- Grant access to authenticated users (so they can query this view via postgrest)
GRANT SELECT ON public.daily_account_usage TO authenticated;
