#!/bin/bash
# Easy Rollback Script for Phase 1 Migrations
# Usage: ./scripts/rollback-phase1.sh [local|staging|production]

set -e  # Exit on error

ENVIRONMENT=${1:-local}
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║        PHASE 1 ROLLBACK SCRIPT - DANGER ZONE               ║${NC}"
echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}This will rollback ALL Phase 1 migrations:${NC}"
echo "  - Drop new tables (orphaned_stripe_resources, provisioning_state_transitions)"
echo "  - Remove new columns (signup_channel, sales_rep_id, provisioning_stage)"
echo "  - Restore old columns (source, sales_rep_name)"
echo "  - Drop stored procedures and views"
echo ""
echo -e "${RED}⚠️  WARNING: Data in new tables will be LOST${NC}"
echo ""

# Confirm environment
echo -e "${YELLOW}Target environment: ${ENVIRONMENT}${NC}"
echo ""

# Safety check
read -p "Are you sure you want to rollback Phase 1? (type 'yes' to confirm): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Rollback cancelled."
  exit 0
fi

echo ""
echo -e "${YELLOW}Starting rollback...${NC}"
echo ""

# Backup first
echo "Step 1: Creating backup..."
if [ "$ENVIRONMENT" = "local" ]; then
  # For local, use pg_dump if available
  if command -v pg_dump &> /dev/null; then
    BACKUP_FILE="backup_before_rollback_$(date +%Y%m%d_%H%M%S).sql"
    pg_dump -h localhost -U postgres postgres > "$BACKUP_FILE" 2>/dev/null || echo "Backup skipped (no local postgres)"
    if [ -f "$BACKUP_FILE" ]; then
      echo -e "${GREEN}✓ Backup created: $BACKUP_FILE${NC}"
    fi
  else
    echo -e "${YELLOW}⚠ pg_dump not found, skipping backup${NC}"
  fi
else
  echo -e "${YELLOW}⚠ For staging/production, use Supabase Dashboard → Settings → Backups${NC}"
  read -p "Have you created a manual backup? (type 'yes' to continue): " BACKUP_CONFIRM
  if [ "$BACKUP_CONFIRM" != "yes" ]; then
    echo "Please create a backup first."
    exit 1
  fi
fi

echo ""
echo "Step 2: Applying rollback migration..."

# Apply rollback based on environment
if [ "$ENVIRONMENT" = "local" ]; then
  echo "Applying to local database..."
  psql -h localhost -U postgres -d postgres -f supabase/migrations/20251120999999_rollback_phase1.sql

elif [ "$ENVIRONMENT" = "staging" ]; then
  echo "Applying to staging via Supabase CLI..."
  echo "Make sure you're linked to staging: npx supabase link --project-ref YOUR_STAGING_REF"
  npx supabase db push --db-url "$STAGING_DATABASE_URL"

elif [ "$ENVIRONMENT" = "production" ]; then
  echo -e "${RED}PRODUCTION ROLLBACK${NC}"
  read -p "Type 'ROLLBACK PRODUCTION' to confirm: " PROD_CONFIRM
  if [ "$PROD_CONFIRM" != "ROLLBACK PRODUCTION" ]; then
    echo "Production rollback cancelled."
    exit 1
  fi

  echo "Applying to production via Supabase CLI..."
  npx supabase db push --db-url "$PRODUCTION_DATABASE_URL"

else
  echo "Unknown environment: $ENVIRONMENT"
  echo "Usage: ./scripts/rollback-phase1.sh [local|staging|production]"
  exit 1
fi

echo ""
echo -e "${GREEN}✓ Rollback migration applied${NC}"
echo ""

# Verification
echo "Step 3: Verifying rollback..."
echo ""

if [ "$ENVIRONMENT" = "local" ]; then
  echo "Checking for old columns..."
  psql -h localhost -U postgres -d postgres -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'accounts' AND column_name IN ('source', 'sales_rep_name');" || true

  echo ""
  echo "Checking new columns removed..."
  psql -h localhost -U postgres -d postgres -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'accounts' AND column_name IN ('signup_channel', 'sales_rep_id', 'provisioning_stage');" || true
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           ROLLBACK COMPLETE                                ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Next steps:"
echo "  1. Regenerate TypeScript types: npx supabase gen types typescript --linked"
echo "  2. Revert code changes that use new columns"
echo "  3. Test that old signup flow works"
echo ""
echo "To re-apply Phase 1 migrations:"
echo "  1. Delete supabase/migrations/20251120999999_rollback_phase1.sql"
echo "  2. Run: npx supabase db push"
echo ""
