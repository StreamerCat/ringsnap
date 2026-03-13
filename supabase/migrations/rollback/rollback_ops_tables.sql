-- Rollback script for RingSnap Phase 1 GTM Ops tables
-- Safe to run at any time. Zero impact on existing tables.
-- These tables have no foreign keys FROM existing tables, only TO them.
--
-- How to use:
--   psql $DATABASE_URL -f supabase/migrations/rollback/rollback_ops_tables.sql
--   OR via Supabase SQL editor
--
-- After running this, the ringsnap_ops_flow Python service will fail to write
-- but the existing TypeScript stack is completely unaffected.

BEGIN;

-- Drop policies first (required before dropping tables)
DROP POLICY IF EXISTS "service_role_all_ops_exec_log" ON ops_execution_log;
DROP POLICY IF EXISTS "staff_view_ops_exec_log" ON ops_execution_log;
DROP POLICY IF EXISTS "service_role_all_pending_signups" ON pending_signups;
DROP POLICY IF EXISTS "staff_view_pending_signups" ON pending_signups;

-- Drop tables (CASCADE drops indexes and triggers automatically)
DROP TABLE IF EXISTS ops_execution_log CASCADE;
DROP TABLE IF EXISTS pending_signups CASCADE;

COMMIT;

-- Done. Existing accounts, signup_leads, provisioning_jobs, etc. are untouched.
