-- Migration: Hybrid Onboarding Schema
-- Purpose: Add support for new onboarding flow with booking preferences
--          and calendar integration readiness
-- Date: 2025-11-25

-- ==============================================================================
-- PART 1: Extend accounts table for booking and assistant configuration
-- ==============================================================================

-- Add booking-related columns
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS booking_mode TEXT DEFAULT 'sms_only'
    CHECK (booking_mode IN ('sms_only', 'direct_calendar')),
  ADD COLUMN IF NOT EXISTS default_appointment_duration_minutes INTEGER DEFAULT 60,
  ADD COLUMN IF NOT EXISTS calendar_provider TEXT
    CHECK (calendar_provider IN ('google', 'microsoft', 'apple', 'external_link', NULL)),
  ADD COLUMN IF NOT EXISTS calendar_external_link TEXT;

-- Add assistant personality columns
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS assistant_tone TEXT DEFAULT 'friendly'
    CHECK (assistant_tone IN ('formal', 'friendly', 'casual')),
  ADD COLUMN IF NOT EXISTS call_priority TEXT[] DEFAULT ARRAY['everything'];

-- Add destination phone for call routing
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS destination_phone TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.accounts.booking_mode IS 'How appointments are booked: sms_only (manual confirmation) or direct_calendar (automated)';
COMMENT ON COLUMN public.accounts.default_appointment_duration_minutes IS 'Default appointment duration in minutes (e.g., 30, 60)';
COMMENT ON COLUMN public.accounts.calendar_provider IS 'Calendar provider for direct booking: google, microsoft, apple, or external_link';
COMMENT ON COLUMN public.accounts.calendar_external_link IS 'External calendar booking link (e.g., Calendly URL) for Phase 2 integration';
COMMENT ON COLUMN public.accounts.assistant_tone IS 'Assistant personality: formal, friendly, or casual';
COMMENT ON COLUMN public.accounts.call_priority IS 'Array of call priority categories: new_leads, existing_customers, emergencies, everything';
COMMENT ON COLUMN public.accounts.destination_phone IS 'Phone number to route calls to (normalized format)';

-- ==============================================================================
-- PART 2: Extend profiles table for onboarding status
-- ==============================================================================

-- Add onboarding status column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_status TEXT DEFAULT 'not_started'
    CHECK (onboarding_status IN (
      'not_started',
      'collecting',
      'ready_to_provision',
      'provisioning',
      'active',
      'provision_failed'
    ));

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.onboarding_status IS 'User onboarding state: not_started, collecting, ready_to_provision, provisioning, active, provision_failed';

-- ==============================================================================
-- PART 3: Create appointments table for booking requests
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Account reference
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,

  -- Customer information
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,

  -- Appointment details
  job_type TEXT,
  job_description TEXT,
  preferred_time_range TEXT,
  confirmed_time TIMESTAMPTZ,

  -- Status tracking
  status TEXT DEFAULT 'pending_confirmation'
    CHECK (status IN (
      'pending_confirmation',
      'confirmed',
      'rescheduled',
      'cancelled',
      'completed'
    )),

  -- Booking method
  booking_source TEXT DEFAULT 'phone_call'
    CHECK (booking_source IN ('phone_call', 'sms', 'web_form', 'calendar_direct')),

  -- Notes and metadata
  internal_notes TEXT,
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_appointments_account_id
  ON public.appointments(account_id);

CREATE INDEX IF NOT EXISTS idx_appointments_status
  ON public.appointments(status);

CREATE INDEX IF NOT EXISTS idx_appointments_confirmed_time
  ON public.appointments(confirmed_time)
  WHERE confirmed_time IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_created_at
  ON public.appointments(created_at DESC);

-- Add updated_at trigger
CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add table comment
COMMENT ON TABLE public.appointments IS 'Appointment booking requests from customers, supporting both SMS confirmation and future direct calendar booking';

-- ==============================================================================
-- PART 4: Create service_hours helper view (optional convenience)
-- ==============================================================================

-- This view provides a structured view of business hours for easy querying
CREATE OR REPLACE VIEW public.account_service_hours AS
SELECT
  a.id AS account_id,
  a.company_name,
  a.business_hours,
  a.booking_mode,
  a.default_appointment_duration_minutes,
  a.destination_phone
FROM public.accounts a
WHERE a.business_hours IS NOT NULL;

COMMENT ON VIEW public.account_service_hours IS 'Convenience view for querying account service hours and booking configuration';

-- ==============================================================================
-- PART 5: Update create_account_transaction RPC to accept new fields (optional)
-- ==============================================================================

-- Note: This is a reminder to update the create_account_transaction function
-- to accept and populate the new fields. The function signature should remain
-- backward compatible by making these fields optional in p_account_data JSONB.

-- The following fields can now be included in p_account_data:
-- - booking_mode
-- - default_appointment_duration_minutes
-- - calendar_provider
-- - calendar_external_link
-- - assistant_tone
-- - call_priority
-- - destination_phone
-- - onboarding_status (for profiles)

-- ==============================================================================
-- PART 6: Enable RLS for appointments table
-- ==============================================================================

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Users can view appointments for their account
CREATE POLICY "Users can view appointments in their account"
  ON public.appointments FOR SELECT
  TO authenticated
  USING (account_id = public.get_user_account_id(auth.uid()));

-- Users can insert appointments for their account
CREATE POLICY "Users can create appointments for their account"
  ON public.appointments FOR INSERT
  TO authenticated
  WITH CHECK (account_id = public.get_user_account_id(auth.uid()));

-- Owners and admins can update appointments
CREATE POLICY "Owners and admins can update appointments"
  ON public.appointments FOR UPDATE
  TO authenticated
  USING (
    account_id = public.get_user_account_id(auth.uid())
    AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'))
  );

-- Service role can do everything (for edge functions)
CREATE POLICY "Service role full access to appointments"
  ON public.appointments FOR ALL
  TO service_role
  USING (true);

-- ==============================================================================
-- PART 7: Create helper function for validating service hours
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.is_within_service_hours(
  p_account_id UUID,
  p_check_time TIMESTAMPTZ
) RETURNS BOOLEAN AS $$
DECLARE
  v_business_hours JSONB;
  v_day_of_week TEXT;
  v_hours_for_day JSONB;
BEGIN
  -- Get business hours for account
  SELECT business_hours INTO v_business_hours
  FROM public.accounts
  WHERE id = p_account_id;

  -- If no business hours configured, return true (always available)
  IF v_business_hours IS NULL OR v_business_hours = '{}'::jsonb THEN
    RETURN true;
  END IF;

  -- Get day of week (lowercase)
  v_day_of_week := lower(to_char(p_check_time, 'Day'));
  v_day_of_week := trim(v_day_of_week);

  -- Check if hours exist for this day
  v_hours_for_day := v_business_hours->v_day_of_week;

  IF v_hours_for_day IS NULL THEN
    RETURN false; -- Not open this day
  END IF;

  -- TODO: Add time range validation when standardizing business_hours format
  -- For now, just return true if the day exists in business_hours
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.is_within_service_hours IS 'Check if a given time falls within the account''s configured service hours';

-- ==============================================================================
-- PART 8: Grant permissions
-- ==============================================================================

GRANT SELECT, INSERT, UPDATE ON public.appointments TO service_role;
-- GRANT USAGE ON SEQUENCE public.appointments_id_seq TO service_role; -- Removed: ID is UUID, no sequence exists

GRANT SELECT ON public.account_service_hours TO authenticated;

-- ==============================================================================
-- Migration complete
-- ==============================================================================
