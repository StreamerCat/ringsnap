#!/bin/bash
# Script to apply the signup_leads migration to Supabase

echo "Applying signup_leads migration..."
echo "Migration file: supabase/migrations/20251118000001_create_signup_leads.sql"
echo ""
echo "To apply this migration, run one of the following:"
echo ""
echo "Option 1: Using Supabase CLI (recommended)"
echo "  npx supabase db push --linked"
echo ""
echo "Option 2: Using SQL Editor in Supabase Dashboard"
echo "  1. Go to https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql"
echo "  2. Copy and paste the contents of supabase/migrations/20251118000001_create_signup_leads.sql"
echo "  3. Click 'Run'"
echo ""
echo "Option 3: Using psql"
echo "  psql YOUR_DATABASE_URL -f supabase/migrations/20251118000001_create_signup_leads.sql"
echo ""
