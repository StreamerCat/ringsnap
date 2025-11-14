-- Adds partial/composite indexes for active (unused/unexpired) tokens to speed lookups and token consumption.
-- Run this migration after the main auth_tokens migration.

-- Index to quickly find active tokens by email & type (used for "resend", cleanup, and server-side checks)
CREATE INDEX IF NOT EXISTS idx_auth_tokens_email_type_active
  ON public.auth_tokens (email, token_type)
  WHERE used_at IS NULL;

-- Index to efficiently search for tokens by expiry (for cleanup jobs)
CREATE INDEX IF NOT EXISTS idx_auth_tokens_expires_at_active
  ON public.auth_tokens (expires_at)
  WHERE used_at IS NULL;