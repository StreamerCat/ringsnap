-- ============================================================================
-- Migration: Create system_events table for structured observability
-- Version: 20251230000001
-- Purpose: Store structured events from edge functions for debugging and monitoring
-- ============================================================================

-- Create the system_events table
-- Note: No FK constraints on user_id/account_id to avoid insert failures
-- UUIDs are stored as text for maximum flexibility
CREATE TABLE IF NOT EXISTS system_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  trace_id text NOT NULL,
  event_name text NOT NULL,
  level text NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error')),
  email text,
  user_id uuid,  -- No FK constraint - just store the UUID
  account_id uuid,  -- No FK constraint - just store the UUID
  error_code text,
  error_message text,
  metadata jsonb
);

-- Add helpful comments
COMMENT ON TABLE system_events IS 'Structured observability events from edge functions. Retention: 30-60 days.';
COMMENT ON COLUMN system_events.trace_id IS 'Correlation ID for tracing requests across services';
COMMENT ON COLUMN system_events.event_name IS 'Event name in format: function_name.event_type';
COMMENT ON COLUMN system_events.level IS 'Log level: debug, info, warn, error';
COMMENT ON COLUMN system_events.error_code IS 'Structured error code for categorization';
COMMENT ON COLUMN system_events.metadata IS 'Additional event context (sanitized, max 4KB)';

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_system_events_trace_id ON system_events(trace_id);
CREATE INDEX IF NOT EXISTS idx_system_events_created_at ON system_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_events_account_id ON system_events(account_id) WHERE account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_system_events_level_errors ON system_events(level, created_at DESC) WHERE level IN ('warn', 'error');
CREATE INDEX IF NOT EXISTS idx_system_events_event_name ON system_events(event_name);

-- Enable RLS (service role bypasses by default)
ALTER TABLE system_events ENABLE ROW LEVEL SECURITY;

-- Optional: Allow account owners to read their own warn/error events
-- Using EXISTS-based policy to avoid RLS recursion issues
CREATE POLICY "account_read_own_warn_error" ON system_events
  FOR SELECT TO authenticated
  USING (
    level IN ('warn', 'error')
    AND account_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.account_id = system_events.account_id
    )
  );

-- ============================================================================
-- RETENTION PLAN (to be implemented separately)
-- ============================================================================
-- Target retention: 30-60 days
-- Implementation options:
-- 1. pg_cron job (if available): DELETE FROM system_events WHERE created_at < now() - interval '60 days';
-- 2. Scheduled edge function calling cleanup RPC
-- 3. Manual periodic cleanup
--
-- Example cleanup function:
-- CREATE OR REPLACE FUNCTION cleanup_old_system_events(retention_days integer DEFAULT 60)
-- RETURNS integer AS $$
-- DECLARE
--   deleted_count integer;
-- BEGIN
--   DELETE FROM system_events WHERE created_at < now() - (retention_days || ' days')::interval;
--   GET DIAGNOSTICS deleted_count = ROW_COUNT;
--   RETURN deleted_count;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;
-- ============================================================================
