-- Migration: Create call_webhook_inbox for dead letter storage
-- Purpose: Store failed webhook events for debugging and replay

CREATE TABLE IF NOT EXISTS public.call_webhook_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at TIMESTAMPTZ DEFAULT now(),
  provider TEXT DEFAULT 'vapi',
  provider_call_id TEXT,
  provider_phone_number_id TEXT,
  reason TEXT NOT NULL,
  payload JSONB NOT NULL,
  error TEXT,
  resolved BOOLEAN DEFAULT false
);

-- Index for finding unresolved items quickly
CREATE INDEX IF NOT EXISTS idx_call_webhook_inbox_unresolved 
  ON public.call_webhook_inbox(resolved, received_at DESC) 
  WHERE resolved = false;

-- Index for looking up by call id
CREATE INDEX IF NOT EXISTS idx_call_webhook_inbox_call_id
  ON public.call_webhook_inbox(provider_call_id)
  WHERE provider_call_id IS NOT NULL;

-- RLS disabled for service role access (webhooks use service key)
ALTER TABLE public.call_webhook_inbox ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access to inbox"
  ON public.call_webhook_inbox
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.call_webhook_inbox IS 
  'Dead letter queue for failed Vapi webhook events. Check here when calls are not appearing in call_logs.';
