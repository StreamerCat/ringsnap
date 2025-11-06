-- Hybrid Trial Deployment Verification Script
-- Run this in Supabase SQL Editor after deploying migration
-- All checks should pass for successful deployment

-- ============================================
-- CHECK 1: Verify new columns exist
-- ============================================
DO $$
DECLARE
  column_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO column_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'accounts'
    AND column_name IN ('has_payment_method', 'trial_status', 'trial_type');

  IF column_count = 3 THEN
    RAISE NOTICE '✅ CHECK 1 PASSED: All 3 new columns exist on accounts table';
  ELSE
    RAISE EXCEPTION '❌ CHECK 1 FAILED: Expected 3 columns, found %', column_count;
  END IF;
END $$;

-- ============================================
-- CHECK 2: Verify column defaults
-- ============================================
DO $$
DECLARE
  has_payment_default TEXT;
  trial_status_default TEXT;
  trial_type_default TEXT;
BEGIN
  SELECT column_default INTO has_payment_default
  FROM information_schema.columns
  WHERE table_name = 'accounts' AND column_name = 'has_payment_method';

  SELECT column_default INTO trial_status_default
  FROM information_schema.columns
  WHERE table_name = 'accounts' AND column_name = 'trial_status';

  SELECT column_default INTO trial_type_default
  FROM information_schema.columns
  WHERE table_name = 'accounts' AND column_name = 'trial_type';

  IF has_payment_default = 'false'
    AND trial_status_default = '''active''::text'
    AND trial_type_default = '''card_required''::text' THEN
    RAISE NOTICE '✅ CHECK 2 PASSED: All column defaults are correct';
  ELSE
    RAISE EXCEPTION '❌ CHECK 2 FAILED: Defaults incorrect. has_payment: %, status: %, type: %',
      has_payment_default, trial_status_default, trial_type_default;
  END IF;
END $$;

-- ============================================
-- CHECK 3: Verify indexes exist
-- ============================================
DO $$
DECLARE
  index_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'accounts'
    AND indexname IN (
      'idx_accounts_trial_status',
      'idx_accounts_trial_type',
      'idx_accounts_payment_method',
      'idx_accounts_cardless_pending'
    );

  IF index_count = 4 THEN
    RAISE NOTICE '✅ CHECK 3 PASSED: All 4 indexes created successfully';
  ELSE
    RAISE EXCEPTION '❌ CHECK 3 FAILED: Expected 4 indexes, found %', index_count;
  END IF;
END $$;

-- ============================================
-- CHECK 4: Verify check constraints exist
-- ============================================
DO $$
DECLARE
  constraint_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO constraint_count
  FROM information_schema.table_constraints
  WHERE table_schema = 'public'
    AND table_name = 'accounts'
    AND constraint_type = 'CHECK'
    AND constraint_name IN ('check_trial_status', 'check_trial_type');

  IF constraint_count = 2 THEN
    RAISE NOTICE '✅ CHECK 4 PASSED: Both check constraints exist';
  ELSE
    RAISE EXCEPTION '❌ CHECK 4 FAILED: Expected 2 constraints, found %', constraint_count;
  END IF;
END $$;

-- ============================================
-- CHECK 5: Verify trial_events table exists
-- ============================================
DO $$
DECLARE
  table_exists BOOLEAN;
  column_count INTEGER;
BEGIN
  SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'trial_events'
  ) INTO table_exists;

  IF NOT table_exists THEN
    RAISE EXCEPTION '❌ CHECK 5 FAILED: trial_events table does not exist';
  END IF;

  SELECT COUNT(*)
  INTO column_count
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'trial_events';

  IF column_count >= 7 THEN
    RAISE NOTICE '✅ CHECK 5 PASSED: trial_events table exists with % columns', column_count;
  ELSE
    RAISE EXCEPTION '❌ CHECK 5 FAILED: trial_events has only % columns (expected >= 7)', column_count;
  END IF;
END $$;

-- ============================================
-- CHECK 6: Verify trial_events RLS enabled
-- ============================================
DO $$
DECLARE
  rls_enabled BOOLEAN;
BEGIN
  SELECT relrowsecurity
  INTO rls_enabled
  FROM pg_class
  WHERE relname = 'trial_events' AND relnamespace = 'public'::regnamespace;

  IF rls_enabled THEN
    RAISE NOTICE '✅ CHECK 6 PASSED: RLS enabled on trial_events';
  ELSE
    RAISE EXCEPTION '❌ CHECK 6 FAILED: RLS not enabled on trial_events';
  END IF;
