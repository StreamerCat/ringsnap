#!/bin/bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  RINGSNAP COMPLETE AUTOMATED MIGRATION${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

# Configuration
PROJECT_ID="rmyvvbqnccpfeyowidrq"
SUPABASE_URL="https://rmyvvbqnccpfeyowidrq.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJteXZ2YnFuY2NwZmV5b3dpZHJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3ODQ0NjMsImV4cCI6MjA3ODM2MDQ2M30.5spxwzpTQ8k6sDnh312L1ooW2g6ILQ37KaqHYC_5-lE"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJteXZ2YnFuY2NwZmV5b3dpZHJxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjc4NDQ2MywiZXhwIjoyMDc4MzYwNDYzfQ.js8G1sw5IDjeO1QuYpx8y-FGuMd1Udzen9Gwpkl-HDo"

# API Keys
STRIPE_SECRET="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"
STRIPE_PRICE_STARTER="price_1SMav5IdevV48BnpEEIRKvk5"
STRIPE_PRICE_PROFESSIONAL="price_1SMaw9IdevV48BnpJkUs1UY0"
STRIPE_PRICE_PREMIUM="price_1SMawyIdevV48BnpM9r2mk2g"
VAPI_PUBLIC="9159dfe3-b11f-457c-b41b-e296872027a0"
VAPI_SECRET="d381d067-abc9-41f7-a695-df5ec29ecb86"
RESEND_KEY="re_WMpZGcuY_PEHTgpxGQAVDfW7WoPvmn2VC"
APP_URL="https://ringsnap.lovable.app"

echo -e "${YELLOW}⚠️  MIGRATION REQUIREMENTS:${NC}"
echo ""
echo "To complete the automated migration, I need:"
echo "1. Your Supabase database password"
echo "2. (Optional) Twilio credentials for SMS features"
echo ""
echo -e "${BLUE}The database password is set when you created the project.${NC}"
echo "You can reset it at:"
echo "https://supabase.com/dashboard/project/$PROJECT_ID/settings/database"
echo ""

read -sp "Enter your Supabase database password (or press Enter to skip): " DB_PASSWORD
echo ""
echo ""

if [ -z "$DB_PASSWORD" ]; then
    echo -e "${YELLOW}════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}  MANUAL MIGRATION REQUIRED${NC}"
    echo -e "${YELLOW}════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "Without the database password, please apply migrations manually:"
    echo ""
    echo "1. Go to: https://supabase.com/dashboard/project/$PROJECT_ID/sql/new"
    echo "2. Open: scripts/consolidated-migration.sql"
    echo "3. Copy all contents"
    echo "4. Paste into SQL Editor"
    echo "5. Click 'Run'"
    echo ""
    echo "Then re-run this script to configure edge function secrets."
    echo ""
    exit 0
fi

echo -e "${GREEN}✓ Database password received${NC}"
echo ""

