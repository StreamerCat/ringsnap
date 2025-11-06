-- RingSnap Test Verification SQL Queries
-- Run these in Supabase SQL Editor after testing

-- ============================================
-- TRIAL SIGNUP VERIFICATION
-- ============================================

-- 1. Find latest trial account
SELECT
  a.id as account_id,
  a.company_name,
  a.trade,
  a.vapi_phone_number,
  a.vapi_assistant_id,
  a.stripe_customer_id,
  a.provisioning_status,
  a.onboarding_completed,
  a.subscription_status,
  a.created_at,
  p.email,
  p.name,
  p.phone
FROM accounts a
JOIN profiles p ON p.account_id = a.id
WHERE p.email LIKE 'test-trial-%@example.com'
ORDER BY a.created_at DESC
LIMIT 5;

-- 2. Check trial phone number
SELECT
  pn.id,
  pn.phone_number,
  pn.vapi_phone_id,
  pn.area_code,
  pn.is_primary,
  pn.status,
  pn.created_at,
  a.company_name,
  p.email
FROM phone_numbers pn
JOIN accounts a ON a.id = pn.account_id
JOIN profiles p ON p.account_id = a.id
WHERE p.email LIKE 'test-trial-%@example.com'
ORDER BY pn.created_at DESC
LIMIT 5;

-- 3. Check trial assistant
SELECT
  ast.id,
  ast.vapi_assistant_id,
  ast.name,
  ast.voice_gender,
  ast.is_primary,
  ast.status,
  ast.created_at,
  a.company_name,
  p.email
FROM assistants ast
JOIN accounts a ON a.id = ast.account_id
JOIN profiles p ON p.account_id = a.id
WHERE p.email LIKE 'test-trial-%@example.com'
ORDER BY ast.created_at DESC
LIMIT 5;

-- ============================================
-- SALES SIGNUP VERIFICATION
-- ============================================

-- 4. Find latest sales account
SELECT
  a.id as account_id,
  a.company_name,
  a.trade,
  a.service_area,
  a.plan_type,
  a.subscription_status,
  -- CRITICAL FIELDS (were missing before fixes)
  a.stripe_customer_id,
  a.stripe_subscription_id,
  a.vapi_phone_number,
  a.vapi_assistant_id,
  a.provisioning_status,
  -- Sales specific
  a.phone_number_area_code,
  a.sales_rep_name,
  a.business_hours,
  a.assistant_gender,
  a.created_at,
  p.email,
  p.name,
  p.phone
FROM accounts a
JOIN profiles p ON p.account_id = a.id
WHERE p.email LIKE 'john.test-%@testhvac.com'
   OR a.sales_rep_name IS NOT NULL
ORDER BY a.created_at DESC
LIMIT 5;

-- 5. Check sales phone number
SELECT
  pn.id,
  pn.phone_number,
  pn.vapi_phone_id,
  pn.area_code,
  pn.is_primary,
  pn.status,
  pn.label,
  pn.created_at,
  a.company_name,
  a.plan_type,
  p.email
FROM phone_numbers pn
JOIN accounts a ON a.id = pn.account_id
JOIN profiles p ON p.account_id = a.id
WHERE p.email LIKE 'john.test-%@testhvac.com'
   OR a.sales_rep_name IS NOT NULL
ORDER BY pn.created_at DESC
LIMIT 5;

-- 6. Check sales assistant
SELECT
  ast.id,
  ast.vapi_assistant_id,
  ast.name,
  ast.voice_id,
  ast.voice_gender,
  ast.is_primary,
  ast.status,
  ast.created_at,
  a.company_name,
  a.plan_type,
  p.email
FROM assistants ast
JOIN accounts a ON a.id = ast.account_id
JOIN profiles p ON p.account_id = a.id
WHERE p.email LIKE 'john.test-%@testhvac.com'
   OR a.sales_rep_name IS NOT NULL
ORDER BY ast.created_at DESC
LIMIT 5;

-- ============================================
-- CHECK FOR COMMON ISSUES
-- ============================================

