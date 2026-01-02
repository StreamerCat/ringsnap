-- Migration: Stripe Webhook Event Tracking
-- Purpose: Enable idempotent webhook processing and event replay protection
-- Date: 2025-11-23
-- Agent: @schema-migration-agent

-- ==============================================================================
-- PART 1: Create stripe_events table
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
-- PART 2: Create indexes for efficient lookups
-- ==============================================================================

-- Primary lookup for duplicate detection
CREATE UNIQUE INDEX idx_stripe_events_event_id
  ON public.stripe_events(stripe_event_id);

-- Process unprocessed events
CREATE INDEX idx_stripe_events_unprocessed
  ON public.stripe_events(processed, created_at)
  WHERE processed = false;

-- Lookup by event type
CREATE INDEX idx_stripe_events_type
  ON public.stripe_events(event_type, created_at);

-- Lookup by customer
CREATE INDEX idx_stripe_events_customer
  ON public.stripe_events(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- Correlation tracking
CREATE INDEX idx_stripe_events_correlation
  ON public.stripe_events(correlation_id)
  WHERE correlation_id IS NOT NULL;

-- Account linkage
CREATE INDEX idx_stripe_events_account
  ON public.stripe_events(account_id)
  WHERE account_id IS NOT NULL;

-- ==============================================================================
-- PART 3: Add table documentation
-- ==============================================================================

COMMENT ON TABLE public.stripe_events IS
  'Stores all Stripe webhook events for idempotent processing and audit trail. Duplicate events are detected via stripe_event_id uniqueness constraint.';

COMMENT ON COLUMN public.stripe_events.stripe_event_id IS
  'Unique Stripe event ID (e.g., evt_xxxxx) for duplicate detection';

COMMENT ON COLUMN public.stripe_events.event_type IS
  'Stripe event type (e.g., invoice.paid, customer.subscription.updated)';

COMMENT ON COLUMN public.stripe_events.event_data IS
  'Full Stripe event payload for audit and replay';

COMMENT ON COLUMN public.stripe_events.processed IS
  'Whether this event has been successfully processed';

COMMENT ON COLUMN public.stripe_events.retry_count IS
  'Number of processing attempts (for failed events)';

-- ==============================================================================
-- PART 4: Helper function to record and check event
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.record_stripe_event(
  p_stripe_event_id TEXT,
  p_event_type TEXT,
  p_event_data JSONB,
  p_stripe_customer_id TEXT DEFAULT NULL,
  p_correlation_id TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_is_duplicate BOOLEAN;
BEGIN
  -- Try to insert the event
  BEGIN
    INSERT INTO public.stripe_events (
      stripe_event_id,
      event_type,
      event_data,
      stripe_customer_id,
      correlation_id,
      stripe_created_at
    ) VALUES (
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
    WHEN unique_violation THEN
      -- Event already exists (duplicate)
      RETURN true;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.record_stripe_event IS
  'Records a Stripe webhook event. Returns true if duplicate, false if new.';

-- ==============================================================================
-- PART 5: Function to mark event as processed
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.mark_stripe_event_processed(
  p_stripe_event_id TEXT,
  p_account_id UUID DEFAULT NULL,
  p_error TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  IF p_error IS NULL THEN
    -- Success
    UPDATE public.stripe_events
    SET
      processed = true,
      processed_at = now(),
      account_id = COALESCE(p_account_id, account_id),
      processing_error = NULL
    WHERE stripe_event_id = p_stripe_event_id;
  ELSE
    -- Failed
    UPDATE public.stripe_events
    SET
      processed = false,
      retry_count = retry_count + 1,
      processing_error = p_error,
      account_id = COALESCE(p_account_id, account_id)
    WHERE stripe_event_id = p_stripe_event_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.mark_stripe_event_processed IS
  'Marks a Stripe event as processed (success) or failed (with error)';

-- ==============================================================================
-- PART 6: Cleanup function for old processed events
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_old_stripe_events()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Keep processed events for 90 days, failed events for 30 days
  DELETE FROM public.stripe_events
  WHERE (processed = true AND processed_at < now() - INTERVAL '90 days')
     OR (processed = false AND created_at < now() - INTERVAL '30 days');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.cleanup_old_stripe_events IS
  'Removes old Stripe events (processed >90 days, failed >30 days). Run monthly via cron.';

-- ==============================================================================
-- PART 7: RLS Policies (service role only)
-- ==============================================================================

ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY stripe_events_service_all
  ON public.stripe_events
  FOR ALL
  USING (auth.role() = 'service_role');

-- ==============================================================================
-- PART 8: Grant permissions
-- ==============================================================================

GRANT SELECT, INSERT, UPDATE ON public.stripe_events TO service_role;
GRANT EXECUTE ON FUNCTION public.record_stripe_event TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_stripe_event_processed TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_stripe_events TO service_role;
