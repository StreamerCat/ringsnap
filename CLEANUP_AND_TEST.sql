-- =============================================================================
-- CLEANUP SCRIPT: Remove orphaned auth users from failed signups
-- =============================================================================
-- Run this in Supabase SQL Editor to clean up test accounts

-- 1. Find orphaned auth users (users without profiles)
SELECT 
  u.id,
  u.email,
  u.created_at,
  CASE 
    WHEN p.id IS NULL THEN '❌ No profile (orphaned)'
    ELSE '✅ Has profile'
  END as status
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE u.email IN (
  'josh.sturgeon@gmail.com',
  -- Add other test emails here if needed
  'test@example.com'
)
ORDER BY u.created_at DESC;

-- 2. Delete orphaned users (CAREFUL - this will permanently delete)
-- Uncomment the line below and run it to delete the orphaned user:

-- DELETE FROM auth.users WHERE email = 'josh.sturgeon@gmail.com';

-- 3. Verify deletion
SELECT 
  u.id,
  u.email,
  u.created_at
FROM auth.users u
WHERE u.email = 'josh.sturgeon@gmail.com';
-- Should return 0 rows after deletion

-- =============================================================================
-- VERIFICATION QUERIES: Check what exists for a user
-- =============================================================================

-- Check auth user
SELECT id, email, created_at, email_confirmed_at
FROM auth.users 
WHERE email = 'josh.sturgeon@gmail.com';

-- Check profile
SELECT id, account_id, name, phone, is_primary, created_at
FROM profiles
WHERE id IN (SELECT id FROM auth.users WHERE email = 'josh.sturgeon@gmail.com');

-- Check account
SELECT a.id, a.name, a.stripe_customer_id, a.stripe_subscription_id, a.plan_type, a.subscription_status
FROM accounts a
WHERE a.owner_id IN (SELECT id FROM auth.users WHERE email = 'josh.sturgeon@gmail.com');

-- Check signup attempts
SELECT email, phone, ip_address, success, blocked_reason, created_at
FROM signup_attempts
WHERE email = 'josh.sturgeon@gmail.com'
ORDER BY created_at DESC
LIMIT 5;

-- =============================================================================
-- COMPLETE CLEANUP: Remove all traces of a test email
-- =============================================================================

-- Run these in order to completely remove a test account:

-- Step 1: Delete from signup_attempts (optional - keeps history clean)
-- DELETE FROM signup_attempts WHERE email = 'josh.sturgeon@gmail.com';

-- Step 2: Delete auth user (this will CASCADE delete profile and account via FK constraints)
-- DELETE FROM auth.users WHERE email = 'josh.sturgeon@gmail.com';

-- Step 3: Verify everything is gone
/*
SELECT 'auth.users' as table_name, count(*) as count FROM auth.users WHERE email = 'josh.sturgeon@gmail.com'
UNION ALL
SELECT 'profiles', count(*) FROM profiles WHERE id IN (SELECT id FROM auth.users WHERE email = 'josh.sturgeon@gmail.com')
UNION ALL
SELECT 'accounts', count(*) FROM accounts WHERE owner_id IN (SELECT id FROM auth.users WHERE email = 'josh.sturgeon@gmail.com');
*/
