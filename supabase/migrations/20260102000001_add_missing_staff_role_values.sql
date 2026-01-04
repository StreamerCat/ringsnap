-- Add missing staff_role enum values that are referenced in policies
-- Note: ALTER TYPE...ADD VALUE cannot be run in a transaction, but CREATE OR REPLACE FUNCTION can
-- This migration adds 'admin' and 'billing' which are referenced in multiple policies but were never added to the enum

-- Add 'admin' to staff_role enum if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'admin' AND enumtypid = 'staff_role'::regtype) THEN
    ALTER TYPE staff_role ADD VALUE 'admin';
  END IF;
END $$;

-- Add 'billing' to staff_role enum if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'billing' AND enumtypid = 'staff_role'::regtype) THEN
    ALTER TYPE staff_role ADD VALUE 'billing';
  END IF;
END $$;

-- Note: 'support' already exists in the original enum definition
-- Note: 'sales' was added in migration 20251107234915
-- The enum now contains: platform_owner, platform_admin, support, viewer, sales, admin, billing
