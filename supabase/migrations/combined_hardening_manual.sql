-- ============================================================================
-- Migration: Normalize Phone Number Canonical Columns (Phase 0)
-- Version: 20251230000010
-- Purpose: Backfill canonical columns, establish single source of truth
-- ============================================================================
-- Decision: vapi_phone_id is canonical (approved by user)
-- ============================================================================
-- PREFLIGHT: Log distinct lifecycle_status values for reference
-- ============================================================================
DO $$
DECLARE v_statuses TEXT;
BEGIN
SELECT string_agg(DISTINCT lifecycle_status::text, ', ') INTO v_statuses
FROM phone_numbers
WHERE lifecycle_status IS NOT NULL;
RAISE NOTICE 'Existing lifecycle_status values: %',
COALESCE(v_statuses, '(none)');
END $$;
-- ============================================================================
-- STEP 1: Backfill vapi_phone_id from legacy columns
-- ============================================================================
-- Backfill from vapi_id (legacy column) when vapi_phone_id is NULL
UPDATE phone_numbers
SET vapi_phone_id = vapi_id
WHERE vapi_phone_id IS NULL
  AND vapi_id IS NOT NULL
  AND vapi_id ~ '^[0-9a-f-]{36}$';
-- Backfill from provider_phone_number_id (legacy) when still NULL
UPDATE phone_numbers
SET vapi_phone_id = provider_phone_number_id
WHERE vapi_phone_id IS NULL
  AND provider_phone_number_id IS NOT NULL
  AND provider_phone_number_id ~ '^[0-9a-f-]{36}$';
DO $$ BEGIN RAISE NOTICE 'Step 1 complete: vapi_phone_id backfill';
END $$;
-- ============================================================================
-- STEP 2: Backfill twilio_phone_number_sid from provider_id
-- ============================================================================
-- Primary: provider_id column where provider='twilio' and starts with 'PN'
UPDATE phone_numbers
SET twilio_phone_number_sid = provider_id
WHERE twilio_phone_number_sid IS NULL
  AND provider = 'twilio'
  AND provider_id IS NOT NULL
  AND provider_id LIKE 'PN%';
-- Fallback: check raw->>'provider_id' if provider_id column is null
UPDATE phone_numbers
SET twilio_phone_number_sid = (raw::jsonb)->>'provider_id'
WHERE twilio_phone_number_sid IS NULL
  AND provider = 'twilio'
  AND raw IS NOT NULL
  AND (raw::jsonb)->>'provider_id' IS NOT NULL
  AND (raw::jsonb)->>'provider_id' LIKE 'PN%';
DO $$ BEGIN RAISE NOTICE 'Step 2 complete: twilio_phone_number_sid backfill';
END $$;
-- ============================================================================
-- STEP 3: Backfill e164_number from phone_number
-- ============================================================================
UPDATE phone_numbers
SET e164_number = phone_number
WHERE e164_number IS NULL
  AND phone_number IS NOT NULL;
DO $$ BEGIN RAISE NOTICE 'Step 3 complete: e164_number backfill';
END $$;
-- ============================================================================
-- STEP 4: Backfill lifecycle_status (TIGHTENED RULES)
-- ============================================================================
-- Only backfill when:
-- - lifecycle_status IS NULL (never overwrite existing)
-- - assigned_account_id IS NULL (not already using new model)
-- - account_id IS NOT NULL (has legacy assignment)
-- - status = 'active' (not released/disabled)
UPDATE phone_numbers
SET lifecycle_status = 'assigned',
  assigned_account_id = account_id,
  assigned_at = COALESCE(assigned_at, activated_at, created_at)
WHERE lifecycle_status IS NULL
  AND assigned_account_id IS NULL
  AND account_id IS NOT NULL
  AND status = 'active';
