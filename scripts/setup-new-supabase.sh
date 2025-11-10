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
echo -e "${BLUE}║         RingSnap Supabase Migration Setup             ║${NC}"
echo -e "${BLUE}║                                                        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}✗ Supabase CLI not found${NC}"
    echo -e "${YELLOW}Please install it first:${NC}"
    echo -e "  npm install -g supabase"
    echo -e "  OR"
    echo -e "  brew install supabase/tap/supabase"
    exit 1
fi

echo -e "${GREEN}✓ Supabase CLI found: $(supabase --version)${NC}"
echo ""

# Check if already linked
if [ -f "./.supabase/config.toml" ]; then
    echo -e "${YELLOW}⚠ Project appears to be already linked${NC}"
    read -p "Do you want to unlink and start fresh? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        supabase unlink
        echo -e "${GREEN}✓ Unlinked${NC}"
    else
        echo -e "${BLUE}Continuing with existing link...${NC}"
    fi
fi

# Login check
echo -e "${BLUE}Checking Supabase login status...${NC}"
if ! supabase projects list &> /dev/null; then
    echo -e "${YELLOW}Not logged in. Opening browser for authentication...${NC}"
    supabase login
else
    echo -e "${GREEN}✓ Already logged in${NC}"
fi
echo ""

# Get project reference
echo -e "${YELLOW}════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}IMPORTANT: Create your new Supabase project first!${NC}"
echo -e "${YELLOW}════════════════════════════════════════════════════════${NC}"
echo ""
echo "1. Go to: https://supabase.com/dashboard"
echo "2. Click 'New Project'"
echo "3. Fill in:"
echo "   - Name: RingSnap (or your preferred name)"
echo "   - Database Password: Generate strong password"
echo "   - Region: Choose closest to users"
echo "4. Wait for provisioning (~2 minutes)"
echo "5. Copy your Project Reference ID (from URL or Settings)"
echo ""
read -p "Enter your new Project Reference ID: " PROJECT_REF

if [ -z "$PROJECT_REF" ]; then
    echo -e "${RED}✗ Project reference ID cannot be empty${NC}"
    exit 1
fi

echo ""
read -sp "Enter your database password: " DB_PASSWORD
echo ""

# Link project
echo ""
echo -e "${BLUE}Linking to project: ${PROJECT_REF}${NC}"
echo "$DB_PASSWORD" | supabase link --project-ref "$PROJECT_REF" --password "$DB_PASSWORD"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Successfully linked to project${NC}"
else
    echo -e "${RED}✗ Failed to link project${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Setup Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Run: ${YELLOW}./scripts/migrate-schema.sh${NC} to apply database migrations"
echo "2. Run: ${YELLOW}./scripts/deploy-functions.sh${NC} to deploy edge functions"
echo "3. Update your .env file with new credentials"
echo ""
echo -e "${BLUE}Get your credentials from:${NC}"
echo "https://supabase.com/dashboard/project/${PROJECT_REF}/settings/api"
echo ""
