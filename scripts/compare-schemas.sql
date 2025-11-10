-- =====================================================
-- Existing Supabase Instance Schema Comparison Tool
-- =====================================================
-- Run this in your EXISTING Supabase SQL Editor
-- Copy the output and compare with expected schema
-- =====================================================

-- 1. SUMMARY OVERVIEW
-- =====================================================
SELECT 'SUMMARY' as section, json_build_object(
  'total_tables', (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'),
  'total_users', (SELECT COUNT(*) FROM auth.users),
  'oldest_user', (SELECT MIN(created_at) FROM auth.users),
  'newest_user', (SELECT MAX(created_at) FROM auth.users),
  'has_migrations_tracking', EXISTS(SELECT FROM supabase_migrations.schema_migrations)
) as data;

-- 2. ALL TABLES WITH ROW COUNTS
-- =====================================================
SELECT 'TABLES' as section, json_agg(json_build_object(
  'table_name', t.tablename,
  'row_count', t.n_live_tup,
  'column_count', (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t.tablename)
) ORDER BY t.tablename) as data
FROM pg_stat_user_tables t
WHERE t.schemaname = 'public';

-- 3. EXPECTED TABLES FROM MIGRATIONS (for reference)
-- =====================================================
-- Check which of these exist in your instance:
SELECT 'EXPECTED_TABLES_STATUS' as section, json_agg(json_build_object(
  'table_name', expected_table,
  'exists', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = expected_table),
  'row_count', CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = expected_table)
    THEN (SELECT n_live_tup FROM pg_stat_user_tables WHERE schemaname = 'public' AND tablename = expected_table)
    ELSE 0 END
)) as data
FROM (VALUES
  ('accounts'),
  ('profiles'),
  ('user_roles'),
  ('auth_tokens'),
  ('auth_events'),
  ('email_events'),
  ('passkeys'),
  ('user_sessions'),
  ('rate_limits'),
  ('staff_roles'),
  ('account_members'),
  ('account_credits'),
  ('phone_numbers'),
  ('provisioning_queue'),
  ('subscription_plans'),
  ('invoices'),
  ('referrals'),
  ('usage_records')
) as t(expected_table);

-- 4. DETAILED SCHEMA FOR KEY TABLES
-- =====================================================
SELECT 'ACCOUNTS_SCHEMA' as section, json_agg(json_build_object(
  'column_name', column_name,
  'data_type', data_type,
  'is_nullable', is_nullable,
  'column_default', column_default
) ORDER BY ordinal_position) as data
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'accounts';

SELECT 'PROFILES_SCHEMA' as section, json_agg(json_build_object(
  'column_name', column_name,
  'data_type', data_type,
  'is_nullable', is_nullable,
  'column_default', column_default
) ORDER BY ordinal_position) as data
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles';

-- 5. RLS POLICIES COUNT
-- =====================================================
SELECT 'RLS_POLICIES' as section, json_agg(json_build_object(
  'table_name', tablename,
  'policy_count', COUNT(*)
)) as data
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- 6. CUSTOM FUNCTIONS
-- =====================================================
SELECT 'CUSTOM_FUNCTIONS' as section, json_agg(json_build_object(
  'function_name', p.proname,
  'arguments', pg_get_function_arguments(p.oid),
  'return_type', pg_get_function_result(p.oid)
) ORDER BY p.proname) as data
FROM pg_proc p
LEFT JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname NOT LIKE 'pg_%';

-- 7. ENUMS (Custom Types)
-- =====================================================
SELECT 'ENUMS' as section, json_agg(json_build_object(
  'enum_name', t.typname,
  'values', enum_range(NULL::information_schema.yes_or_no)::text[]
)) as data
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE n.nspname = 'public'
GROUP BY t.typname;

-- 8. FOREIGN KEY RELATIONSHIPS
-- =====================================================
SELECT 'FOREIGN_KEYS' as section, json_agg(json_build_object(
  'table', tc.table_name,
  'constraint', tc.constraint_name,
  'references', ccu.table_name,
  'column', kcu.column_name,
  'foreign_column', ccu.column_name
) ORDER BY tc.table_name) as data
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public';

-- 9. INDEXES
-- =====================================================
SELECT 'INDEXES' as section, json_agg(json_build_object(
  'table', tablename,
  'index', indexname,
  'definition', indexdef
) ORDER BY tablename, indexname) as data
FROM pg_indexes
WHERE schemaname = 'public';

-- 10. APPLIED MIGRATIONS (if tracked)
-- =====================================================
SELECT 'APPLIED_MIGRATIONS' as section,
  CASE WHEN EXISTS(SELECT FROM supabase_migrations.schema_migrations)
    THEN (SELECT json_agg(json_build_object(
      'version', version,
      'name', name,
      'executed_at', executed_at
    ) ORDER BY version) FROM supabase_migrations.schema_migrations)
    ELSE '[]'::json
  END as data;

-- 11. DATA QUALITY CHECKS
-- =====================================================
SELECT 'DATA_QUALITY' as section, json_build_object(
  'users_without_profiles', (
    SELECT COUNT(*) FROM auth.users u
    WHERE NOT EXISTS(SELECT 1 FROM profiles p WHERE p.id = u.id)
  ),
  'profiles_without_accounts', (
    SELECT COUNT(*) FROM profiles p
    WHERE NOT EXISTS(SELECT 1 FROM accounts a WHERE a.id = p.account_id)
  ),
  'orphaned_user_roles', (
    SELECT COUNT(*) FROM user_roles ur
    WHERE NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id = ur.user_id)
  )
) as data;

-- 12. STORAGE BUCKETS
-- =====================================================
SELECT 'STORAGE_BUCKETS' as section, json_agg(json_build_object(
  'bucket_name', name,
  'public', public,
  'created_at', created_at
)) as data
FROM storage.buckets;