END $$;

-- ============================================
-- CHECK 7: Verify log_trial_event function exists
-- ============================================
DO $$
DECLARE
  function_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'log_trial_event'
  ) INTO function_exists;

  IF function_exists THEN
    RAISE NOTICE '✅ CHECK 7 PASSED: log_trial_event function exists';
  ELSE
    RAISE EXCEPTION '❌ CHECK 7 FAILED: log_trial_event function not found';
  END IF;
END $$;

-- ============================================
-- CHECK 8: Test log_trial_event function
-- ============================================
DO $$
DECLARE
  test_event_id UUID;
  test_account_id UUID;
BEGIN
  -- Get a real account ID (or create a dummy one)
  SELECT id INTO test_account_id FROM accounts LIMIT 1;

  IF test_account_id IS NULL THEN
    RAISE NOTICE '⚠️  CHECK 8 SKIPPED: No accounts exist yet to test with';
  ELSE
    -- Test the function
    SELECT log_trial_event(
      test_account_id,
      'test_event',
      '{"test": true}'::jsonb,
      'deployment-verification-script',
      '127.0.0.1'
    ) INTO test_event_id;

    IF test_event_id IS NOT NULL THEN
      RAISE NOTICE '✅ CHECK 8 PASSED: log_trial_event function works (event_id: %)', test_event_id;
      -- Clean up test event
      DELETE FROM trial_events WHERE id = test_event_id;
    ELSE
      RAISE EXCEPTION '❌ CHECK 8 FAILED: log_trial_event returned NULL';
    END IF;
  END IF;
END $$;

-- ============================================
-- CHECK 9: Verify existing accounts backfilled
-- ============================================
DO $$
DECLARE
  total_accounts INTEGER;
  accounts_with_values INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_accounts FROM accounts;

  SELECT COUNT(*) INTO accounts_with_values
  FROM accounts
  WHERE has_payment_method IS NOT NULL
    AND trial_status IS NOT NULL
    AND trial_type IS NOT NULL;

  IF total_accounts = 0 THEN
    RAISE NOTICE '⚠️  CHECK 9 SKIPPED: No existing accounts to verify';
  ELSIF total_accounts = accounts_with_values THEN
    RAISE NOTICE '✅ CHECK 9 PASSED: All % existing accounts backfilled successfully', total_accounts;
  ELSE
    RAISE EXCEPTION '❌ CHECK 9 FAILED: Only % of % accounts have trial values',
      accounts_with_values, total_accounts;
  END IF;
END $$;

-- ============================================
-- CHECK 10: Verify enum constraints work
-- ============================================
DO $$
BEGIN
  -- Try to insert invalid trial_status (should fail)
  BEGIN
    INSERT INTO accounts (
      id, trial_status, trial_type, has_payment_method
    ) VALUES (
      gen_random_uuid(), 'invalid_status', 'card_required', false
    );
    RAISE EXCEPTION '❌ CHECK 10 FAILED: Invalid trial_status was accepted';
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE '✅ CHECK 10 PASSED: Check constraints are enforcing enum values';
  END;
END $$;

-- ============================================
-- SUMMARY QUERY
-- ============================================
SELECT
  '🎉 All deployment checks passed!' as status,
  NOW() as verified_at;

-- ============================================
-- BONUS: Show current trial distribution
-- ============================================
SELECT
  '📊 Current Trial Distribution' as section;

SELECT
  trial_type,
  trial_status,
  COUNT(*) as count,
  SUM(CASE WHEN has_payment_method THEN 1 ELSE 0 END) as with_payment
FROM accounts
GROUP BY trial_type, trial_status
ORDER BY trial_type, trial_status;

-- ============================================
-- BONUS: Show trial_events table status
-- ============================================
SELECT
  '📈 Trial Events Status' as section;

SELECT
  COUNT(*) as total_events,
  COUNT(DISTINCT account_id) as unique_accounts,
  COUNT(DISTINCT event_type) as event_types
FROM trial_events;

SELECT
  event_type,
  COUNT(*) as count,
  MAX(created_at) as most_recent
FROM trial_events
GROUP BY event_type
ORDER BY count DESC;
