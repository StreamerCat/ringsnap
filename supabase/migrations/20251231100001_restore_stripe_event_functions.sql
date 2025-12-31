-- Migration: Restore Stripe Event Functions
-- Purpose: Re-create functions dropped by rollback migration that are still in use
-- Date: 2025-12-31
-- Agent: @schema-migration-agent
--
-- These functions were dropped by 20251123999999_rollback_async_provisioning.sql
-- but are still called in stripe-webhook/index.ts (lines 411 and 835).
-- This migration restores them with proper security.
-- ==============================================================================
-- PART 1: Create stripe_events table if not exists
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.stripe_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Stripe event data
    stripe_event_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    event_data JSONB NOT NULL,
    -- Processing status
    processed BOOLEAN NOT NULL DEFAULT false,
    processed_at TIMESTAMPTZ,
    processing_error TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    -- Related resources
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    stripe_invoice_id TEXT,
    account_id UUID,
    -- Metadata
    correlation_id TEXT,
    api_version TEXT,
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    stripe_created_at TIMESTAMPTZ
);
-- ==============================================================================
-- PART 2: Create indexes if not exist
-- ==============================================================================
-- Primary lookup for duplicate detection
CREATE UNIQUE INDEX IF NOT EXISTS idx_stripe_events_event_id ON public.stripe_events(stripe_event_id);
-- Process unprocessed events
CREATE INDEX IF NOT EXISTS idx_stripe_events_unprocessed ON public.stripe_events(processed, created_at)
WHERE processed = false;
-- Lookup by event type
CREATE INDEX IF NOT EXISTS idx_stripe_events_type ON public.stripe_events(event_type, created_at);
-- Lookup by customer
CREATE INDEX IF NOT EXISTS idx_stripe_events_customer ON public.stripe_events(stripe_customer_id)
WHERE stripe_customer_id IS NOT NULL;
-- Account linkage
CREATE INDEX IF NOT EXISTS idx_stripe_events_account ON public.stripe_events(account_id)
WHERE account_id IS NOT NULL;
-- ==============================================================================
-- PART 3: Re-create record_stripe_event function
-- Records a Stripe webhook event. Returns true if duplicate, false if new.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.record_stripe_event(
        p_stripe_event_id TEXT,
        p_event_type TEXT,
        p_event_data JSONB,
        p_stripe_customer_id TEXT DEFAULT NULL,
        p_correlation_id TEXT DEFAULT NULL
    ) RETURNS BOOLEAN AS $$
DECLARE v_is_duplicate BOOLEAN;
BEGIN -- Try to insert the event
BEGIN
INSERT INTO public.stripe_events (
        stripe_event_id,
        event_type,
        event_data,
        stripe_customer_id,
        correlation_id,
        stripe_created_at
    )
VALUES (
        p_stripe_event_id,
        p_event_type,
        p_event_data,
        p_stripe_customer_id,
        p_correlation_id,
        to_timestamp((p_event_data->>'created')::bigint)
    );
-- Successfully inserted (new event)
RETURN false;
EXCEPTION
WHEN unique_violation THEN -- Event already exists (duplicate)
RETURN true;
END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
COMMENT ON FUNCTION public.record_stripe_event IS 'Records a Stripe webhook event. Returns true if duplicate, false if new.';
-- ==============================================================================
-- PART 4: Re-create mark_stripe_event_processed function
-- Marks a Stripe event as processed (success) or failed (with error)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.mark_stripe_event_processed(
        p_stripe_event_id TEXT,
        p_account_id UUID DEFAULT NULL,
        p_error TEXT DEFAULT NULL
    ) RETURNS VOID AS $$ BEGIN IF p_error IS NULL THEN -- Success
UPDATE public.stripe_events
SET processed = true,
    processed_at = now(),
    account_id = COALESCE(p_account_id, account_id),
    processing_error = NULL
WHERE stripe_event_id = p_stripe_event_id;
ELSE -- Failed
UPDATE public.stripe_events
SET processed = false,
    retry_count = retry_count + 1,
    processing_error = p_error,
    account_id = COALESCE(p_account_id, account_id)
WHERE stripe_event_id = p_stripe_event_id;
END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
COMMENT ON FUNCTION public.mark_stripe_event_processed IS 'Marks a Stripe event as processed (success) or failed (with error)';
-- ==============================================================================
-- PART 5: Enable RLS
-- ==============================================================================
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
-- Drop policy if exists to allow re-running migration
DROP POLICY IF EXISTS stripe_events_service_all ON public.stripe_events;
CREATE POLICY stripe_events_service_all ON public.stripe_events FOR ALL USING (auth.role() = 'service_role');
-- ==============================================================================
-- PART 6: Grant permissions (service_role ONLY)
-- Revoke from PUBLIC to ensure only service_role can access
-- ==============================================================================
-- Revoke any existing permissions from public
REVOKE ALL ON public.stripe_events
FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_stripe_event
FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_stripe_event_processed
FROM PUBLIC;
-- Grant to service_role only
GRANT SELECT,
    INSERT,
    UPDATE ON public.stripe_events TO service_role;
GRANT EXECUTE ON FUNCTION public.record_stripe_event TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_stripe_event_processed TO service_role;
-- ==============================================================================
-- PART 7: Notification
-- ==============================================================================
DO $$ BEGIN RAISE NOTICE 'Successfully restored stripe_events table and RPC functions (record_stripe_event, mark_stripe_event_processed). Permissions locked to service_role only.';
END $$;