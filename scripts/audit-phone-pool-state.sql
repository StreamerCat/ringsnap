-- ═══════════════════════════════════════════════════════════════════════════
-- Phone Number Pool State Audit
-- ═══════════════════════════════════════════════════════════════════════════

\echo '═══════════════════════════════════════════════════════════'
\echo 'PHONE NUMBER POOL STATE AUDIT'
\echo '═══════════════════════════════════════════════════════════'
\echo ''

-- ============================================================================
-- 1. LIFECYCLE STATUS DISTRIBUTION
-- ============================================================================
\echo '📊 LIFECYCLE STATUS DISTRIBUTION:'
\echo ''

SELECT
  COALESCE(lifecycle_status::text, 'NULL') as status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage
FROM phone_numbers
GROUP BY lifecycle_status
ORDER BY count DESC;

\echo ''

-- ============================================================================
-- 2. NUMBERS IN COOLDOWN
-- ============================================================================
\echo '❄️  NUMBERS IN COOLDOWN (first 10):'
\echo ''

SELECT
  COALESCE(e164_number, phone_number) as phone,
  lifecycle_status,
  cooldown_until,
  released_at,
  EXTRACT(days FROM (cooldown_until - now())) as days_remaining
FROM phone_numbers
WHERE lifecycle_status = 'cooldown'
ORDER BY cooldown_until
LIMIT 10;

\echo ''

-- ============================================================================
-- 3. NUMBERS IN POOL
-- ============================================================================
\echo '🏊 NUMBERS IN POOL (first 10):'
\echo ''

SELECT
  COALESCE(e164_number, phone_number) as phone,
  lifecycle_status,
  cooldown_until,
  last_call_at,
  EXTRACT(days FROM (now() - last_call_at)) as days_since_last_call,
  is_reserved,
  released_at
FROM phone_numbers
WHERE lifecycle_status = 'pool'
ORDER BY released_at NULLS LAST
LIMIT 10;

\echo ''
\echo 'Pool count summary:'
SELECT COUNT(*) as total_in_pool FROM phone_numbers WHERE lifecycle_status = 'pool';

\echo ''

-- ============================================================================
-- 4. NUMBERS IN RELEASED STATE
-- ============================================================================
\echo '📤 NUMBERS IN RELEASED STATE (first 10):'
\echo ''

SELECT
  COALESCE(e164_number, phone_number) as phone,
  lifecycle_status,
  released_at,
  EXTRACT(days FROM (now() - released_at)) as days_since_release
FROM phone_numbers
WHERE lifecycle_status = 'released'
ORDER BY released_at NULLS LAST
LIMIT 10;

\echo ''
\echo 'Released count summary:'
SELECT COUNT(*) as total_released FROM phone_numbers WHERE lifecycle_status = 'released';

\echo ''

-- ============================================================================
-- 5. ACTIVE ACCOUNT ASSIGNMENTS
-- ============================================================================
\echo '👤 ACTIVE ACCOUNT ASSIGNMENTS (first 10):'
\echo ''

SELECT
  COALESCE(pn.e164_number, pn.phone_number) as phone,
  pn.lifecycle_status,
  LEFT(pn.assigned_account_id::text, 8) as account_id,
  a.subscription_status,
  pn.assigned_at
FROM phone_numbers pn
LEFT JOIN accounts a ON a.id = pn.assigned_account_id
WHERE pn.lifecycle_status = 'assigned'
ORDER BY pn.assigned_at DESC
LIMIT 10;

\echo ''
\echo 'Assigned count summary:'
SELECT COUNT(*) as total_assigned FROM phone_numbers WHERE lifecycle_status = 'assigned';

\echo ''

-- ============================================================================
-- 6. CHECK SPECIFIC NUMBER: +19705074433
-- ============================================================================
\echo '🔍 CHECKING SPECIFIC NUMBER: +19705074433 (recently purchased):'
\echo ''

SELECT
  COALESCE(e164_number, phone_number) as phone,
  lifecycle_status,
  assigned_account_id,
  vapi_phone_id,
  created_at,
  assigned_at,
  status as legacy_status
FROM phone_numbers
WHERE phone_number = '+19705074433' OR e164_number = '+19705074433';

\echo ''

-- ============================================================================
-- 7. ALLOCATOR ELIGIBILITY SIMULATION
-- ============================================================================
\echo '🧪 ALLOCATOR ELIGIBILITY SIMULATION (10-day silence rule):'
\echo ''

WITH pool_numbers AS (
  SELECT
    *,
    CASE
      WHEN cooldown_until IS NULL OR cooldown_until <= now() THEN true
      ELSE false
    END as cooldown_ok,
    CASE
      WHEN last_call_at IS NULL OR last_call_at < (now() - interval '10 days') THEN true
      ELSE false
    END as silence_ok
  FROM phone_numbers
  WHERE lifecycle_status = 'pool'
)
SELECT
  COUNT(*) as total_pool,
  COUNT(*) FILTER (WHERE cooldown_ok) as cooldown_passed,
  COUNT(*) FILTER (WHERE silence_ok) as silence_passed,
  COUNT(*) FILTER (WHERE cooldown_ok AND silence_ok) as fully_eligible
FROM pool_numbers;

\echo ''
\echo 'Fully eligible numbers (would be allocated):'

SELECT
  COALESCE(e164_number, phone_number) as phone,
  cooldown_until,
  last_call_at,
  released_at,
  EXTRACT(days FROM (now() - last_call_at)) as days_since_last_call
FROM phone_numbers
WHERE lifecycle_status = 'pool'
  AND (cooldown_until IS NULL OR cooldown_until <= now())
  AND (last_call_at IS NULL OR last_call_at < (now() - interval '10 days'))
ORDER BY released_at NULLS FIRST
LIMIT 10;

\echo ''

-- ============================================================================
-- 8. BLACKLISTED NUMBERS CHECK
-- ============================================================================
\echo '🚫 BLACKLISTED NUMBERS STATUS:'
\echo ''

SELECT
  COALESCE(e164_number, phone_number) as phone,
  lifecycle_status,
  assigned_account_id,
  vapi_phone_id,
  status as legacy_status
FROM phone_numbers
WHERE phone_number IN ('+19704231415', '+19705168481')
   OR e164_number IN ('+19704231415', '+19705168481');

\echo ''

-- ============================================================================
-- 9. NUMBERS WITH NO LIFECYCLE STATUS
-- ============================================================================
\echo '⚠️  NUMBERS WITH NULL LIFECYCLE STATUS:'
\echo ''

SELECT
  COALESCE(e164_number, phone_number) as phone,
  status as legacy_status,
  account_id,
  created_at
FROM phone_numbers
WHERE lifecycle_status IS NULL
LIMIT 10;

\echo ''
SELECT COUNT(*) as total_null_lifecycle FROM phone_numbers WHERE lifecycle_status IS NULL;

\echo ''
\echo '═══════════════════════════════════════════════════════════'
\echo 'END OF AUDIT'
\echo '═══════════════════════════════════════════════════════════'
