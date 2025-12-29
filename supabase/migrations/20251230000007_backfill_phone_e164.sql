-- ============================================================================
-- Migration: Backfill phone_numbers e164_number
-- Version: 20251230000007
-- Purpose: Fix null e164_number columns which cause webhook mapping failures
-- ============================================================================

-- Backfill e164_number from phone_number where missing
UPDATE phone_numbers
SET e164_number = phone_number
WHERE (e164_number IS NULL OR e164_number = '')
  AND phone_number IS NOT NULL;

-- Log the backfill results
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled % phone_numbers with e164_number', updated_count;
END $$;
