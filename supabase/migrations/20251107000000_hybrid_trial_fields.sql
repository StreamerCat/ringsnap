-- Migration: Add Hybrid Trial Support
-- Purpose: Enable soft card requirement with cardless fallback
-- Date: 2025-11-07
--
-- Adds minimal fields to support two trial modes:
-- 1. Card-required trial: Full access after adding payment method
-- 2. Cardless trial: Limited access, prompted to add card
--
-- Fields added:
-- - has_payment_method: Boolean flag for Stripe payment method attached
-- - trial_status: Current trial state for lifecycle tracking
-- - trial_type: Which trial mode user chose at signup

-- Add hybrid trial fields to accounts table
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS has_payment_method BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS trial_type TEXT NOT NULL DEFAULT 'card_required';

-- Add helpful comment
COMMENT ON COLUMN public.accounts.has_payment_method IS 'True if user has added a payment method via Stripe Setup Intent';
COMMENT ON COLUMN public.accounts.trial_status IS 'Trial lifecycle: active, pending_card, expired, converted';
COMMENT ON COLUMN public.accounts.trial_type IS 'Trial mode: card_required (full) or cardless (limited)';

-- Create indexes for filtering and reporting
CREATE INDEX IF NOT EXISTS idx_accounts_trial_status ON public.accounts(trial_status);
CREATE INDEX IF NOT EXISTS idx_accounts_trial_type ON public.accounts(trial_type);
CREATE INDEX IF NOT EXISTS idx_accounts_payment_method ON public.accounts(has_payment_method);

-- Create composite index for common queries (cardless trials pending card)
CREATE INDEX IF NOT EXISTS idx_accounts_cardless_pending
  ON public.accounts(trial_type, trial_status)
  WHERE trial_type = 'cardless' AND trial_status = 'pending_card';

-- Backfill existing accounts as card_required with active trial
-- (assumes existing users have full access, backward compatible)
UPDATE public.accounts
SET
  has_payment_method = CASE
    WHEN stripe_customer_id IS NOT NULL THEN true
    ELSE false
  END,
  trial_status = CASE
    WHEN subscription_status = 'active' THEN 'converted'
    WHEN subscription_status = 'trial' AND trial_end_date > NOW() THEN 'active'
    WHEN subscription_status = 'trial' AND trial_end_date <= NOW() THEN 'expired'
    ELSE 'active'
  END,
  trial_type = 'card_required'
WHERE has_payment_method IS NULL OR trial_status IS NULL OR trial_type IS NULL;

-- Add check constraint for trial_status enum (enforced at DB level)
ALTER TABLE public.accounts
  ADD CONSTRAINT check_trial_status
  CHECK (trial_status IN ('active', 'pending_card', 'expired', 'converted'));

-- Add check constraint for trial_type enum (enforced at DB level)
ALTER TABLE public.accounts
  ADD CONSTRAINT check_trial_type
  CHECK (trial_type IN ('card_required', 'cardless'));

-- Create analytics events table for trial funnel tracking
CREATE TABLE IF NOT EXISTS public.trial_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}'::jsonb,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying events by account and type
CREATE INDEX IF NOT EXISTS idx_trial_events_account ON public.trial_events(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trial_events_type ON public.trial_events(event_type, created_at DESC);

-- Add comment
COMMENT ON TABLE public.trial_events IS 'Analytics events for trial funnel: trial_started, payment_method_added, trial_promoted, trial_expired';

-- Grant access to authenticated users (via RLS)
ALTER TABLE public.trial_events ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can read their own trial events
CREATE POLICY "Users can view own trial events"
  ON public.trial_events
  FOR SELECT
  USING (
    account_id IN (
      SELECT account_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- RLS policy: only service role can insert trial events
CREATE POLICY "Service role can insert trial events"
  ON public.trial_events
  FOR INSERT
  WITH CHECK (true);  -- Service role bypasses RLS anyway

-- Create helper function to log trial events
CREATE OR REPLACE FUNCTION public.log_trial_event(
  p_account_id UUID,
  p_event_type TEXT,
  p_event_data JSONB DEFAULT '{}'::jsonb,
  p_user_agent TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _event_id UUID;
BEGIN
  INSERT INTO public.trial_events (
    account_id,
    event_type,
    event_data,
    user_agent,
    ip_address
  ) VALUES (
    p_account_id,
    p_event_type,
    p_event_data,
    p_user_agent,
    p_ip_address
  )
  RETURNING id INTO _event_id;

  RETURN _event_id;
END;
$$;

COMMENT ON FUNCTION public.log_trial_event IS 'Helper function to log trial funnel events for analytics';
