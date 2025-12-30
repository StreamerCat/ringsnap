-- Migration: Fix appointments table for call_log linking
-- Description: Adds call_log_id column with unique constraint to enable proper
-- linking between call_logs and appointments, fixing the "booked calls but no appointments" issue.
-- 
-- Root cause: vapi-webhook was trying to upsert with onConflict: 'call_log_id' 
-- but this column didn't exist.
-- 1. Add call_log_id column (if not exists) with unique constraint
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS call_log_id UUID UNIQUE;
-- 2. Add foreign key constraint (separate statement for safety)
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'appointments_call_log_id_fkey'
        AND table_name = 'appointments'
) THEN
ALTER TABLE public.appointments
ADD CONSTRAINT appointments_call_log_id_fkey FOREIGN KEY (call_log_id) REFERENCES public.call_logs(id) ON DELETE
SET NULL;
END IF;
END $$;
-- 3. Add source column to track where appointment came from
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
-- 4. Add window_description for free-text time descriptions
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS window_description TEXT;
-- 5. Add index for call_log_id lookups
CREATE INDEX IF NOT EXISTS idx_appointments_call_log_id ON public.appointments(call_log_id)
WHERE call_log_id IS NOT NULL;
-- 6. Add composite index for efficient dashboard queries
CREATE INDEX IF NOT EXISTS idx_appointments_account_scheduled ON public.appointments(account_id, scheduled_start_at DESC);
-- 7. Update status check constraint to include new status values
-- Drop and recreate the constraint if it exists
DO $$ BEGIN -- Check if old constraint exists and drop it
IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'appointments_status_check'
        AND table_name = 'appointments'
) THEN
ALTER TABLE public.appointments DROP CONSTRAINT appointments_status_check;
END IF;
-- Add updated constraint (includes both old and new status values)
ALTER TABLE public.appointments
ADD CONSTRAINT appointments_status_check CHECK (
        status IN (
            -- New standard values
            'scheduled',
            'confirmed',
            'rescheduled',
            'canceled',
            'cancelled',
            -- Support both spellings
            'completed',
            -- Legacy values (from original schema)
            'pending_confirmation'
        )
    );
EXCEPTION
WHEN others THEN -- Constraint might not exist, which is fine
NULL;
END $$;
-- 8. Comment on new columns
COMMENT ON COLUMN public.appointments.call_log_id IS 'Link to the call_logs entry that created this appointment (for Vapi calls)';
COMMENT ON COLUMN public.appointments.source IS 'Source of appointment creation: vapi_call, manual, calendar, etc.';
COMMENT ON COLUMN public.appointments.window_description IS 'Free-text description of appointment time window when exact time unknown (e.g., "Thursday afternoon")';
-- Migration complete