-- =====================================================
-- FIX RLS POLICIES FOR TRIAL_SIGNUPS TABLE
-- Run this in your Supabase SQL Editor
-- =====================================================

-- First, drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can create trial signups" ON public.trial_signups;
DROP POLICY IF EXISTS "Service role can insert trial signups" ON public.trial_signups;
DROP POLICY IF EXISTS "Enable insert for anon users" ON public.trial_signups;

-- Create a comprehensive policy that allows:
-- 1. Authenticated users to insert
-- 2. Anonymous users to insert (for forms)
-- 3. Service role to insert (for Netlify functions)
CREATE POLICY "Allow all inserts to trial_signups"
  ON public.trial_signups
  FOR INSERT
  TO anon, authenticated, service_role
  WITH CHECK (true);

-- Optional: If you want to keep the existing read policy, ensure it exists
DROP POLICY IF EXISTS "Only owners can view trial signups" ON public.trial_signups;

CREATE POLICY "Service role and owners can view trial signups"
  ON public.trial_signups
  FOR SELECT
  TO authenticated, service_role
  USING (
    -- Allow service role to read everything
    auth.jwt()->>'role' = 'service_role'
    OR
    -- Allow owners to read their own signups
    has_role(auth.uid(), 'owner'::app_role)
  );

-- Verify RLS is enabled
ALTER TABLE public.trial_signups ENABLE ROW LEVEL SECURITY;

-- Check the policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'trial_signups';
