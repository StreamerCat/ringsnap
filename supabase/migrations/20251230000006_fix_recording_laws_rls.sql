-- ============================================================================
-- Migration: Fix state_recording_laws RLS
-- Version: 20251230000006
-- Purpose: Allow authenticated users to read state recording laws (fixes 406 error)
-- ============================================================================

-- Enable RLS
ALTER TABLE IF EXISTS public.state_recording_laws ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if any
DROP POLICY IF EXISTS "Anyone can read state recording laws" ON public.state_recording_laws;
DROP POLICY IF EXISTS "Authenticated users can read state recording laws" ON public.state_recording_laws;

-- Create policy allowing read access to all authenticated users
CREATE POLICY "Authenticated users can read state recording laws"
  ON public.state_recording_laws
  FOR SELECT
  TO authenticated
  USING (true);
