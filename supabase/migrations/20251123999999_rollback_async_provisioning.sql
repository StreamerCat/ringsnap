-- Rollback Migration: Async Provisioning & Idempotency
-- Purpose: Revert all changes from async provisioning refactor
-- Date: 2025-11-23
-- Agent: @schema-migration-agent
--
-- USAGE: Only run this if you need to rollback the async provisioning changes
-- WARNING: This will drop idempotency_results and stripe_events tables

-- ==============================================================================
-- Rollback Part 3: stripe_events table
-- ==============================================================================

-- Drop functions
DROP FUNCTION IF EXISTS public.cleanup_old_stripe_events();
DROP FUNCTION IF EXISTS public.mark_stripe_event_processed(TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS public.record_stripe_event(TEXT, TEXT, JSONB, TEXT, TEXT);

-- Drop table
DROP TABLE IF EXISTS public.stripe_events CASCADE;

-- ==============================================================================
-- Rollback Part 2: provisioning timestamps
-- ==============================================================================

-- Drop helper function
DROP FUNCTION IF EXISTS public.update_provisioning_lifecycle(UUID, TEXT, TEXT);

-- Remove columns from provisioning_jobs
ALTER TABLE public.provisioning_jobs
  DROP COLUMN IF EXISTS metadata,
  DROP COLUMN IF EXISTS correlation_id;

-- Remove columns from accounts
ALTER TABLE public.accounts
  DROP COLUMN IF EXISTS provisioning_started_at,
  DROP COLUMN IF EXISTS provisioning_completed_at,
  DROP COLUMN IF EXISTS provisioning_error;

-- ==============================================================================
-- Rollback Part 1: idempotency_results table
-- ==============================================================================

-- Drop cleanup function
DROP FUNCTION IF EXISTS public.cleanup_expired_idempotency_results();

-- Drop table
DROP TABLE IF EXISTS public.idempotency_results CASCADE;

-- ==============================================================================
-- Notification
-- ==============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Async provisioning rollback completed. Dropped idempotency_results, stripe_events tables and related functions.';
END $$;
