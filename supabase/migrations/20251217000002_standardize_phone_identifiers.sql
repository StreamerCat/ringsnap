-- Migration: Standardize phone number identifiers
-- Purpose: Add canonical columns while keeping legacy ones for backward compatibility

-- =============================================================================
-- PHASE 1: Add new canonical columns to phone_numbers (additive only)
-- =============================================================================

-- Add provider_phone_number_id (Vapi phoneNumber.id)
ALTER TABLE public.phone_numbers
  ADD COLUMN IF NOT EXISTS provider_phone_number_id TEXT;

-- Add e164_number (canonical phone number string)
ALTER TABLE public.phone_numbers
  ADD COLUMN IF NOT EXISTS e164_number TEXT;

-- Add twilio_phone_number_sid (Twilio SID if available)
ALTER TABLE public.phone_numbers
  ADD COLUMN IF NOT EXISTS twilio_phone_number_sid TEXT;

-- =============================================================================
-- PHASE 2: Backfill from existing columns
-- =============================================================================

-- Backfill provider_phone_number_id from vapi_phone_id (primary source)
UPDATE public.phone_numbers
SET provider_phone_number_id = vapi_phone_id
WHERE provider_phone_number_id IS NULL 
  AND vapi_phone_id IS NOT NULL;

-- Also check vapi_id column if it exists in some environments
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'phone_numbers' 
    AND column_name = 'vapi_id'
  ) THEN
    UPDATE public.phone_numbers
    SET provider_phone_number_id = vapi_id
    WHERE provider_phone_number_id IS NULL 
      AND vapi_id IS NOT NULL;
  END IF;
END $$;

-- Backfill e164_number from phone_number
UPDATE public.phone_numbers
SET e164_number = phone_number
WHERE e164_number IS NULL 
  AND phone_number IS NOT NULL;

-- =============================================================================
-- PHASE 3: Backfill from vapi_numbers table (consolidation)
-- =============================================================================

-- Check if vapi_numbers exists and has data to merge
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'vapi_numbers'
  ) THEN
    -- Backfill provider_phone_number_id from vapi_numbers.vapi_number_id
    -- Match by account_id + E164 phone
    UPDATE public.phone_numbers pn
    SET provider_phone_number_id = vn.vapi_number_id
    FROM public.vapi_numbers vn
    WHERE vn.account_id = pn.account_id
      AND vn.phone_e164 = pn.phone_number
      AND pn.provider_phone_number_id IS NULL
      AND vn.vapi_number_id IS NOT NULL;
    
    RAISE NOTICE 'Backfilled provider_phone_number_id from vapi_numbers';
  END IF;
END $$;

-- =============================================================================
-- PHASE 4: Create indexes for efficient lookups
-- =============================================================================

-- Unique index on provider_phone_number_id (primary mapping key)
CREATE UNIQUE INDEX IF NOT EXISTS idx_phone_numbers_provider_phone_id 
  ON public.phone_numbers(provider_phone_number_id) 
  WHERE provider_phone_number_id IS NOT NULL;

-- Index on e164_number for fallback lookup
CREATE INDEX IF NOT EXISTS idx_phone_numbers_e164 
  ON public.phone_numbers(e164_number) 
  WHERE e164_number IS NOT NULL;

-- =============================================================================
-- PHASE 5: Create debugging view
-- =============================================================================

CREATE OR REPLACE VIEW public.phone_number_identity AS
SELECT 
  id AS internal_id,
  account_id,
  COALESCE(e164_number, phone_number) AS e164,
  provider_phone_number_id AS vapi_phone_id,
  vapi_phone_id AS legacy_vapi_phone_id,
  twilio_phone_number_sid AS twilio_sid,
  status,
  is_primary,
  created_at
FROM public.phone_numbers;

COMMENT ON VIEW public.phone_number_identity IS 
  'Debugging view showing all phone number identifiers. Use this to trace mapping issues.';

-- =============================================================================
-- PHASE 6: Add deprecation notices
-- =============================================================================

COMMENT ON COLUMN public.phone_numbers.vapi_phone_id IS 
  'DEPRECATED: Use provider_phone_number_id instead. Kept for backward compatibility.';

-- Add comment on vapi_id if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'phone_numbers' 
    AND column_name = 'vapi_id'
  ) THEN
    EXECUTE 'COMMENT ON COLUMN public.phone_numbers.vapi_id IS 
      ''DEPRECATED: Use provider_phone_number_id instead. Kept for backward compatibility.''';
  END IF;
END $$;

COMMENT ON COLUMN public.phone_numbers.phone_number IS 
  'Original phone number column. Use e164_number for consistent E.164 format.';
