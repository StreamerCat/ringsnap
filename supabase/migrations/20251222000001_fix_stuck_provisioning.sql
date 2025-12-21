-- Migration: Fix stuck provisioning records
-- Issue: provision_number used wrong columns, leaving activated_at NULL
-- This migration backfills and syncs the missing data

-- Step 1: Backfill activated_at ONLY for truly provisioned records
-- Narrowed conditions per user requirement: must have provider IDs to prove real provisioning
UPDATE public.phone_numbers
SET 
  activated_at = created_at, 
  updated_at = now()
WHERE status = 'active'
  AND is_primary = true
  AND activated_at IS NULL
  AND (provider_phone_number_id IS NOT NULL OR vapi_phone_id IS NOT NULL);

-- Step 2: Log suspicious records (active but no provider ID) for inspection
-- DO NOT auto-fix these - they need manual review
DO $$
DECLARE
  suspicious_count integer;
BEGIN
  SELECT count(*) INTO suspicious_count
  FROM public.phone_numbers
  WHERE status = 'active'
    AND is_primary = true
    AND provider_phone_number_id IS NULL
    AND vapi_phone_id IS NULL;
  
  IF suspicious_count > 0 THEN
    RAISE NOTICE 'Found % suspicious phone_numbers records (active primary but no provider ID)', suspicious_count;
  END IF;
END $$;

-- Step 3: Sync vapi_phone_number from phone_numbers to accounts
-- Only for records that have activated_at (proven provisioned)
UPDATE public.accounts a
SET 
  vapi_phone_number = pn.phone_number,
  phone_number_e164 = pn.phone_number,
  updated_at = now()
FROM public.phone_numbers pn
WHERE pn.account_id = a.id
  AND pn.is_primary = true
  AND pn.status = 'active'
  AND pn.activated_at IS NOT NULL
  AND (a.vapi_phone_number IS NULL OR a.vapi_phone_number = '');

-- Step 4: Mark completed ONLY when full lifecycle confirmed
-- Requires both phone number AND assistant ID present
UPDATE public.accounts a
SET 
  provisioning_status = 'completed',
  provisioning_completed_at = COALESCE(a.provisioning_completed_at, now()),
  updated_at = now()
WHERE a.provisioning_status IN ('pending', 'active', 'provisioning')
  AND a.vapi_phone_number IS NOT NULL AND a.vapi_phone_number != ''
  AND a.vapi_assistant_id IS NOT NULL AND a.vapi_assistant_id != '';
