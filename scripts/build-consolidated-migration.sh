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

echo "" >> "$OUTPUT_FILE"
echo "-- =====================================================" >> "$OUTPUT_FILE"
echo "-- MIGRATION COMPLETE" >> "$OUTPUT_FILE"
echo "-- =====================================================" >> "$OUTPUT_FILE"

echo "Consolidated migration created:"
ls -lh "$OUTPUT_FILE"
wc -l "$OUTPUT_FILE"
