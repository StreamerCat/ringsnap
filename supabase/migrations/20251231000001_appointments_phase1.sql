-- Migration: Appointments System Phase 1
-- Description: Adds appointments table and notification settings to accounts
-- Depends on: existing accounts table structure
-- 1. Add Notification Settings to Accounts
-- NOTE: We reuse existing columns: sms_enabled, sms_appointment_confirmations, sms_reminders
-- We DO NOT add notify_contractor_sms (redundant)
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS notification_sms_phone TEXT,
    ADD COLUMN IF NOT EXISTS notification_email TEXT,
    ADD COLUMN IF NOT EXISTS notify_contractor_email BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS notify_caller_sms BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS notify_caller_email BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Denver';
-- Default per user request
-- 2. Create Appointments Table
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    assistant_id UUID REFERENCES public.assistants(id),
    -- Optional link to assistant if known
    -- Vapi Call Integration (Idempotency Key)
    vapi_call_id TEXT NOT NULL,
    -- Caller Info
    caller_name TEXT NOT NULL,
    caller_phone TEXT NOT NULL,
    caller_email TEXT,
    -- Scheduling Details
    scheduled_start_at TIMESTAMPTZ NOT NULL,
    scheduled_end_at TIMESTAMPTZ,
    time_zone TEXT NOT NULL DEFAULT 'America/Denver',
    -- Service Details
    service_type TEXT,
    address TEXT,
    notes TEXT,
    -- Status Tracking
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (
        status IN (
            'scheduled',
            'canceled',
            'rescheduled',
            'completed'
        )
    ),
    -- Notification State
    confirmation_sent_at TIMESTAMPTZ,
    reminder_sent_at TIMESTAMPTZ,
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    -- Strict Idempotency: Prevent duplicate bookings for same call + time
    UNIQUE (vapi_call_id, scheduled_start_at)
);
-- 3. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_appointments_account_id ON public.appointments(account_id);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_start ON public.appointments(scheduled_start_at);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_reminder_check ON public.appointments(status, reminder_sent_at, scheduled_start_at);
-- 4. Enable RLS
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
-- 5. RLS Policies
-- Policy: Authenticated users can view appointments in their account
DROP POLICY IF EXISTS "Users can view appointments in their account" ON public.appointments;
CREATE POLICY "Users can view appointments in their account" ON public.appointments FOR
SELECT TO authenticated USING (
        account_id = public.get_user_account_id(auth.uid())
    );
-- Policy: Service role can manage all appointments (for Edge Functions)
-- (Service role bypasses RLS by default, but explicit policies can be safer if force_rls is on)
-- We rely on service role bypass generally, but explicit grant serves as documentation.
-- 6. Triggers for updated_at
DROP TRIGGER IF EXISTS update_appointments_updated_at ON public.appointments;
CREATE TRIGGER update_appointments_updated_at BEFORE
UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();