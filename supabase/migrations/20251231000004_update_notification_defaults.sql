-- Migration: Update Accounts Notification Defaults and Timezone Backfill
-- 1. Ensure columns exist (Safety Check)
-- This block handles cases where the previous migration might have partially failed or been skipped.
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS notification_sms_phone TEXT,
    ADD COLUMN IF NOT EXISTS notification_email TEXT,
    ADD COLUMN IF NOT EXISTS notify_contractor_email BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS notify_caller_sms BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS notify_caller_email BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Denver';
-- 1b. Now that columns definitely exist, set their DEFAULTs if not already set by ADD COLUMN above
ALTER TABLE public.accounts
ALTER COLUMN sms_enabled
SET DEFAULT true,
    ALTER COLUMN sms_appointment_confirmations
SET DEFAULT true,
    ALTER COLUMN sms_reminders
SET DEFAULT true,
    ALTER COLUMN notify_contractor_email
SET DEFAULT true,
    ALTER COLUMN notify_caller_sms
SET DEFAULT true,
    ALTER COLUMN notify_caller_email
SET DEFAULT true;
-- 2. Backfill existing NULLs to 'true' (safe backfill, doesn't override user choices)
UPDATE public.accounts
SET sms_enabled = true
WHERE sms_enabled IS NULL;
UPDATE public.accounts
SET sms_appointment_confirmations = true
WHERE sms_appointment_confirmations IS NULL;
UPDATE public.accounts
SET sms_reminders = true
WHERE sms_reminders IS NULL;
UPDATE public.accounts
SET notify_contractor_email = true
WHERE notify_contractor_email IS NULL;
UPDATE public.accounts
SET notify_caller_sms = true
WHERE notify_caller_sms IS NULL;
UPDATE public.accounts
SET notify_caller_email = true
WHERE notify_caller_email IS NULL;
-- 3. Backfill Timezone for accounts where it is NULL
UPDATE public.accounts
SET timezone = 'America/Denver'
WHERE timezone IS NULL;