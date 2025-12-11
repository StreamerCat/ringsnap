
-- Relax constraint on account_id to allow tracking pre-signup events
ALTER TABLE public.analytics_events ALTER COLUMN account_id DROP NOT NULL;

-- Create index on email metadata for finding failed signups
CREATE INDEX IF NOT EXISTS idx_analytics_events_metadata_email ON public.analytics_events((metadata->>'email'));
