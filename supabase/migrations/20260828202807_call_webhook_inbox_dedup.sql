-- Migration: Dedup key for call_webhook_inbox
-- Purpose: Prevent duplicate/replayed Vapi webhook deliveries from writing
-- repeated inbox rows for the same (provider, call, message type). Without
-- this, a retry storm on an unmapped number fills the inbox with dozens of
-- near-identical rows per call.

ALTER TABLE public.call_webhook_inbox
  ADD COLUMN IF NOT EXISTS message_type TEXT;

-- Unique on the natural dedup key. This must be a plain (non-partial) index:
-- supabase-js's upsert(..., { onConflict }) sends only the column list to
-- Postgres's ON CONFLICT, and Postgres can only use a partial unique index as
-- a conflict arbiter if the statement repeats its WHERE predicate verbatim --
-- which supabase-js does not do. A plain unique index still gets the dedup
-- behavior we want for free: Postgres unique indexes never treat two NULLs as
-- equal, so rows with a NULL provider_call_id or message_type (e.g. malformed
-- payloads with no call id) never collide and are always kept.
CREATE UNIQUE INDEX IF NOT EXISTS idx_call_webhook_inbox_dedup
  ON public.call_webhook_inbox(provider, provider_call_id, message_type, reason);
