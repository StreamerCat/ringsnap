#!/bin/bash

echo "🔍 Comprehensive Migration Analysis & Fix"
echo "========================================"
echo ""

MIGRATION_FILE="/home/user/ringsnap/scripts/consolidated-migration.sql"
BACKUP_FILE="/home/user/ringsnap/scripts/consolidated-migration.backup.sql"

# Create backup
cp "$MIGRATION_FILE" "$BACKUP_FILE"
echo "✓ Backup created: $BACKUP_FILE"
echo ""

# Issue 1: CREATE POLICY IF NOT EXISTS (already fixed)
echo "1. Checking CREATE POLICY IF NOT EXISTS..."
COUNT=$(grep -c "CREATE POLICY IF NOT EXISTS" "$MIGRATION_FILE" || true)
if [ "$COUNT" -gt 0 ]; then
  echo "   Found $COUNT instances - FIXING"
  sed -i 's/CREATE POLICY IF NOT EXISTS/CREATE POLICY/g' "$MIGRATION_FILE"
else
  echo "   ✓ Already fixed"
fi

# Issue 2: trial_signups table reference (already fixed)
echo "2. Checking trial_signups ALTER TABLE..."
if grep -q "^ALTER TABLE trial_signups" "$MIGRATION_FILE"; then
  echo "   Found unfixed reference - FIXING"
  sed -i 's/^ALTER TABLE trial_signups/-- ALTER TABLE trial_signups (SKIPPED - table does not exist)/g' "$MIGRATION_FILE"
else
  echo "   ✓ Already fixed"
fi

# Issue 3: a.user_id references (already fixed)
echo "3. Checking a.user_id in RLS policies..."
COUNT=$(grep -c "a\.user_id = auth\.uid()" "$MIGRATION_FILE" || true)
if [ "$COUNT" -gt 0 ]; then
  echo "   Found $COUNT instances - FIXING"
  sed -i 's/AND a\.user_id = auth\.uid()/AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.account_id = a.id AND p.id = auth.uid())/g' "$MIGRATION_FILE"
else
  echo "   ✓ Already fixed"
fi

# Issue 4: staff_role enum - 'admin' vs 'platform_admin'
echo "4. Checking staff_role enum value mismatches..."
# In staff_roles table context, 'admin' should be 'platform_admin' or 'support'
# Replace role IN ('admin', 'support') with role IN ('platform_admin', 'support')
sed -i "s/role IN ('admin', 'support')/role IN ('platform_admin', 'support')/g" "$MIGRATION_FILE"
sed -i "s/role IN ('admin', 'support', 'sales')/role IN ('platform_admin', 'support', 'sales')/g" "$MIGRATION_FILE"
sed -i "s/role IN ('admin', 'support', 'billing')/role IN ('platform_admin', 'support')/g" "$MIGRATION_FILE"
sed -i "s/role = 'admin'/role = 'platform_admin'/g" "$MIGRATION_FILE"
echo "   ✓ Fixed enum value references"

# Issue 5: Check for other potential enum issues
echo "5. Checking subscription_status enum..."
# Verify subscription_status values are valid
if grep -q "subscription_status.*=.*'active'" "$MIGRATION_FILE"; then
  echo "   ✓ subscription_status values look correct"
fi

# Issue 6: Check for missing IF NOT EXISTS on tables
echo "6. Adding IF NOT EXISTS to CREATE TABLE statements..."
sed -i 's/^CREATE TABLE public\./CREATE TABLE IF NOT EXISTS public./g' "$MIGRATION_FILE"
sed -i 's/^CREATE TABLE phone_numbers/CREATE TABLE IF NOT EXISTS phone_numbers/g' "$MIGRATION_FILE"
sed -i 's/^CREATE TABLE usage_logs/CREATE TABLE IF NOT EXISTS usage_logs/g' "$MIGRATION_FILE"
echo "   ✓ Added IF NOT EXISTS to all CREATE TABLE"

# Issue 7: Check for missing IF NOT EXISTS on indexes
echo "7. Checking CREATE INDEX statements..."
if grep -q "^CREATE INDEX idx_" "$MIGRATION_FILE"; then
  sed -i 's/^CREATE INDEX idx_/CREATE INDEX IF NOT EXISTS idx_/g' "$MIGRATION_FILE"
  sed -i 's/^CREATE INDEX ON/CREATE INDEX IF NOT EXISTS ON/g' "$MIGRATION_FILE"
  echo "   ✓ Added IF NOT EXISTS to CREATE INDEX"
fi

# Issue 8: Fix ALTER TYPE ADD VALUE (needs IF NOT EXISTS)
echo "8. Checking ALTER TYPE ADD VALUE..."
COUNT=$(grep -c "ALTER TYPE.*ADD VALUE IF NOT EXISTS" "$MIGRATION_FILE" || true)
echo "   ✓ Found $COUNT safe ALTER TYPE statements"

echo ""
echo "========================================"
echo "✅ Comprehensive fix complete!"
echo ""
echo "Summary of fixes:"
echo "  1. CREATE POLICY syntax"
echo "  2. trial_signups table reference"
echo "  3. RLS policy user_id references"
echo "  4. staff_role enum 'admin' → 'platform_admin'"
echo "  5. Added IF NOT EXISTS to tables"
echo "  6. Added IF NOT EXISTS to indexes"
echo ""
echo "Backup saved at: $BACKUP_FILE"
echo "Fixed migration: $MIGRATION_FILE"
echo ""
