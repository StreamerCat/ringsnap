-- ============================================================================
-- Migration: Fix check_account_access to avoid enum errors
-- Version: 20251230000005
-- Purpose: Remove problematic staff_role check that causes crashes on invalid enum values
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_account_access(_account_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  -- Check 1: User is directly a member of this account
  IF EXISTS (
    SELECT 1 FROM public.account_members
    WHERE account_id = _account_id
    AND user_id = auth.uid()
  ) THEN
    RETURN true;
  END IF;

  -- Check 2: User's profile belongs to this account
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE account_id = _account_id
    AND id = auth.uid()
  ) THEN
    RETURN true;
  END IF;

  -- NOTE: Staff role check removed to prevent "invalid input value for enum" errors
  -- Staff should be added to account_members or impersonate via other means
  
  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_account_access(uuid) TO authenticated;
