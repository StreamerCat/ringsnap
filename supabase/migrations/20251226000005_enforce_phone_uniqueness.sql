-- Migration: Enforce global uniqueness on e164_number
-- Purpose: Ensure a phone number exists only once in the inventory table.
-- History should be in phone_number_assignments.

-- 1. Clean up potential duplicates (Safety check)
-- This query finds duplicates. Ideally we should resolve them before applying index.
-- However, for this migration, we assume data is clean or we want to fail if not.
-- User asked to "Confirm... If not, add them".

-- We'll try to create the index safely.
CREATE UNIQUE INDEX IF NOT EXISTS idx_phone_numbers_unique_e164_global
ON public.phone_numbers(e164_number)
WHERE e164_number IS NOT NULL;