DO $$ BEGIN RAISE NOTICE 'Step 4 complete: lifecycle_status backfill';
END $$;
-- STEP 4b: Backfill assigned_account_id for already-assigned rows
-- (Rows that have lifecycle_status='assigned' but NULL assigned_account_id)
UPDATE phone_numbers
SET assigned_account_id = account_id
WHERE lifecycle_status = 'assigned'
  AND assigned_account_id IS NULL
  AND account_id IS NOT NULL;
DO $$ BEGIN RAISE NOTICE 'Step 4b complete: assigned_account_id backfill for already-assigned rows';
END $$;
-- ============================================================================
-- STEP 5: Verification Queries (DO NOT SKIP)
-- ============================================================================
-- These counts must be 0 before proceeding to Phase 1
-- Uses filter: lifecycle_status IS NOT NULL AND NOT IN ('released','quarantine')
DO $$
DECLARE v_missing_vapi_phone_id INT;
v_missing_twilio_sid INT;
v_duplicates_e164 INT;
v_duplicates_vapi INT;
v_duplicates_twilio INT;
v_active_null_lifecycle INT;
BEGIN -- Count 1: Live lifecycle rows missing vapi_phone_id
SELECT COUNT(*) INTO v_missing_vapi_phone_id
FROM phone_numbers
WHERE lifecycle_status IS NOT NULL
  AND lifecycle_status NOT IN ('released', 'quarantine')
  AND vapi_phone_id IS NULL;
-- Count 2: Twilio rows missing twilio_phone_number_sid
SELECT COUNT(*) INTO v_missing_twilio_sid
FROM phone_numbers
WHERE provider = 'twilio'
  AND lifecycle_status IS NOT NULL
  AND lifecycle_status NOT IN ('released', 'quarantine')
  AND twilio_phone_number_sid IS NULL;
-- Count 3: Duplicates on e164_number across live states
SELECT COUNT(*) INTO v_duplicates_e164
FROM (
    SELECT e164_number
    FROM phone_numbers
    WHERE lifecycle_status IS NOT NULL
      AND lifecycle_status NOT IN ('released', 'quarantine')
      AND e164_number IS NOT NULL
    GROUP BY e164_number
    HAVING COUNT(*) > 1
  ) dupes;
-- Count 4: Duplicates on vapi_phone_id
SELECT COUNT(*) INTO v_duplicates_vapi
FROM (
    SELECT vapi_phone_id
    FROM phone_numbers
    WHERE vapi_phone_id IS NOT NULL
    GROUP BY vapi_phone_id
    HAVING COUNT(*) > 1
  ) dupes;
-- Count 5: Duplicates on twilio_phone_number_sid
SELECT COUNT(*) INTO v_duplicates_twilio
FROM (
    SELECT twilio_phone_number_sid
    FROM phone_numbers
    WHERE twilio_phone_number_sid IS NOT NULL
    GROUP BY twilio_phone_number_sid
    HAVING COUNT(*) > 1
  ) dupes;
-- Count 6: Active rows with NULL lifecycle_status (will bypass Phase 1 constraints)
SELECT COUNT(*) INTO v_active_null_lifecycle
FROM phone_numbers
WHERE status = 'active'
  AND (
    account_id IS NOT NULL
    OR is_primary = true
  )
  AND lifecycle_status IS NULL;