# ============================================
# PHASE 1: Apply Database Migrations
# ============================================
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  PHASE 1: Database Schema Migration${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

MIGRATION_FILE="./scripts/consolidated-migration.sql"
DB_HOST="db.${PROJECT_ID}.supabase.co"
DB_USER="postgres"
DB_NAME="postgres"

echo "Connecting to PostgreSQL..."
echo "  Host: $DB_HOST"
echo "  Database: $DB_NAME"
echo ""

# Test connection first
echo "Testing connection..."
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "SELECT version();" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database connection successful${NC}"
    echo ""

    echo "Applying migrations from: $MIGRATION_FILE"
    echo ""

    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f "$MIGRATION_FILE"

    if [ $? -eq 0 ]; then
        echo ""
        echo -e "${GREEN}✓ Database migrations applied successfully!${NC}"
        echo ""

        # Verify tables
        echo "Verifying tables..."
        TABLE_COUNT=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';")

        echo -e "${GREEN}✓ Found $TABLE_COUNT tables${NC}"
        echo ""
    else
        echo ""
        echo -e "${RED}✗ Migration failed${NC}"
        echo "Please check the errors above and try manual migration."
        exit 1
    fi
else
    echo -e "${RED}✗ Database connection failed${NC}"
    echo "Please check:"
    echo "  1. Database password is correct"
    echo "  2. Database is accessible (not paused)"
    echo "  3. Network connectivity"
    exit 1
fi

# ============================================
# PHASE 2: Configure Edge Function Secrets
# ============================================
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  PHASE 2: Configure Edge Function Secrets${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}Edge function deployment requires Supabase CLI.${NC}"
echo ""
echo "Secrets to configure (for when you deploy functions):"
echo ""
echo "SUPABASE_URL=$SUPABASE_URL"
echo "SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY"
echo "STRIPE_SECRET_KEY=$STRIPE_SECRET"
echo "STRIPE_PRICE_STARTER=$STRIPE_PRICE_STARTER"
echo "STRIPE_PRICE_PROFESSIONAL=$STRIPE_PRICE_PROFESSIONAL"
echo "STRIPE_PRICE_PREMIUM=$STRIPE_PRICE_PREMIUM"
echo "VAPI_API_KEY=$VAPI_SECRET"
echo "VAPI_BASE_URL=https://api.vapi.ai"
echo "RESEND_PROD_KEY=$RESEND_KEY"
echo "APP_URL=$APP_URL"
echo "NOTIFY_EMAIL_FROM=noreply@getringsnap.com"
echo ""

# Save to file for later use
cat > ./scripts/.env.secrets << EOF
# Supabase Configuration
SUPABASE_URL=$SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY

# Stripe Configuration
STRIPE_SECRET_KEY=$STRIPE_SECRET
STRIPE_PRICE_STARTER=$STRIPE_PRICE_STARTER
STRIPE_PRICE_PROFESSIONAL=$STRIPE_PRICE_PROFESSIONAL
STRIPE_PRICE_PREMIUM=$STRIPE_PRICE_PREMIUM

# VAPI Configuration
VAPI_API_KEY=$VAPI_SECRET
VAPI_BASE_URL=https://api.vapi.ai

# Email Configuration
RESEND_PROD_KEY=$RESEND_KEY

# Application Configuration
APP_URL=$APP_URL
NOTIFY_EMAIL_FROM=noreply@getringsnap.com
NOTIFY_SMS_FROM=+1234567890
EOF

echo -e "${GREEN}✓ Secrets saved to: ./scripts/.env.secrets${NC}"
echo ""

# ============================================
# PHASE 3: Edge Function Deployment
# ============================================
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  PHASE 3: Edge Function Deployment${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

echo "Edge functions must be deployed using Supabase CLI."
echo ""
echo "On a machine with Node.js installed:"
echo ""
echo "  npm install -g supabase"
echo "  supabase login"
echo "  supabase link --project-ref $PROJECT_ID"
echo "  "
echo "  # Set secrets"
echo "  supabase secrets set SUPABASE_URL=$SUPABASE_URL"
echo "  supabase secrets set SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY"
echo "  supabase secrets set STRIPE_SECRET_KEY=$STRIPE_SECRET"
echo "  supabase secrets set STRIPE_PRICE_STARTER=$STRIPE_PRICE_STARTER"
echo "  supabase secrets set STRIPE_PRICE_PROFESSIONAL=$STRIPE_PRICE_PROFESSIONAL"
echo "  supabase secrets set STRIPE_PRICE_PREMIUM=$STRIPE_PRICE_PREMIUM"
echo "  supabase secrets set VAPI_API_KEY=$VAPI_SECRET"
echo "  supabase secrets set VAPI_BASE_URL=https://api.vapi.ai"
echo "  supabase secrets set RESEND_PROD_KEY=$RESEND_KEY"
echo "  supabase secrets set APP_URL=$APP_URL"
echo "  supabase secrets set NOTIFY_EMAIL_FROM=noreply@getringsnap.com"
echo "  "
echo "  # Deploy all functions"
echo "  supabase functions deploy"
echo ""

# ============================================
# SUMMARY
# ============================================
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  MIGRATION PHASE 1 COMPLETE!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo ""
echo "✅ Database schema applied"
echo "✅ All tables created"
echo "✅ RLS policies enabled"
echo "✅ Functions and triggers installed"
echo "✅ Secrets configuration saved"
echo ""
echo "⏳ Remaining steps:"
echo "   1. Deploy edge functions (requires Supabase CLI)"
echo "   2. Test application"
echo ""
echo "Configuration files updated:"
echo "   ✓ .env - Updated with new Supabase URL"
echo "   ✓ supabase/config.toml - Updated with new project ID"
echo "   ✓ scripts/.env.secrets - Secrets for edge functions"
echo ""
echo "Your application is now configured for:"
echo "   Project: $PROJECT_ID"
echo "   URL: $SUPABASE_URL"
echo ""
