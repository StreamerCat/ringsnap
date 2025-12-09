#!/bin/bash
# Apply RLS fix migration directly via Supabase REST API
# This script uses psql via the Supabase connection string to execute the migration

set -e

# Supabase project details
SUPABASE_URL="https://rmyvvbqnccpfeyowidrq.supabase.co"
SUPABASE_SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"

if [ -z "$SUPABASE_SERVICE_KEY" ]; then
  echo "❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable not set"
  echo "Please set it or export it before running this script"
  exit 1
fi

echo "🔧 Applying RLS fix via Supabase SQL API..."

# Read the migration file
MIGRATION_SQL=$(cat supabase/migrations/20251209000001_fix_accounts_infinite_recursion.sql)

# Execute via Supabase REST API (using the pg_rest endpoint isn't available for DDL)
# We need to use the Management API instead

# For now, output the SQL for manual execution
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "MANUAL STEP REQUIRED: Execute this SQL in Supabase SQL Editor"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "1. Go to: https://supabase.com/dashboard/project/rmyvvbqnccpfeyowidrq/sql/new"
echo "2. Paste the following SQL and execute it:"
echo ""
echo "───────────────────────────────────────────────────────────────"
cat supabase/migrations/20251209000001_fix_accounts_infinite_recursion.sql
echo ""
echo "───────────────────────────────────────────────────────────────"
echo ""
echo "After executing, run a test signup to verify the fix."