RAISE NOTICE '=== PHASE 0 VERIFICATION RESULTS ===';
RAISE NOTICE 'Missing vapi_phone_id (live): %',
v_missing_vapi_phone_id;
RAISE NOTICE 'Missing twilio_sid (twilio+live): %',
v_missing_twilio_sid;
RAISE NOTICE 'Duplicate e164 (live): %',
v_duplicates_e164;
RAISE NOTICE 'Duplicate vapi_phone_id: %',
v_duplicates_vapi;
RAISE NOTICE 'Duplicate twilio_sid: %',
v_duplicates_twilio;
RAISE NOTICE 'Active but NULL lifecycle: %',
v_active_null_lifecycle;
IF v_missing_vapi_phone_id > 0
OR v_missing_twilio_sid > 0
OR v_duplicates_e164 > 0
OR v_duplicates_vapi > 0
OR v_duplicates_twilio > 0
OR v_active_null_lifecycle > 0 THEN RAISE WARNING 'REMEDIATION REQUIRED before Phase 1';
ELSE RAISE NOTICE 'All verification checks passed - ready for Phase 1';
END IF;
END $$;
-- ============================================================================
-- STEP 6: Add deprecation notices
-- ============================================================================
COMMENT ON COLUMN phone_numbers.vapi_id IS 'DEPRECATED: Canonical is vapi_phone_id. Will be removed in future migration.';
COMMENT ON COLUMN phone_numbers.provider_phone_number_id IS 'DEPRECATED: Use vapi_phone_id for Vapi IDs, twilio_phone_number_sid for Twilio SIDs.';-- Migration: Hardened RLS for phone_numbers (Final)
-- Phase: Compatibility Sweep / Hardening
-- Description: Split policies, enforced TO authenticated, strict constraints.
ALTER TABLE public.phone_numbers ENABLE ROW LEVEL SECURITY;
-- 1. Drop existing policies
DROP POLICY IF EXISTS "Users can view their account phone numbers" ON public.phone_numbers;
DROP POLICY IF EXISTS "Users can manage their account phone numbers" ON public.phone_numbers;
DROP POLICY IF EXISTS "Users can update their account phone numbers" ON public.phone_numbers;
-- 2. SELECT Policy
CREATE POLICY "Users can view their account phone numbers" ON public.phone_numbers FOR
SELECT TO authenticated USING (
        (
            assigned_account_id = get_user_account_id(auth.uid())
            AND lifecycle_status = 'assigned'
        )
        OR (
            account_id = get_user_account_id(auth.uid())
            AND (
                lifecycle_status IS NULL
                OR lifecycle_status = 'assigned'
            )
        )
    );
-- 3. UPDATE Policy (with CHECK constraint)
CREATE POLICY "Users can update their account phone numbers" ON public.phone_numbers FOR
UPDATE TO authenticated USING (
        (
            assigned_account_id = get_user_account_id(auth.uid())
            AND lifecycle_status = 'assigned'
        )
        OR (
            account_id = get_user_account_id(auth.uid())
            AND (
                lifecycle_status IS NULL
                OR lifecycle_status = 'assigned'
            )
        )
    ) WITH CHECK (
        (
            assigned_account_id = get_user_account_id(auth.uid())
            AND lifecycle_status = 'assigned'
        )
        OR (
            account_id = get_user_account_id(auth.uid())
            AND (
                lifecycle_status IS NULL
                OR lifecycle_status = 'assigned'
            )
        )
    );
-- Note: No INSERT or DELETE policies allowed for customers.-- Migration: Harden transition_phone_to_cooldown RPC (Final + Security Fix)
-- Phase: Compatibility Sweep / Hardening
-- Description: Add ownership check, search_path, full clear of IDs, and LOCK DOWN permissions.
CREATE OR REPLACE FUNCTION public.transition_phone_to_cooldown(
        p_phone_id UUID,
        p_account_id UUID,
        p_reason TEXT,
        p_cooldown_interval INTERVAL DEFAULT '28 days'
    ) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_phone_record RECORD;
v_user_account_id UUID;
BEGIN -- 1. Security Check: Validate Ownership (if called by user)
-- service_role (null uid) bypasses this check
-- NOTE: We are also revoking execute from public below, so only service_role should theoretically call this.
-- But if we ever grant it to authenticated, this check is critical.
IF (auth.uid() IS NOT NULL) THEN v_user_account_id := get_user_account_id(auth.uid());
IF (p_account_id != v_user_account_id) THEN RAISE EXCEPTION 'Unauthorized: Account ID mismatch';
END IF;
END IF;
-- 2. Verify phone status
SELECT * INTO v_phone_record
FROM public.phone_numbers
WHERE id = p_phone_id
    AND assigned_account_id = p_account_id
    AND lifecycle_status = 'assigned' FOR
