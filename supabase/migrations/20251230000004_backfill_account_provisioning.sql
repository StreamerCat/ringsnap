-- ============================================================================
-- Migration: Backfill accounts with missing provisioning data
-- Version: 20251230000004
-- Purpose: Fix accounts where phone was provisioned but account fields weren't updated
-- ============================================================================

-- Backfill provisioning_status and vapi_phone_number from phone_numbers table
-- This fixes accounts that have a phone number but weren't properly linked
UPDATE accounts a
SET 
  provisioning_status = 'active',
  vapi_phone_number = pn.e164_number,
  phone_number_e164 = pn.e164_number,
  phone_provisioned_at = COALESCE(pn.activated_at, pn.created_at)
FROM phone_numbers pn
WHERE pn.account_id = a.id
  AND pn.status = 'active'
  AND (a.provisioning_status IS NULL 
       OR a.provisioning_status NOT IN ('completed', 'active')
       OR a.vapi_phone_number IS NULL);

-- Log the backfill results
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled % accounts with phone number data', updated_count;
END $$;
