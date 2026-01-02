#!/bin/bash
# Migration Linter - Prevents common Postgres migration errors
# Usage: .github/scripts/lint-migrations.sh

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

# Rule 3: Check for GRANT USAGE ON SEQUENCE for UUID tables
echo "Checking for invalid GRANT USAGE ON SEQUENCE for UUID primary keys..."
if grep -rn "GRANT USAGE ON SEQUENCE.*_id_seq" "$MIGRATIONS_DIR"/*.sql 2>/dev/null; then
  echo "⚠️  WARNING: Found GRANT USAGE ON SEQUENCE for *_id_seq"
  echo "   UUID primary keys (gen_random_uuid) do not create sequences."
  echo "   Verify the table uses SERIAL/IDENTITY before granting sequence usage."
  echo ""
  # This is a warning, not an error, since some tables legitimately use SERIAL
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
