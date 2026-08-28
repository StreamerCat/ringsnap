-- Migration: Dedup key for call_webhook_inbox
-- Purpose: Prevent duplicate/replayed Vapi webhook deliveries from writing
-- repeated inbox rows for the same (provider, call, message type). Without
-- this, a retry storm on an unmapped number fills the inbox with dozens of
-- near-identical rows per call.

ALTER TABLE public.call_webhook_inbox
  ADD COLUMN IF NOT EXISTS message_type TEXT;

-- Unique on the natural dedup key. NULLs in provider_call_id or message_type
-- (e.g. malformed payloads with no call id) are not deduped -- each such row
-- is kept for debugging.
CREATE UNIQUE INDEX IF NOT EXISTS idx_call_webhook_inbox_dedup
  ON public.call_webhook_inbox(provider, provider_call_id, message_type, reason)
  WHERE provider_call_id IS NOT NULL AND message_type IS NOT NULL;
