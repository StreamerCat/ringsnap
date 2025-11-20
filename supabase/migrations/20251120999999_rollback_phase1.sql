-- ROLLBACK MIGRATION: Phase 1 - Unified Signup Engine
-- Purpose: Complete rollback of all Phase 1 changes if needed
-- Date: 2025-11-20
-- WARNING: This will DROP new tables and lose data in them. Only use in emergency.

-- ==============================================================================
-- INSTRUCTIONS FOR USE
-- ==============================================================================
--
-- To rollback Phase 1 migrations:
-- 1. Backup your database first
-- 2. Run: psql -h your-host -U postgres -d postgres -f supabase/migrations/20251120999999_rollback_phase1.sql
-- 3. Or: npx supabase db reset (resets to last known good state)
--
-- This rollback will:
-- ✓ Drop all new functions/stored procedures
-- ✓ Drop all new views
-- ✓ Drop new tables (orphaned_stripe_resources, provisioning_state_transitions)
-- ✓ Remove new columns (signup_channel, sales_rep_id, provisioning_stage)
-- ✓ Restore old columns (source, sales_rep_name) with migrated data
-- ✓ Drop new enum types
--
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- STEP 1: Drop new stored procedures and functions
-- ==============================================================================

DROP FUNCTION IF EXISTS public.create_account_transaction(TEXT, TEXT, TEXT, TEXT, signup_channel_type, UUID, JSONB, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.create_auth_user_internal(TEXT, TEXT, JSONB) CASCADE;
DROP FUNCTION IF EXISTS public.log_state_transition(UUID, provisioning_stage, provisioning_stage, TEXT, TEXT, JSONB) CASCADE;
DROP FUNCTION IF EXISTS public.get_account_provisioning_history(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.email_exists(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_account_by_email(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.log_orphaned_stripe_resource(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) CASCADE;
DROP FUNCTION IF EXISTS public.is_valid_e164_phone(TEXT) CASCADE;

-- Drop trigger function for orphaned_stripe_resources
DROP FUNCTION IF EXISTS public.update_orphaned_stripe_resources_updated_at() CASCADE;

-- ==============================================================================
-- STEP 2: Drop new analytics views
-- ==============================================================================

DROP VIEW IF EXISTS public.sales_rep_performance CASCADE;
DROP VIEW IF EXISTS public.account_provisioning_timeline CASCADE;
DROP VIEW IF EXISTS public.stuck_provisioning_accounts CASCADE;
DROP VIEW IF EXISTS public.user_signup_analytics CASCADE;
DROP VIEW IF EXISTS public.user_signup_details CASCADE;
DROP VIEW IF EXISTS public.orphaned_resources_summary CASCADE;

-- ==============================================================================
-- STEP 3: Backup new column data before dropping
-- ==============================================================================

-- Create temporary backup tables
CREATE TEMP TABLE IF NOT EXISTS accounts_backup_phase1 AS
SELECT id, signup_channel, sales_rep_id, provisioning_stage FROM public.accounts;

CREATE TEMP TABLE IF NOT EXISTS profiles_backup_phase1 AS
SELECT id, signup_channel FROM public.profiles;

-- ==============================================================================
-- STEP 4: Restore old columns in accounts table
-- ==============================================================================

-- Add back old columns if they don't exist
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS sales_rep_name TEXT;

-- Migrate data from new columns to old columns
UPDATE public.accounts a
SET source = CASE
  WHEN ab.signup_channel = 'self_service'::signup_channel_type THEN 'website'
  WHEN ab.signup_channel = 'sales_guided'::signup_channel_type THEN 'sales'
  WHEN ab.signup_channel = 'enterprise'::signup_channel_type THEN 'partner'
  ELSE 'website'
END
FROM accounts_backup_phase1 ab
WHERE a.id = ab.id AND ab.signup_channel IS NOT NULL;

-- Migrate sales_rep_id to sales_rep_name (best effort)
UPDATE public.accounts a
SET sales_rep_name = COALESCE(
  u.raw_user_meta_data->>'name',
  u.email
)
FROM accounts_backup_phase1 ab
JOIN auth.users u ON u.id = ab.sales_rep_id
WHERE a.id = ab.id AND ab.sales_rep_id IS NOT NULL;

-- ==============================================================================
-- STEP 5: Drop new columns from accounts table
-- ==============================================================================

ALTER TABLE public.accounts DROP COLUMN IF EXISTS provisioning_stage;
ALTER TABLE public.accounts DROP COLUMN IF EXISTS signup_channel;
ALTER TABLE public.accounts DROP COLUMN IF EXISTS sales_rep_id;

-- ==============================================================================
-- STEP 6: Drop new columns from profiles table
-- ==============================================================================

-- Restore old source column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS source TEXT;

UPDATE public.profiles p
SET source = CASE
  WHEN pb.signup_channel = 'self_service'::signup_channel_type THEN 'website'
  WHEN pb.signup_channel = 'sales_guided'::signup_channel_type THEN 'sales'
  WHEN pb.signup_channel = 'enterprise'::signup_channel_type THEN 'partner'
  ELSE 'website'
END
FROM profiles_backup_phase1 pb
WHERE p.id = pb.id AND pb.signup_channel IS NOT NULL;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS signup_channel;

-- ==============================================================================
-- STEP 7: Drop new tables (WARNING: Data loss)
-- ==============================================================================

DROP TABLE IF EXISTS public.provisioning_state_transitions CASCADE;
DROP TABLE IF EXISTS public.orphaned_stripe_resources CASCADE;

-- ==============================================================================
-- STEP 8: Restore old phone field names (reverse of migration 5)
-- ==============================================================================

-- Rename phone_number back to phone_number_e164
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'phone_number'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'phone_number_e164'
  ) THEN
    ALTER TABLE public.accounts RENAME COLUMN phone_number TO phone_number_e164;
  END IF;
END $$;

-- Restore vapi_phone_number column
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS vapi_phone_number TEXT;
UPDATE public.accounts SET vapi_phone_number = phone_number_e164 WHERE vapi_phone_number IS NULL;

-- ==============================================================================
-- STEP 9: Drop indexes created in Phase 1
-- ==============================================================================

DROP INDEX IF EXISTS public.idx_accounts_signup_channel;
DROP INDEX IF EXISTS public.idx_accounts_sales_rep_id;
DROP INDEX IF EXISTS public.idx_accounts_provisioning_stage;
DROP INDEX IF EXISTS public.idx_accounts_phone_number;
DROP INDEX IF EXISTS public.idx_profiles_signup_channel;
DROP INDEX IF EXISTS public.idx_phone_numbers_vapi_id;
DROP INDEX IF EXISTS public.idx_orphaned_stripe_status;
DROP INDEX IF EXISTS public.idx_orphaned_stripe_correlation;
DROP INDEX IF EXISTS public.idx_orphaned_stripe_created_at;
DROP INDEX IF EXISTS public.idx_orphaned_stripe_customer_id;
DROP INDEX IF EXISTS public.idx_pst_account_id;
DROP INDEX IF EXISTS public.idx_pst_correlation_id;
DROP INDEX IF EXISTS public.idx_pst_created_at;
DROP INDEX IF EXISTS public.idx_pst_to_stage;
DROP INDEX IF EXISTS public.idx_pst_account_stage;

-- ==============================================================================
-- STEP 10: Drop enum types (must be last)
-- ==============================================================================

-- Drop enum types (CASCADE will drop dependent columns)
DROP TYPE IF EXISTS provisioning_stage CASCADE;
DROP TYPE IF EXISTS signup_channel_type CASCADE;

-- ==============================================================================
-- STEP 11: Cleanup temporary tables
-- ==============================================================================

DROP TABLE IF EXISTS accounts_backup_phase1;
DROP TABLE IF EXISTS profiles_backup_phase1;

COMMIT;

-- ==============================================================================
-- VERIFICATION QUERIES (run after rollback)
-- ==============================================================================

-- Check old columns restored
-- SELECT source, sales_rep_name FROM public.accounts LIMIT 5;

-- Check new columns removed
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'accounts' AND column_name IN ('signup_channel', 'sales_rep_id', 'provisioning_stage');

-- Should return 0 rows

-- ==============================================================================
-- POST-ROLLBACK NOTES
-- ==============================================================================
--
-- After running this rollback:
-- 1. Data from new columns has been migrated back to old columns
-- 2. New tables (orphaned_stripe_resources, provisioning_state_transitions) are DELETED
-- 3. You will need to:
--    - Revert code changes that reference new columns
--    - Regenerate TypeScript types: npx supabase gen types typescript --linked
--    - Test that old signup flow works
--
-- To re-apply Phase 1 migrations:
-- 1. Delete this rollback migration file
-- 2. Run: npx supabase db push
--
-- ==============================================================================
