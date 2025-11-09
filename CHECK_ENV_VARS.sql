-- Run this to verify what was created in the most recent signup attempt
-- This helps diagnose where the signup process is failing

WITH latest_user AS (
  SELECT
    id,
    email,
    created_at,
    raw_user_meta_data
  FROM auth.users
  ORDER BY created_at DESC
  LIMIT 1
)
SELECT
  'User' as record_type,
  lu.id::text as id,
  lu.email as email,
  lu.created_at,
  'User created successfully' as status
FROM latest_user lu

UNION ALL

SELECT
  'Account' as record_type,
  a.id::text as id,
  a.name as email,
  a.created_at,
  CASE
    WHEN a.stripe_customer_id IS NOT NULL AND a.stripe_subscription_id IS NOT NULL
    THEN 'Account + Stripe created ✓'
    WHEN a.stripe_customer_id IS NOT NULL
    THEN 'Account created, subscription missing ✗'
    ELSE 'Account exists, Stripe not created ✗'
  END as status
FROM latest_user lu
LEFT JOIN accounts a ON a.owner_id = lu.id

UNION ALL

SELECT
  'Profile' as record_type,
  p.id::text as id,
  p.name as email,
  p.created_at,
  CASE
    WHEN p.id IS NOT NULL THEN 'Profile created ✓'
    ELSE 'Profile not created ✗'
  END as status
FROM latest_user lu
LEFT JOIN profiles p ON p.id = lu.id

UNION ALL

SELECT
  'Signup Attempt' as record_type,
  NULL as id,
  sa.email,
  sa.created_at,
  CASE
    WHEN sa.success THEN 'Success ✓'
    ELSE 'Failed: ' || COALESCE(sa.blocked_reason, 'Unknown reason')
  END as status
FROM latest_user lu
LEFT JOIN signup_attempts sa ON sa.email = lu.email
WHERE sa.created_at >= lu.created_at - interval '1 minute'

ORDER BY created_at DESC NULLS LAST;
