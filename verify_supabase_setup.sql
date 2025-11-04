-- =====================================================
-- VERIFY SUPABASE SETUP FOR TRIAL SIGNUPS
-- Run this in your Supabase SQL Editor to check your setup
-- =====================================================

-- Check if trial_signups table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'trial_signups'
) AS trial_signups_table_exists;

-- Check the structure of trial_signups table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'trial_signups'
ORDER BY ordinal_position;

-- Check RLS status
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'trial_signups';

-- Check existing policies
SELECT
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'trial_signups';

-- Check if the table has any data
SELECT COUNT(*) as total_signups FROM public.trial_signups;

-- Check recent signups (last 5)
SELECT id, name, email, phone, trade, created_at
FROM public.trial_signups
ORDER BY created_at DESC
LIMIT 5;