UPDATE;
IF v_phone_record.id IS NULL THEN -- Phone not found or not assigned to this account
RETURN FALSE;
END IF;
-- 3. Update phone_numbers (Clear & Set)
UPDATE public.phone_numbers
SET lifecycle_status = 'cooldown',
    assigned_account_id = NULL,
    account_id = NULL,
    -- Clear legacy column
    assigned_at = NULL,
    -- Clear assignment timestamp
    released_at = now(),
    cooldown_until = now() + p_cooldown_interval,
    last_lifecycle_change_at = now(),
    updated_at = now()
WHERE id = p_phone_id;
-- 4. Close active assignment
UPDATE public.phone_number_assignments
SET ended_at = now(),
    end_reason = p_reason
WHERE phone_number_id = p_phone_id
    AND account_id = p_account_id
    AND ended_at IS NULL;
RETURN TRUE;
END;
$$;
-- SECURITY FIX: Revoke from PUBLIC, Grant only to service_role (Option A)
-- This prevents anon or regular users from calling it directly, addressing the auth.uid() bypass risk.
REVOKE ALL ON FUNCTION public.transition_phone_to_cooldown(UUID, UUID, TEXT, INTERVAL)
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transition_phone_to_cooldown(UUID, UUID, TEXT, INTERVAL) TO service_role;-- Migration: Phase 1 Phone Constraints (Guardrails)
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
    ADD COLUMN IF NOT EXISTS last_failed_step TEXT;-- Migration: Allocator RPC (Concurrency Safe)
-- Description: Function to safely allocate a pooled phone number using row locking.
CREATE OR REPLACE FUNCTION public.allocate_pooled_phone_number(p_account_id UUID, p_area_code TEXT) RETURNS TABLE (
        id UUID,
        e164_number TEXT,
        vapi_phone_id TEXT,
        provider_phone_number_id TEXT,
        twilio_phone_number_sid TEXT
    ) LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_phone_id UUID;
BEGIN -- 1. Attempt to find and lock a pooled number
-- We prioritize numbers that have been in the pool longest (implicitly by id or explicitly if we had pooled_at)
-- 'FOR UPDATE SKIP LOCKED' ensures we skip any rows currently locked by another transaction
SELECT p.id INTO v_phone_id
FROM public.phone_numbers p
WHERE p.lifecycle_status = 'pool'
    AND p.area_code = p_area_code
    AND p.status = 'active' -- Ensure it's technically active/valid
LIMIT 1 FOR
UPDATE SKIP LOCKED;
-- 2. If found, assign it immediately
IF v_phone_id IS NOT NULL THEN
UPDATE public.phone_numbers
SET lifecycle_status = 'assigned',
    assigned_account_id = p_account_id,
    account_id = p_account_id,
    -- Legacy mirror
    assigned_at = now(),
    updated_at = now()
WHERE public.phone_numbers.id = v_phone_id
RETURNING public.phone_numbers.id,
    public.phone_numbers.e164_number,
    public.phone_numbers.vapi_phone_id,
    public.phone_numbers.provider_phone_number_id,
    public.phone_numbers.twilio_phone_number_sid INTO id,
    e164_number,
    vapi_phone_id,
    provider_phone_number_id,
    twilio_phone_number_sid;
RETURN NEXT;
END IF;
-- If not found, return empty result (caller handles provisioning new)
RETURN;
END;
$$;
-- Grant execute to service role only (provisioning function runs as service role)
REVOKE ALL ON FUNCTION public.allocate_pooled_phone_number(UUID, TEXT)
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.allocate_pooled_phone_number(UUID, TEXT) TO service_role;