-- Migration: Deduplicate Phone Number Fields
-- Purpose: Remove duplicate/confusing phone number columns
--          Standardize on single canonical field names
-- Date: 2025-11-20

-- ==============================================================================
-- PART 1: phone_numbers table cleanup
-- ==============================================================================

-- Step 1: Check if vapi_phone_id column exists (it might not in all environments)
DO $$
BEGIN
  -- Consolidate vapi_phone_id into vapi_id if both exist
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'phone_numbers'
      AND column_name = 'vapi_phone_id'
  ) THEN
    -- Copy data from vapi_phone_id to vapi_id where vapi_id is NULL
    UPDATE public.phone_numbers
    SET vapi_id = vapi_phone_id
    WHERE vapi_id IS NULL AND vapi_phone_id IS NOT NULL;

    -- Drop the duplicate column
    ALTER TABLE public.phone_numbers DROP COLUMN IF EXISTS vapi_phone_id;

    RAISE NOTICE 'Consolidated vapi_phone_id into vapi_id';
  ELSE
    RAISE NOTICE 'vapi_phone_id column does not exist, skipping';
  END IF;
END $$;

-- Step 2: Add comment to vapi_id for clarity
COMMENT ON COLUMN public.phone_numbers.vapi_id IS 'Canonical Vapi phone number ID (previously vapi_phone_id)';

-- ==============================================================================
-- PART 2: accounts table phone field cleanup
-- ==============================================================================

-- Step 3: Check for phone_number_e164 and vapi_phone_number overlap
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'accounts'
      AND column_name = 'vapi_phone_number'
  ) THEN
    -- Copy data from vapi_phone_number to phone_number_e164 where NULL
    UPDATE public.accounts
    SET phone_number_e164 = vapi_phone_number
    WHERE phone_number_e164 IS NULL AND vapi_phone_number IS NOT NULL;

    RAISE NOTICE 'Consolidated vapi_phone_number into phone_number_e164';
  END IF;
END $$;

-- Step 4: Rename phone_number_e164 to phone_number for clarity
-- Only rename if it exists and phone_number doesn't already exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'accounts'
      AND column_name = 'phone_number_e164'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'accounts'
      AND column_name = 'phone_number'
  ) THEN
    ALTER TABLE public.accounts RENAME COLUMN phone_number_e164 TO phone_number;
    RAISE NOTICE 'Renamed phone_number_e164 to phone_number';
  ELSE
    RAISE NOTICE 'phone_number_e164 does not exist or phone_number already exists, skipping rename';
  END IF;
END $$;

-- Step 5: Drop vapi_phone_number column (AFTER copying data)
-- COMMENTED OUT for safety - uncomment after verifying in staging:
-- ALTER TABLE public.accounts DROP COLUMN IF EXISTS vapi_phone_number;

-- Step 6: Update phone_number comment
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'accounts'
      AND column_name = 'phone_number'
  ) THEN
    COMMENT ON COLUMN public.accounts.phone_number IS 'Canonical phone number in E.164 format (e.g., +14155551234)';
  END IF;
END $$;

-- ==============================================================================
-- PART 3: Update indexes to use new canonical field names
-- ==============================================================================

-- Step 7: Drop old indexes if they exist
DROP INDEX IF EXISTS public.idx_accounts_vapi_phone_number;
DROP INDEX IF EXISTS public.idx_accounts_phone_number_e164;

-- Step 8: Create new index on canonical phone_number field
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'accounts'
      AND column_name = 'phone_number'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_accounts_phone_number
      ON public.accounts(phone_number)
      WHERE phone_number IS NOT NULL;
    RAISE NOTICE 'Created index on accounts.phone_number';
  END IF;
END $$;

-- Step 9: Create index on phone_numbers.vapi_id if not exists
CREATE INDEX IF NOT EXISTS idx_phone_numbers_vapi_id
  ON public.phone_numbers(vapi_id)
  WHERE vapi_id IS NOT NULL;

-- ==============================================================================
-- PART 4: Update any views or functions that reference old column names
-- ==============================================================================

-- Step 10: Update account_provisioning_timeline view if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public'
      AND table_name = 'account_provisioning_timeline'
  ) THEN
    -- Recreate view with updated column names
    -- This is safe because we're just changing the view definition
    DROP VIEW IF EXISTS public.account_provisioning_timeline;

    CREATE VIEW public.account_provisioning_timeline AS
    SELECT
      pst.account_id,
      a.company_name,
      a.signup_channel,
      a.provisioning_stage AS current_stage,
      pst.from_stage,
      pst.to_stage,
      pst.triggered_by,
      pst.metadata,
      pst.created_at AS transition_at,
      pst.correlation_id
    FROM public.provisioning_state_transitions pst
    JOIN public.accounts a ON a.id = pst.account_id
    ORDER BY pst.account_id, pst.created_at;

    RAISE NOTICE 'Updated account_provisioning_timeline view';
  END IF;
END $$;

-- ==============================================================================
-- PART 5: Add helper function to validate E.164 phone format
-- ==============================================================================

-- Step 11: Create function to validate E.164 format
CREATE OR REPLACE FUNCTION public.is_valid_e164_phone(phone_number TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- E.164 format: +[country code][subscriber number]
  -- Example: +14155551234
  -- Must start with +, followed by 1-15 digits
  RETURN phone_number ~ '^\+[1-9]\d{1,14}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION public.is_valid_e164_phone IS 'Validates that a phone number is in E.164 format (+country_code + subscriber_number)';

-- Step 12: Add check constraint to ensure E.164 format (optional, commented out for safety)
-- COMMENTED OUT: Can be enabled after ensuring all existing data is in E.164 format
-- DO $$
-- BEGIN
--   IF EXISTS (
--     SELECT 1 FROM information_schema.columns
--     WHERE table_schema = 'public'
--       AND table_name = 'accounts'
--       AND column_name = 'phone_number'
--   ) THEN
--     ALTER TABLE public.accounts
--       ADD CONSTRAINT chk_phone_number_e164
--       CHECK (phone_number IS NULL OR is_valid_e164_phone(phone_number));
--   END IF;
-- END $$;

-- ==============================================================================
-- SUMMARY
-- ==============================================================================

-- This migration consolidates:
-- 1. phone_numbers.vapi_phone_id → phone_numbers.vapi_id
-- 2. accounts.vapi_phone_number → accounts.phone_number_e164 → accounts.phone_number
--
-- Result: Single canonical field names without duplicates
