-- =====================================================
-- CREATE TRIAL_SIGNUPS TABLE
-- Run this in your Supabase SQL Editor
-- Project: https://supabase.com/dashboard/project/lytnlrkdccqmxgdmdxef
-- =====================================================

-- Create the trial_signups table
CREATE TABLE IF NOT EXISTS public.trial_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  trade TEXT,
  wants_advanced_voice BOOLEAN DEFAULT false,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable Row Level Security
ALTER TABLE public.trial_signups ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to insert (for signup forms)
CREATE POLICY "Allow public inserts to trial_signups"
  ON public.trial_signups
  FOR INSERT
  TO anon, authenticated, service_role
  WITH CHECK (true);

-- Create policy to allow service role and authenticated users to read
CREATE POLICY "Allow authenticated and service role to read trial_signups"
  ON public.trial_signups
  FOR SELECT
  TO authenticated, service_role
  USING (true);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS trial_signups_email_idx ON public.trial_signups(email);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS trial_signups_created_at_idx ON public.trial_signups(created_at DESC);

-- Verify the table was created
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'trial_signups'
ORDER BY ordinal_position;

-- Success message
SELECT 'trial_signups table created successfully!' as status;
