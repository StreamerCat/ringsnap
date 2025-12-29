-- ============================================================================
-- Migration: Fix system_events RLS policy to avoid recursion
-- Version: 20251230000003
-- Purpose: Replace profiles query with check_account_access to prevent RLS recursion
-- ============================================================================

-- Drop the problematic policy
DROP POLICY IF EXISTS "account_read_own_warn_error" ON system_events;

-- Recreate using check_account_access (which is SECURITY DEFINER and bypasses RLS)
CREATE POLICY "account_read_own_warn_error" ON system_events
  FOR SELECT TO authenticated
  USING (
    level IN ('warn', 'error')
    AND account_id IS NOT NULL
    AND public.check_account_access(account_id)
  );
