#!/bin/bash
# Migration Linter - Prevents common Postgres migration errors
# Usage: bash .github/scripts/lint-migrations.sh

set -e

MIGRATIONS_DIR="supabase/migrations"
ERRORS_FOUND=0

echo "🔍 Linting migrations in $MIGRATIONS_DIR..."
echo ""

# Rule 0: Check filename format (14 digits followed by underscore and name)
echo "Checking migration filename format..."
INVALID_FILENAMES=0
for migration in "$MIGRATIONS_DIR"/*.sql; do
  [ -f "$migration" ] || continue
  filename=$(basename "$migration")
  
  # Skip debug/test migrations (99999...)
  if [[ "$filename" =~ ^99999 ]]; then
    continue
  fi
  
  if ! [[ "$filename" =~ ^[0-9]{14}_.+\.sql$ ]]; then
    echo "❌ ERROR: Invalid filename format: $filename"
    echo "   Expected: YYYYMMDDHHMMSS_description.sql (14 digits + underscore + name)"
    INVALID_FILENAMES=1
    ERRORS_FOUND=1
  fi
done

if [ $INVALID_FILENAMES -eq 0 ]; then
  echo "✅ All migration filenames are valid"
fi
echo ""

# Rule 1: Check for duplicate version prefixes
echo "Checking for duplicate migration version prefixes..."
cd "$MIGRATIONS_DIR"
DUPLICATES=$(ls -1 *.sql 2>/dev/null | grep -v "^99999" | cut -c1-14 | sort | uniq -d || true)
cd - > /dev/null
if [ -n "$DUPLICATES" ]; then
  echo "❌ ERROR: Found duplicate migration version prefixes:"
  echo "$DUPLICATES" | while read dup; do
    echo "   Duplicate: $dup"
    ls -1 "$MIGRATIONS_DIR"/${dup}*.sql 2>/dev/null | sed 's/^/     - /'
  done
  echo "   Fix: Rename one file in each duplicate pair to a unique timestamp"
  echo ""
  ERRORS_FOUND=1
else
  echo "✅ No duplicate version prefixes found"
fi
echo ""

# Rule 2: Check for COMMENT ON with string concatenation (||)
echo "Checking for COMMENT ON with string concatenation..."
if grep -rn "COMMENT ON.*||" "$MIGRATIONS_DIR"/*.sql 2>/dev/null; then
  echo "❌ ERROR: Found COMMENT ON statements using string concatenation (||)"
  echo "   String concatenation in COMMENT ON can cause parser issues."
  echo "   Use a single quoted string literal instead."
  echo ""
  ERRORS_FOUND=1
else
  echo "✅ No COMMENT ON with || found"
fi
echo ""

# Rule 3: Check for CREATE INDEX with STABLE functions in WHERE clause
echo "Checking for CREATE INDEX with STABLE functions in WHERE predicate..."
if grep -rn "CREATE INDEX" "$MIGRATIONS_DIR"/*.sql | grep -i "WHERE" | grep -iE "now\(\)|current_timestamp|current_date|current_time|clock_timestamp|timeofday" 2>/dev/null; then
  echo "❌ ERROR: Found CREATE INDEX with STABLE function in WHERE clause"
  echo "   Functions in index predicates must be IMMUTABLE, not STABLE."
  echo "   now(), current_timestamp, etc. are STABLE and will cause migration failures."
  echo "   Use IMMUTABLE predicates like 'WHERE column IS NOT NULL' instead."
  echo ""
  ERRORS_FOUND=1
else
  echo "✅ No CREATE INDEX with STABLE functions found"
fi
echo ""

# Rule 4: Check for UUID tables with sequence grants in same file
echo "Checking for UUID tables with invalid sequence grants..."
UUID_SEQUENCE_ERRORS=0
for migration in "$MIGRATIONS_DIR"/*.sql; do
  [ -f "$migration" ] || continue
  
  if grep -q "DEFAULT gen_random_uuid()" "$migration" 2>/dev/null; then
    if grep -q "GRANT USAGE ON SEQUENCE.*_id_seq" "$migration" 2>/dev/null; then
      if ! grep "GRANT USAGE ON SEQUENCE.*_id_seq" "$migration" | grep -q "^--" 2>/dev/null; then
        echo "❌ ERROR: $migration"
        echo "   File defines UUID primary key (gen_random_uuid) AND grants SEQUENCE usage"
        echo "   UUID PKs do not create sequences - remove the GRANT USAGE ON SEQUENCE line"
        grep -n "GRANT USAGE ON SEQUENCE.*_id_seq" "$migration" 2>/dev/null || true
        echo ""
        UUID_SEQUENCE_ERRORS=1
        ERRORS_FOUND=1
      fi
    fi
  fi
done

if [ $UUID_SEQUENCE_ERRORS -eq 0 ]; then
  echo "✅ No UUID tables with invalid sequence grants found"
fi
echo ""

# Rule 5: Check for signup_channel_type usage (type was created then rolled back)
echo "Checking for signup_channel_type usage..."
SIGNUP_CHANNEL_ERRORS=0
for migration in "$MIGRATIONS_DIR"/*.sql; do
  [ -f "$migration" ] || continue
  
  # Skip migrations that intentionally create/rollback the type
  if [[ "$migration" == *"20251120000001_unified_signup_schema.sql" ]] || \
     [[ "$migration" == *"20251120000004_profiles_signup_channel.sql" ]] || \
     [[ "$migration" == *"20251120000006_create_account_transaction.sql" ]] || \
     [[ "$migration" == *"20251120999999_rollback_phase1.sql" ]] || \
     [[ "$migration" == *"20251123999998_fix_create_account_no_provisioning_stage.sql" ]]; then
    continue
  fi
  
  if grep -v "^--" "$migration" 2>/dev/null | grep -q "signup_channel_type" 2>/dev/null; then
    echo "❌ ERROR: $migration"
    echo "   File references signup_channel_type which was created then rolled back"
    echo "   Use TEXT instead and wrap function drops in DO blocks that check type existence"
    grep -n "signup_channel_type" "$migration" 2>/dev/null | head -5 || true
    echo ""
    SIGNUP_CHANNEL_ERRORS=1
    ERRORS_FOUND=1
  fi
done

if [ $SIGNUP_CHANNEL_ERRORS -eq 0 ]; then
  echo "✅ No invalid signup_channel_type usage found"
fi
echo ""

# Exit with error if any issues found
if [ $ERRORS_FOUND -eq 1 ]; then
  echo "❌ Migration linting failed. Please fix the errors above."
  exit 1
else
  echo "✅ All migration lint checks passed!"
  exit 0
fi
