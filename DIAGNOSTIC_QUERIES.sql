-- =============================================================================
-- DIAGNOSTIC QUERIES - Run these in Supabase SQL Editor
-- =============================================================================

-- 1. Check what was created for the latest test user
SELECT 
  'auth.users' as table_name,
  id,
  email,
  created_at,
  email_confirmed_at
FROM auth.users 
WHERE email IN ('josh.sturgeon@mac.com', 'josh.sturgeon+test99@gmail.com')
ORDER BY created_at DESC
LIMIT 5;

-- 2. Check if profile exists
SELECT 
  'profiles' as table_name,
  id,
  account_id,
  name,
  phone,
  is_primary,
  source,
  created_at
FROM profiles 
WHERE id IN (
  SELECT id FROM auth.users 
  WHERE email IN ('josh.sturgeon@mac.com', 'josh.sturgeon+test99@gmail.com')
)
ORDER BY created_at DESC;

-- 3. Check if account exists
SELECT 
  'accounts' as table_name,
  id,
  name,
  owner_id,
  stripe_customer_id,
  stripe_subscription_id,
  plan_type,
  subscription_status,
  trial_start_date,
  trial_end_date,
  created_at
FROM accounts 
WHERE owner_id IN (
  SELECT id FROM auth.users 
  WHERE email IN ('josh.sturgeon@mac.com', 'josh.sturgeon+test99@gmail.com')
)
ORDER BY created_at DESC;

-- 4. Check signup attempts to see errors
SELECT 
  email,
  phone,
  ip_address,
  success,
  blocked_reason,
  created_at
FROM signup_attempts
WHERE email IN ('josh.sturgeon@mac.com', 'josh.sturgeon+test99@gmail.com')
ORDER BY created_at DESC
LIMIT 10;

-- 5. Summary: What got created?
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM auth.users WHERE email = 'josh.sturgeon@mac.com') 
    THEN '✅ Auth user created'
    ELSE '❌ Auth user missing'
  END as auth_status,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM profiles p 
      JOIN auth.users u ON p.id = u.id 
      WHERE u.email = 'josh.sturgeon@mac.com'
    ) 
    THEN '✅ Profile created'
    ELSE '❌ Profile missing'
  END as profile_status,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM accounts a 
      JOIN auth.users u ON a.owner_id = u.id 
      WHERE u.email = 'josh.sturgeon@mac.com'
    ) 
    THEN '✅ Account created'
    ELSE '❌ Account missing'
  END as account_status,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM accounts a 
      JOIN auth.users u ON a.owner_id = u.id 
      WHERE u.email = 'josh.sturgeon@mac.com'
      AND a.stripe_customer_id IS NOT NULL
    ) 
    THEN '✅ Stripe customer ID saved'
    ELSE '❌ Stripe customer ID missing'
  END as stripe_status;

-- 6. Get the exact user ID for troubleshooting
SELECT 
  id as user_id,
  email,
  'Use this ID to check edge function logs' as note
FROM auth.users
WHERE email = 'josh.sturgeon@mac.com';
