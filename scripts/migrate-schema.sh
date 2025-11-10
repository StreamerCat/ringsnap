#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                                                        ║${NC}"
echo -e "${BLUE}║         Database Schema Migration                     ║${NC}"
echo -e "${BLUE}║                                                        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if project is linked
if [ ! -f "./.supabase/config.toml" ]; then
    echo -e "${RED}✗ Project not linked${NC}"
    echo -e "Run ${YELLOW}./scripts/setup-new-supabase.sh${NC} first"
    exit 1
fi

echo -e "${GREEN}✓ Project linked${NC}"
echo ""

# Count migrations
MIGRATION_COUNT=$(ls -1 supabase/migrations/*.sql 2>/dev/null | wc -l)
echo -e "${BLUE}Found ${MIGRATION_COUNT} migration files${NC}"
echo ""

# List migrations
echo -e "${YELLOW}Migrations to apply:${NC}"
ls -1 supabase/migrations/*.sql | while read file; do
    filename=$(basename "$file")
    echo "  - $filename"
done
echo ""

# Confirm
read -p "Apply all migrations to remote database? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Migration cancelled${NC}"
    exit 0
fi

echo ""
echo -e "${BLUE}Applying migrations...${NC}"
echo ""

# Push migrations
supabase db push

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ All migrations applied successfully!${NC}"
    echo ""

    # Show applied migrations
    echo -e "${BLUE}Verifying applied migrations...${NC}"
    supabase migration list

    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}Database schema migration complete!${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${BLUE}Expected tables created:${NC}"
    echo "  ✓ accounts - Company/organization data"
    echo "  ✓ profiles - User profiles"
    echo "  ✓ user_roles - Role assignments"
    echo "  ✓ auth_tokens - Magic links, invites"
    echo "  ✓ auth_events - Security audit log"
    echo "  ✓ email_events - Email tracking"
    echo "  ✓ passkeys - WebAuthn credentials"
    echo "  ✓ user_sessions - Session management"
    echo "  ✓ rate_limits - Abuse prevention"
    echo "  ✓ staff_roles - Staff permissions"
    echo "  ✓ account_members - Team members"
    echo "  ✓ account_credits - Billing credits"
    echo "  ✓ And more..."
    echo ""
    echo -e "${BLUE}Next step:${NC}"
    echo "Run: ${YELLOW}./scripts/deploy-functions.sh${NC} to deploy edge functions"
    echo ""
else
    echo ""
    echo -e "${RED}✗ Migration failed${NC}"
    echo ""
    echo -e "${YELLOW}Troubleshooting tips:${NC}"
    echo "1. Check if you have the correct permissions"
    echo "2. Verify database password is correct"
    echo "3. Check Supabase dashboard for error details"
    echo "4. Try running: supabase migration list"
    exit 1
fi
