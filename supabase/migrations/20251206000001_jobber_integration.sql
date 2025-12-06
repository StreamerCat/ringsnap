/*
  # Jobber Integration Schema

  1. New Tables
    - `call_outcome_events`
      - Stores call metadata, outcome classification, and summary.
      - RLS: Account-scoped.
    - `jobber_connections`
      - Stores OAuth tokens for Jobber integration per account.
      - RLS: Account-scoped.
    - `jobber_sync_logs`
      - Audit log for sync operations between RingSnap and Jobber.
      - RLS: Account-scoped.

  2. Security
    - Enable RLS on all new tables.
    - Add policies for authenticated users to view/insert/update rows belonging to their account (via `auth.uid()` -> `profile` -> `account_id` check or similar existing patterns).
*/

-- 1. Call Outcome Events
CREATE TABLE IF NOT EXISTS public.call_outcome_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL,
  from_number text NOT NULL,
  to_number text NOT NULL,
  contact_name text,
  contact_phone text NOT NULL,
  contact_email text,
  source text NOT NULL CHECK (source IN ('inbound', 'outbound')),
  outcome text NOT NULL CHECK (outcome IN ('new_lead', 'existing_customer', 'missed_call', 'quote_requested', 'booking_created')),
  summary text NOT NULL,
  transcript_url text,
  recording_url text,
  tags text[] DEFAULT '{}'::text[],
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.call_outcome_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view call_outcome_events for their account"
  ON public.call_outcome_events
  FOR SELECT
  USING (
    account_id IN (
      SELECT account_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert call_outcome_events for their account"
  ON public.call_outcome_events
  FOR INSERT
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- 2. Jobber Connections
-- Stores tokens. access_token and refresh_token should ideally be encrypted, 
-- but for MVP reusing the pattern of existing tables (or text if no standard encryption helper is available in SQL).
-- Assuming 'text' for now as per spec instructions to follow repo patterns (if encryption is not strictly enforced in DB layer).
CREATE TABLE IF NOT EXISTS public.jobber_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(account_id)
);

ALTER TABLE public.jobber_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view jobber_connections for their account"
  ON public.jobber_connections
  FOR SELECT
  USING (
    account_id IN (
      SELECT account_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can upsert jobber_connections for their account"
  ON public.jobber_connections
  FOR INSERT
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Allow updates
CREATE POLICY "Users can update jobber_connections for their account"
  ON public.jobber_connections
  FOR UPDATE
  USING (
    account_id IN (
      SELECT account_id FROM public.profiles WHERE id = auth.uid()
    )
  );
  
-- Allow delete
CREATE POLICY "Users can delete jobber_connections for their account"
  ON public.jobber_connections
  FOR DELETE
  USING (
    account_id IN (
      SELECT account_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- 3. Jobber Sync Logs
CREATE TABLE IF NOT EXISTS public.jobber_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  call_event_id uuid REFERENCES public.call_outcome_events(id) ON DELETE SET NULL,
  operation_type text NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'error')),
  error_message text,
  external_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.jobber_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view jobber_sync_logs for their account"
  ON public.jobber_sync_logs
  FOR SELECT
  USING (
    account_id IN (
      SELECT account_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert jobber_sync_logs for their account"
  ON public.jobber_sync_logs
  FOR INSERT
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Indexes for performance
CREATE INDEX idx_call_outcome_events_account_id ON public.call_outcome_events(account_id);
CREATE INDEX idx_call_outcome_events_outcome ON public.call_outcome_events(outcome);
CREATE INDEX idx_jobber_connections_account_id ON public.jobber_connections(account_id);
CREATE INDEX idx_jobber_sync_logs_account_id ON public.jobber_sync_logs(account_id);
CREATE INDEX idx_jobber_sync_logs_event_id ON public.jobber_sync_logs(call_event_id);
