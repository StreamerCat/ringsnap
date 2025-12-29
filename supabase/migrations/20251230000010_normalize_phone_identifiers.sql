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
-- Uses filter: lifecycle_status IS NOT NULL AND NOT IN ('released','deleted','quarantine')
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
  AND lifecycle_status NOT IN ('released', 'deleted', 'quarantine')
  AND vapi_phone_id IS NULL;
-- Count 2: Twilio rows missing twilio_phone_number_sid
SELECT COUNT(*) INTO v_missing_twilio_sid
FROM phone_numbers
WHERE provider = 'twilio'
  AND lifecycle_status IS NOT NULL
  AND lifecycle_status NOT IN ('released', 'deleted', 'quarantine')
  AND twilio_phone_number_sid IS NULL;
-- Count 3: Duplicates on e164_number across live states
SELECT COUNT(*) INTO v_duplicates_e164
FROM (
    SELECT e164_number
    FROM phone_numbers
    WHERE lifecycle_status IS NOT NULL
      AND lifecycle_status NOT IN ('released', 'deleted', 'quarantine')
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
COMMENT ON COLUMN phone_numbers.provider_phone_number_id IS 'DEPRECATED: Use vapi_phone_id for Vapi IDs, twilio_phone_number_sid for Twilio SIDs.';