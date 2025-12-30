-- Migration: Phase 1 Appointment Conflict Prevention
-- Description: Adds indexes and constraints to support efficient conflict detection
-- Date: 2025-12-30
-- 1. Index for efficient overlap queries
-- This index supports the conflict check query pattern:
-- WHERE account_id = X AND status IN ('scheduled', 'confirmed', 'rescheduled')
-- AND scheduled_start_at >= window_start AND scheduled_start_at < window_end
CREATE INDEX IF NOT EXISTS idx_appointments_conflict_check ON public.appointments(account_id, status, scheduled_start_at)
WHERE status IN ('scheduled', 'confirmed', 'rescheduled');
-- 2. Composite index for availability queries (day-based)
-- Supports queries that filter by account and status, then range on start time
CREATE INDEX IF NOT EXISTS idx_appointments_availability ON public.appointments(account_id, scheduled_start_at)
WHERE status IN ('scheduled', 'confirmed', 'rescheduled');
-- 3. Add 'confirmed' status to valid statuses if not already present
-- The existing CHECK constraint only allows: 'scheduled', 'canceled', 'rescheduled', 'completed'
-- We need to add 'confirmed' for appointments that have been confirmed by the customer
DO $$ BEGIN -- Drop existing constraint and recreate with additional status
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE public.appointments
ADD CONSTRAINT appointments_status_check CHECK (
        status IN (
            'scheduled',
            -- Initial booking
            'confirmed',
            -- Customer confirmed
            'canceled',
            -- Canceled by customer or business
            'rescheduled',
            -- Time changed (old appointment)
            'completed',
            -- Service was performed
            'no_show' -- Customer didn't show up
        )
    );
EXCEPTION
WHEN duplicate_object THEN NULL;
WHEN others THEN RAISE NOTICE 'Could not update status constraint: %',
SQLERRM;
END $$;
-- 4. Add comment documenting the conflict detection logic
COMMENT ON INDEX idx_appointments_conflict_check IS 'Partial index for efficient conflict detection. Used by availability service to find overlapping appointments.';
COMMENT ON INDEX idx_appointments_availability IS 'Index for availability queries. Supports day-based slot generation excluding booked times.';
-- Note: We considered adding a partial unique constraint on (account_id, scheduled_start_at)
-- for active statuses, but this could break if:
-- a) Appointments at the same time exist from different sources (e.g., call + manual)
-- b) Very short appointments or different service types could legitimately overlap
-- 
-- Instead, we enforce uniqueness in application code with the conflict check,
-- which gives us flexibility to handle edge cases gracefully.