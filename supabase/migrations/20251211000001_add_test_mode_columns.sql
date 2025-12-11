-- Migration: Add test mode tracking columns
-- Purpose: Support shared demo bundle for test signups (ZIP 99999)
-- Date: 2025-12-11
-- 
-- These columns are additive with safe defaults - existing behavior unchanged

-- ============================================================================
-- PART 1: Add billing_test_mode to accounts
-- ============================================================================

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS billing_test_mode BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.accounts.billing_test_mode IS
  'True for test signups (ZIP 99999) that use the shared demo bundle instead of real provisioning';

-- ============================================================================
-- PART 2: Add is_test_number to phone_numbers
-- ============================================================================

ALTER TABLE public.phone_numbers
  ADD COLUMN IF NOT EXISTS is_test_number BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.phone_numbers.is_test_number IS
  'True for phone numbers from the shared demo bundle (not real provisioned numbers)';

-- ============================================================================
-- PART 3: Add is_test_assistant to vapi_assistants
-- ============================================================================

ALTER TABLE public.vapi_assistants
  ADD COLUMN IF NOT EXISTS is_test_assistant BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.vapi_assistants.is_test_assistant IS
  'True for assistant records from the shared demo bundle (not real Vapi assistants)';

-- ============================================================================
-- PART 4: Create index for test account queries (optional optimization)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_accounts_billing_test_mode
  ON public.accounts(billing_test_mode)
  WHERE billing_test_mode = TRUE;

-- ============================================================================
-- NOTES
-- ============================================================================
-- All columns have DEFAULT FALSE so:
-- - Existing rows are unaffected
-- - Live signups continue to work with billing_test_mode = FALSE
-- - Only ZIP 99999 signups set billing_test_mode = TRUE
