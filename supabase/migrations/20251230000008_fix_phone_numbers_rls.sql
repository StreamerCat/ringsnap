-- ============================================================================
-- Migration: Fix Phone Numbers RLS
-- Version: 20251230000008
-- Purpose: Ensure authenticated users can view/update their own phone numbers
-- ============================================================================

-- Enable RLS just in case
ALTER TABLE phone_numbers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to be safe
DROP POLICY IF EXISTS "account_view_phones" ON phone_numbers;
DROP POLICY IF EXISTS "account_manage_phones" ON phone_numbers;

-- Create View Policy (Uses check_account_access for recursion safety)
CREATE POLICY "account_view_phones" ON phone_numbers
  FOR SELECT TO authenticated
  USING (
    account_id IS NOT NULL AND
    public.check_account_access(account_id)
  );

-- Create Update Policy
CREATE POLICY "account_update_phones" ON phone_numbers
  FOR UPDATE TO authenticated
  USING (
    account_id IS NOT NULL AND
    public.check_account_access(account_id)
  )
  WITH CHECK (
    account_id IS NOT NULL AND
    public.check_account_access(account_id)
  );

-- Log the policy creation
DO $$
BEGIN
  RAISE NOTICE 'Recreated RLS policies for phone_numbers';
END $$;
