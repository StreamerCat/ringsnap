-- Migration: Idempotency Results Table
-- Purpose: Enable idempotent create-trial API requests
-- Date: 2025-11-23
-- Agent: @schema-migration-agent

-- ==============================================================================
-- PART 1: Create idempotency_results table
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.idempotency_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Idempotency key (from request header)
  idempotency_key TEXT NOT NULL UNIQUE,

  -- Request fingerprint
  request_hash TEXT NOT NULL,
  request_path TEXT NOT NULL,

  -- Response stored for replay
  status_code INTEGER NOT NULL,
  response_body JSONB NOT NULL,
  response_headers JSONB DEFAULT '{}'::JSONB,

  -- Linked resources created
  account_id UUID,
  user_id UUID,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,

  -- Request metadata
  correlation_id TEXT,
  source_ip TEXT,
  user_agent TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours')
);

-- ==============================================================================
-- PART 2: Create indexes for efficient lookups
-- ==============================================================================

-- Primary lookup index (most common query)
CREATE INDEX idx_idempotency_results_key
  ON public.idempotency_results(idempotency_key);

-- Cleanup index for expired results (removed invalid STABLE predicate)
-- Note: now() is STABLE, not IMMUTABLE, so cannot be used in index WHERE clause
DROP INDEX IF EXISTS public.idx_idempotency_results_expires;
CREATE INDEX IF NOT EXISTS idx_idempotency_results_expires_at
  ON public.idempotency_results(expires_at)
  WHERE expires_at IS NOT NULL;

-- Correlation tracking index
CREATE INDEX idx_idempotency_results_correlation
  ON public.idempotency_results(correlation_id)
  WHERE correlation_id IS NOT NULL;

-- Resource lookup indexes
CREATE INDEX idx_idempotency_results_account
  ON public.idempotency_results(account_id)
  WHERE account_id IS NOT NULL;

-- ==============================================================================
-- PART 3: Add table documentation
-- ==============================================================================

COMMENT ON TABLE public.idempotency_results IS
  'Stores idempotency keys and cached responses for create-trial API requests. Results expire after 24 hours and are automatically cleaned up.';

COMMENT ON COLUMN public.idempotency_results.idempotency_key IS
  'Unique client-provided key from Idempotency-Key header';

COMMENT ON COLUMN public.idempotency_results.request_hash IS
  'SHA-256 hash of normalized request body for duplicate detection';

COMMENT ON COLUMN public.idempotency_results.response_body IS
  'Cached API response to replay for duplicate requests';

COMMENT ON COLUMN public.idempotency_results.expires_at IS
  'Timestamp when this result expires (24 hours from creation)';

-- ==============================================================================
-- PART 4: Cleanup function for expired results
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_idempotency_results()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.idempotency_results
  WHERE expires_at < now();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.cleanup_expired_idempotency_results IS
  'Removes expired idempotency results (older than 24 hours). Run daily via cron.';

-- ==============================================================================
-- PART 5: RLS Policies (disable - service role only)
-- ==============================================================================

ALTER TABLE public.idempotency_results ENABLE ROW LEVEL SECURITY;

-- Service role only (edge functions)
CREATE POLICY idempotency_results_service_all
  ON public.idempotency_results
  FOR ALL
  USING (auth.role() = 'service_role');

-- ==============================================================================
-- PART 6: Grant permissions
-- ==============================================================================

GRANT SELECT, INSERT, UPDATE ON public.idempotency_results TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_idempotency_results TO service_role;
