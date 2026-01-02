#!/bin/bash
# Migration Linter - Prevents common Postgres migration errors
# Usage: bash .github/scripts/lint-migrations.sh

set -e

MIGRATIONS_DIR="supabase/migrations"
ERRORS_FOUND=0

echo "🔍 Linting migrations in $MIGRATIONS_DIR..."
echo ""

# Rule 1: Check for COMMENT ON with string concatenation (||)
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

# Rule 2: Check for CREATE INDEX with STABLE functions in WHERE clause
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

# Rule 3: Check for UUID tables with sequence grants in same file
echo "Checking for UUID tables with invalid sequence grants..."
UUID_SEQUENCE_ERRORS=0
for migration in "$MIGRATIONS_DIR"/*.sql; do
  # Skip if file doesn't exist
  [ -f "$migration" ] || continue

  # Check if this migration has UUID primary key with gen_random_uuid()
  if grep -q "DEFAULT gen_random_uuid()" "$migration" 2>/dev/null; then
    # Check if same file grants usage on _id_seq
    if grep -q "GRANT USAGE ON SEQUENCE.*_id_seq" "$migration" 2>/dev/null; then
      # Ignore commented-out grants
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

# Exit with error if any issues found
if [ $ERRORS_FOUND -eq 1 ]; then
  echo "❌ Migration linting failed. Please fix the errors above."
  exit 1
else
  echo "✅ All migration lint checks passed!"
  exit 0
fi
