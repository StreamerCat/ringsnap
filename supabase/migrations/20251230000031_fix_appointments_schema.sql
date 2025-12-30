-- Migration: Fix Appointments Schema for Frontend Compatibility
-- Description: Adds missing columns to appointments table to support new UI and Webhook logic.
-- Date: 2025-12-30
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS scheduled_start_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS vapi_call_id TEXT,
    ADD COLUMN IF NOT EXISTS caller_name TEXT,
    ADD COLUMN IF NOT EXISTS caller_phone TEXT,
    ADD COLUMN IF NOT EXISTS address TEXT,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS service_type TEXT,
    ADD COLUMN IF NOT EXISTS time_zone TEXT DEFAULT 'America/Denver',
    ADD COLUMN IF NOT EXISTS scheduled_end_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS confirmation_sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;