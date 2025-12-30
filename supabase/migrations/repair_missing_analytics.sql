-- DATA REPAIR SCRIPT: Missing Analytics Tables
-- This script reconstructs the analytics system tables that appear to be missing from your DB.
-- It combines logic from migrations 20251211150000, 20251211160000, and 20251211163000.
-- 1. Ensure `call_outcome_events` exists (it seems to be missing too)
CREATE TABLE IF NOT EXISTS public.call_outcome_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  call_log_id uuid,
  -- Optional FK to call_logs
  outcome text,
  occurred_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);
-- Index for call_outcome_events
CREATE INDEX IF NOT EXISTS idx_call_outcome_events_account_id ON public.call_outcome_events(account_id);
CREATE INDEX IF NOT EXISTS idx_call_outcome_events_occurred_at ON public.call_outcome_events(occurred_at);
-- 2. Ensure `analytics_events` exists
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE
  SET NULL,
    event_type text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);
-- Enable RLS
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
-- 3. Policies for `analytics_events` (Drop first to avoid errors)
DROP POLICY IF EXISTS "Users can view analytics_events for their account" ON public.analytics_events;
DROP POLICY IF EXISTS "Users can insert analytics_events for their account" ON public.analytics_events;
CREATE POLICY "Users can view analytics_events for their account" ON public.analytics_events FOR
SELECT USING (
    account_id IN (
      SELECT account_id
      FROM public.profiles
      WHERE id = auth.uid()
    )
  );
CREATE POLICY "Users can insert analytics_events for their account" ON public.analytics_events FOR
INSERT WITH CHECK (
    account_id IN (
      SELECT account_id
      FROM public.profiles
      WHERE id = auth.uid()
    )
  );
-- Indexes for `analytics_events`
CREATE INDEX IF NOT EXISTS idx_analytics_events_account_id ON public.analytics_events(account_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON public.analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON public.analytics_events(created_at);
-- 4. Apply Schema Modifications (duration_seconds)
DO $$ BEGIN IF NOT EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_name = 'call_outcome_events'
    AND column_name = 'duration_seconds'
) THEN
ALTER TABLE public.call_outcome_events
ADD COLUMN duration_seconds integer;
END IF;
END $$;
-- 5. Recreate View `daily_account_usage`
DROP VIEW IF EXISTS public.daily_account_usage;
CREATE OR REPLACE VIEW public.daily_account_usage AS
SELECT account_id,
  date_trunc('day', occurred_at) as date,
  count(*) as total_calls,
  coalesce(sum(duration_seconds), 0) / 60 as total_minutes,
  count(*) filter (
    where outcomes.outcome = 'new_lead'
  ) as total_leads
FROM public.call_outcome_events outcomes
GROUP BY 1,
  2;
GRANT SELECT ON public.daily_account_usage TO authenticated;