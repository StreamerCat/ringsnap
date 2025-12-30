-- Migration: Phase 1 Phone Constraints (Guardrails)
-- Description: Enforce unique constraints on canonical columns using partial indexes.
-- includes preflight check to fail if duplicates exist.
-- 1. Preflight Check: Detect Duplicates
DO $$
DECLARE v_duplicate_e164_count INT;
v_duplicate_vapi_count INT;
v_duplicate_twilio_count INT;
BEGIN -- Check e164_number duplicates (excluding released/deleted)
SELECT COUNT(*) INTO v_duplicate_e164_count
FROM (
        SELECT e164_number
        FROM public.phone_numbers
        WHERE status NOT IN ('released', 'deleted')
            AND e164_number IS NOT NULL
        GROUP BY e164_number
        HAVING COUNT(*) > 1
    ) sub;
-- Check vapi_phone_id duplicates
SELECT COUNT(*) INTO v_duplicate_vapi_count
FROM (
        SELECT vapi_phone_id
        FROM public.phone_numbers
        WHERE vapi_phone_id IS NOT NULL
        GROUP BY vapi_phone_id
        HAVING COUNT(*) > 1
    ) sub;
-- Check twilio_phone_number_sid duplicates
SELECT COUNT(*) INTO v_duplicate_twilio_count
FROM (
        SELECT twilio_phone_number_sid
        FROM public.phone_numbers
        WHERE twilio_phone_number_sid IS NOT NULL
        GROUP BY twilio_phone_number_sid
        HAVING COUNT(*) > 1
    ) sub;
-- Raise Exception if any duplicates found
IF v_duplicate_e164_count > 0
OR v_duplicate_vapi_count > 0
OR v_duplicate_twilio_count > 0 THEN RAISE EXCEPTION 'Preflight Check Failed: Duplicates detected. E164: %, VapiID: %, TwilioSID: %. cleanup required before applying constraints.',
v_duplicate_e164_count,
v_duplicate_vapi_count,
v_duplicate_twilio_count;
END IF;
RAISE NOTICE 'Preflight Check Passed: No duplicates found.';
END $$;
-- 2. Create Unique Indexes
-- Unique e164_number for "live" numbers
-- We exclude released/deleted status to allow history, but enforce uniqueness for active/pool/cooldown
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_phone_e164 ON public.phone_numbers (e164_number)
WHERE status NOT IN ('released', 'deleted');
-- Unique vapi_phone_id (Global uniqueness, if it exists it must be unique)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_phone_vapi_id ON public.phone_numbers (vapi_phone_id);
-- Unique twilio_phone_number_sid (Global uniqueness)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_phone_twilio_sid ON public.phone_numbers (twilio_phone_number_sid);
-- 3. Add Accounts Columns for Provisioning Error (as requested in plan)
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS provisioning_error_code TEXT,
    ADD COLUMN IF NOT EXISTS provisioning_error_message TEXT,
    ADD COLUMN IF NOT EXISTS last_failed_step TEXT;