-- 7. Find accounts with missing Stripe IDs (SHOULD BE ZERO after fix)
SELECT
  a.id,
  a.company_name,
  a.subscription_status,
  a.plan_type,
  a.stripe_customer_id,
  a.stripe_subscription_id,
  a.sales_rep_name,
  a.created_at,
  p.email
FROM accounts a
JOIN profiles p ON p.account_id = a.id
WHERE a.subscription_status = 'active'
  AND (a.stripe_customer_id IS NULL OR a.stripe_subscription_id IS NULL)
ORDER BY a.created_at DESC;

-- 8. Find accounts with failed provisioning
SELECT
  a.id,
  a.company_name,
  a.provisioning_status,
  a.provisioning_error,
  a.vapi_phone_number,
  a.created_at,
  p.email
FROM accounts a
JOIN profiles p ON p.account_id = a.id
WHERE a.provisioning_status = 'failed'
ORDER BY a.created_at DESC
LIMIT 10;

-- 9. Find accounts without phone numbers (SHOULD BE ZERO)
SELECT
  a.id,
  a.company_name,
  a.provisioning_status,
  a.vapi_phone_number,
  a.subscription_status,
  a.created_at,
  p.email
FROM accounts a
JOIN profiles p ON p.account_id = a.id
WHERE a.onboarding_completed = true
  AND a.vapi_phone_number IS NULL
ORDER BY a.created_at DESC;

-- 10. Find accounts without assistants (SHOULD BE ZERO)
SELECT
  a.id,
  a.company_name,
  a.provisioning_status,
  a.vapi_assistant_id,
  a.subscription_status,
  a.created_at,
  p.email
FROM accounts a
JOIN profiles p ON p.account_id = a.id
WHERE a.onboarding_completed = true
  AND a.vapi_assistant_id IS NULL
ORDER BY a.created_at DESC;

-- ============================================
-- STATISTICS & HEALTH CHECK
-- ============================================

-- 11. Provisioning success rate (should be > 95%)
SELECT
  provisioning_status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM accounts
WHERE provisioning_status IS NOT NULL
GROUP BY provisioning_status
ORDER BY count DESC;

-- 12. Recent signups (last 24 hours)
SELECT
  DATE_TRUNC('hour', a.created_at) as signup_hour,
  COUNT(*) as signups,
  COUNT(CASE WHEN a.provisioning_status = 'completed' THEN 1 END) as provisioned,
  COUNT(CASE WHEN a.provisioning_status = 'failed' THEN 1 END) as failed
FROM accounts a
WHERE a.created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', a.created_at)
ORDER BY signup_hour DESC;

-- 13. Plan distribution
SELECT
  plan_type,
  COUNT(*) as count,
  COUNT(CASE WHEN subscription_status = 'active' THEN 1 END) as active,
  COUNT(CASE WHEN subscription_status = 'trial' THEN 1 END) as trial
FROM accounts
WHERE plan_type IS NOT NULL
GROUP BY plan_type
ORDER BY count DESC;

-- 14. Sales rep performance
SELECT
  sales_rep_name,
  COUNT(*) as total_sales,
  COUNT(CASE WHEN subscription_status = 'active' THEN 1 END) as active_subscriptions,
  COUNT(CASE WHEN provisioning_status = 'completed' THEN 1 END) as successfully_provisioned
FROM accounts
WHERE sales_rep_name IS NOT NULL
GROUP BY sales_rep_name
ORDER BY total_sales DESC;

-- ============================================
-- CLEANUP TEST DATA (USE WITH CAUTION!)
-- ============================================

-- UNCOMMENT TO DELETE TEST ACCOUNTS
-- WARNING: This will permanently delete test data!

/*
-- Delete trial test accounts
DELETE FROM accounts
WHERE id IN (
  SELECT a.id
  FROM accounts a
  JOIN profiles p ON p.account_id = a.id
  WHERE p.email LIKE 'test-trial-%@example.com'
);

-- Delete sales test accounts
DELETE FROM accounts
WHERE id IN (
  SELECT a.id
  FROM accounts a
  JOIN profiles p ON p.account_id = a.id
  WHERE p.email LIKE 'john.test-%@testhvac.com'
);
*/
