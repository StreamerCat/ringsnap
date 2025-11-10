#!/bin/bash

OUTPUT_FILE="/home/user/ringsnap/scripts/consolidated-migration.sql"

cat > "$OUTPUT_FILE" << 'HEADER'
-- =====================================================
-- RINGSNAP CONSOLIDATED DATABASE MIGRATION
-- =====================================================
-- Run this entire file in Supabase SQL Editor
-- Project: rmyvvbqnccpfeyowidrq
-- URL: https://rmyvvbqnccpfeyowidrq.supabase.co
-- =====================================================
--
-- This combines all 20 migrations in chronological order
-- Execute the entire file at once in SQL Editor
--
-- Expected outcome:
-- - All tables created
-- - All RLS policies applied
-- - All functions and triggers installed
-- - Database fully initialized
--
-- =====================================================

HEADER

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

# Fix CREATE POLICY IF NOT EXISTS (not supported in older PostgreSQL)
echo "Fixing CREATE POLICY statements..."
sed -i 's/CREATE POLICY IF NOT EXISTS/CREATE POLICY/g' "$OUTPUT_FILE"

# Fix trial_signups ALTER TABLE (table doesn't exist in base schema)
echo "Commenting out trial_signups ALTER TABLE..."
sed -i '/^-- 3. EXTEND TRIAL SIGNUPS TABLE/,/ADD COLUMN referral_code TEXT;/ {
  s/^-- 3. EXTEND TRIAL SIGNUPS TABLE/-- 3. EXTEND TRIAL SIGNUPS TABLE (SKIPPED - table does not exist in base schema)\n-- The trial_signups table was from an earlier Lovable iteration\n-- Commenting out to avoid migration errors\n--/
  s/^ALTER TABLE trial_signups/-- ALTER TABLE trial_signups/
  s/^  ADD COLUMN/--   ADD COLUMN/
}' "$OUTPUT_FILE"

# Fix RLS policies that reference a.user_id (accounts table has no user_id column)
echo "Fixing RLS policy user_id references..."
sed -i 's/AND a\.user_id = auth\.uid()/AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.account_id = a.id AND p.id = auth.uid())/g' "$OUTPUT_FILE"

# Fix staff_role enum - 'admin' should be 'platform_admin'
echo "Fixing staff_role enum value mismatches..."
sed -i "s/role IN ('admin', 'support')/role IN ('platform_admin', 'support')/g" "$OUTPUT_FILE"
sed -i "s/role IN ('admin', 'support', 'sales')/role IN ('platform_admin', 'support', 'sales')/g" "$OUTPUT_FILE"
sed -i "s/role IN ('admin', 'support', 'billing')/role IN ('platform_admin', 'support')/g" "$OUTPUT_FILE"
sed -i "s/role = 'admin'/role = 'platform_admin'/g" "$OUTPUT_FILE"

# Add IF NOT EXISTS to CREATE TABLE statements (only if not already present)
echo "Adding IF NOT EXISTS to CREATE TABLE..."
sed -i 's/^CREATE TABLE \([^I]\)/CREATE TABLE IF NOT EXISTS \1/g' "$OUTPUT_FILE"
sed -i 's/^CREATE TABLE$/CREATE TABLE IF NOT EXISTS/g' "$OUTPUT_FILE"

# Add IF NOT EXISTS to CREATE INDEX statements (only if not already present)
echo "Adding IF NOT EXISTS to CREATE INDEX..."
sed -i 's/^CREATE INDEX \([^I]\)/CREATE INDEX IF NOT EXISTS \1/g' "$OUTPUT_FILE"
sed -i 's/^CREATE INDEX$/CREATE INDEX IF NOT EXISTS/g' "$OUTPUT_FILE"

echo "" >> "$OUTPUT_FILE"
echo "-- =====================================================" >> "$OUTPUT_FILE"
echo "-- MIGRATION COMPLETE" >> "$OUTPUT_FILE"
echo "-- =====================================================" >> "$OUTPUT_FILE"

echo "Consolidated migration created:"
ls -lh "$OUTPUT_FILE"
wc -l "$OUTPUT_FILE"
