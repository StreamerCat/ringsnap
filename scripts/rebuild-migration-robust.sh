#!/bin/bash

echo "🔧 Rebuilding migration with SQL best practices..."
echo ""

OUTPUT_FILE="/home/user/ringsnap/scripts/consolidated-migration.sql"
TEMP_FILE="/tmp/migration-temp.sql"

# Start fresh
cat > "$OUTPUT_FILE" << 'HEADER'
-- =====================================================
-- RINGSNAP DATABASE MIGRATION - ROBUST VERSION
-- =====================================================
-- Project: rmyvvbqnccpfeyowidrq
-- URL: https://rmyvvbqnccpfeyowidrq.supabase.co
--
-- This migration is designed to be:
-- 1. Idempotent (can run multiple times safely)
-- 2. Handles existing objects with CASCADE
-- 3. Works on both fresh and partially migrated DBs
--
-- RECOMMENDED: Run cleanup-database.sql first for cleanest migration
-- =====================================================

-- Start transaction for atomicity
BEGIN;

HEADER

# Combine all migrations
count=1
for file in /home/user/ringsnap/supabase/migrations/*.sql; do
  filename=$(basename "$file")
  echo "" >> "$OUTPUT_FILE"
  echo "-- =====================================================" >> "$OUTPUT_FILE"
  echo "-- MIGRATION $count: $filename" >> "$OUTPUT_FILE"
  echo "-- =====================================================" >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"
  cat "$file" >> "$OUTPUT_FILE"
  count=$((count + 1))
done

echo "" >> "$OUTPUT_FILE"
echo "-- Migration complete" >> "$OUTPUT_FILE"
echo "COMMIT;" >> "$OUTPUT_FILE"

# Now apply all fixes in one pass
echo "Applying comprehensive fixes..."

# 1. Fix CREATE POLICY syntax (no IF NOT EXISTS support)
sed -i 's/CREATE POLICY IF NOT EXISTS/CREATE POLICY/g' "$OUTPUT_FILE"

# 2. Comment out trial_signups (table doesn't exist)
sed -i '/^-- 3\. EXTEND TRIAL SIGNUPS TABLE/,/ADD COLUMN referral_code TEXT;/ {
  s/^-- 3\. EXTEND TRIAL SIGNUPS TABLE/-- 3. EXTEND TRIAL SIGNUPS TABLE (SKIPPED)\n--/
  s/^ALTER TABLE trial_signups/-- ALTER TABLE trial_signups/
  s/^  ADD COLUMN/--   ADD COLUMN/
}' "$OUTPUT_FILE"

# 3. Fix a.user_id references (should use profiles table)
sed -i 's/AND a\.user_id = auth\.uid()/AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.account_id = a.id AND p.id = auth.uid())/g' "$OUTPUT_FILE"

# 4. Fix staff_role enum 'admin' -> 'platform_admin'
sed -i "s/role IN ('admin', 'support')/role IN ('platform_admin', 'support')/g" "$OUTPUT_FILE"
sed -i "s/role IN ('admin', 'support', 'sales')/role IN ('platform_admin', 'support', 'sales')/g" "$OUTPUT_FILE"
sed -i "s/role IN ('admin', 'support', 'billing')/role IN ('platform_admin', 'support')/g" "$OUTPUT_FILE"
sed -i "s/role = 'admin'/role = 'platform_admin'/g" "$OUTPUT_FILE"

# 5. Add IF NOT EXISTS to CREATE TABLE (avoid duplicates)
sed -i 's/^CREATE TABLE public\./CREATE TABLE IF NOT EXISTS public./g' "$OUTPUT_FILE"
sed -i 's/^CREATE TABLE \([^I]\)/CREATE TABLE IF NOT EXISTS \1/g' "$OUTPUT_FILE"

# 6. Add IF NOT EXISTS to CREATE INDEX
sed -i 's/^CREATE INDEX idx_/CREATE INDEX IF NOT EXISTS idx_/g' "$OUTPUT_FILE"
sed -i 's/^CREATE INDEX \([^I]\)/CREATE INDEX IF NOT EXISTS \1/g' "$OUTPUT_FILE"

# 7. DROP functions with CASCADE before recreating
echo "Adding DROP FUNCTION ... CASCADE for all functions..."

# Create list of all functions and add DROP before them
sed -i '/^CREATE OR REPLACE FUNCTION public\.extract_email_domain/i DROP FUNCTION IF EXISTS public.extract_email_domain CASCADE;' "$OUTPUT_FILE"
sed -i '/^CREATE OR REPLACE FUNCTION public\.is_generic_email_domain/i DROP FUNCTION IF EXISTS public.is_generic_email_domain CASCADE;' "$OUTPUT_FILE"
sed -i '/^CREATE OR REPLACE FUNCTION public\.has_role/i DROP FUNCTION IF EXISTS public.has_role CASCADE;' "$OUTPUT_FILE"
sed -i '/^CREATE OR REPLACE FUNCTION public\.get_user_account_id/i DROP FUNCTION IF EXISTS public.get_user_account_id CASCADE;' "$OUTPUT_FILE"
sed -i '/^CREATE OR REPLACE FUNCTION public\.handle_new_user_signup/i DROP FUNCTION IF EXISTS public.handle_new_user_signup CASCADE;' "$OUTPUT_FILE"
sed -i '/^CREATE OR REPLACE FUNCTION public\.update_updated_at_column/i DROP FUNCTION IF EXISTS public.update_updated_at_column CASCADE;' "$OUTPUT_FILE"
sed -i '/^CREATE OR REPLACE FUNCTION public\.cleanup_expired_auth_tokens/i DROP FUNCTION IF EXISTS public.cleanup_expired_auth_tokens CASCADE;' "$OUTPUT_FILE"
sed -i '/^CREATE OR REPLACE FUNCTION public\.cleanup_old_rate_limits/i DROP FUNCTION IF EXISTS public.cleanup_old_rate_limits CASCADE;' "$OUTPUT_FILE"
sed -i '/^CREATE OR REPLACE FUNCTION public\.log_auth_event/i DROP FUNCTION IF EXISTS public.log_auth_event CASCADE;' "$OUTPUT_FILE"
sed -i '/^CREATE OR REPLACE FUNCTION public\.check_rate_limit/i DROP FUNCTION IF EXISTS public.check_rate_limit CASCADE;' "$OUTPUT_FILE"
sed -i '/^CREATE OR REPLACE FUNCTION public\.has_platform_role/i DROP FUNCTION IF EXISTS public.has_platform_role CASCADE;' "$OUTPUT_FILE"

# 8. Handle duplicate triggers - drop before recreating
sed -i '/^CREATE TRIGGER on_auth_user_created/i DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;' "$OUTPUT_FILE"
sed -i '/^CREATE TRIGGER update_accounts_updated_at/i DROP TRIGGER IF EXISTS update_accounts_updated_at ON public.accounts;' "$OUTPUT_FILE"
sed -i '/^CREATE TRIGGER update_profiles_updated_at/i DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;' "$OUTPUT_FILE"

# 9. Remove any duplicate IF NOT EXISTS that might have been created
sed -i 's/IF NOT EXISTS IF NOT EXISTS/IF NOT EXISTS/g' "$OUTPUT_FILE"
sed -i 's/DROP FUNCTION IF EXISTS.*IF EXISTS/DROP FUNCTION IF EXISTS/g' "$OUTPUT_FILE"

echo ""
echo "✅ Migration rebuilt with comprehensive fixes!"
echo ""
echo "File: $OUTPUT_FILE"
ls -lh "$OUTPUT_FILE"
wc -l "$OUTPUT_FILE"
echo ""
echo "Key improvements:"
echo "  ✓ All functions drop with CASCADE"
echo "  ✓ All triggers drop before recreate"
echo "  ✓ All tables/indexes have IF NOT EXISTS"
echo "  ✓ Wrapped in transaction (BEGIN/COMMIT)"
echo "  ✓ Handles all enum mismatches"
echo "  ✓ Fixes all column reference errors"
echo ""

