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
echo -e "${BLUE}║         Update Environment Configuration               ║${NC}"
echo -e "${BLUE}║                                                        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

ENV_FILE=".env"

if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}✗ .env file not found${NC}"
    exit 1
fi

echo -e "${YELLOW}This script will update your .env file with new Supabase credentials${NC}"
echo ""
echo -e "${BLUE}Current configuration:${NC}"
grep "VITE_SUPABASE" "$ENV_FILE" || echo "  (No Supabase config found)"
echo ""

read -p "Do you want to update the .env file? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Update cancelled${NC}"
    exit 0
fi

echo ""
echo -e "${BLUE}Enter your new Supabase credentials:${NC}"
echo ""
echo "You can find these at:"
echo "https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api"
echo ""

read -p "VITE_SUPABASE_URL (https://xxxxx.supabase.co): " NEW_SUPABASE_URL
read -p "VITE_SUPABASE_PROJECT_ID (xxxxx): " NEW_PROJECT_ID
read -p "VITE_SUPABASE_PUBLISHABLE_KEY (eyJhbGc...): " NEW_ANON_KEY

echo ""
echo -e "${BLUE}Updating .env file...${NC}"

# Create backup
cp "$ENV_FILE" "${ENV_FILE}.backup"
echo -e "${GREEN}✓ Created backup: ${ENV_FILE}.backup${NC}"

# Update or add Supabase variables
if grep -q "VITE_SUPABASE_URL=" "$ENV_FILE"; then
    # Update existing
    sed -i.tmp "s|VITE_SUPABASE_URL=.*|VITE_SUPABASE_URL=\"${NEW_SUPABASE_URL}\"|" "$ENV_FILE"
    sed -i.tmp "s|VITE_SUPABASE_PROJECT_ID=.*|VITE_SUPABASE_PROJECT_ID=\"${NEW_PROJECT_ID}\"|" "$ENV_FILE"
    sed -i.tmp "s|VITE_SUPABASE_PUBLISHABLE_KEY=.*|VITE_SUPABASE_PUBLISHABLE_KEY=\"${NEW_ANON_KEY}\"|" "$ENV_FILE"
    rm -f "${ENV_FILE}.tmp"
else
    # Add new
    echo "" >> "$ENV_FILE"
    echo "# New Supabase Configuration" >> "$ENV_FILE"
    echo "VITE_SUPABASE_URL=\"${NEW_SUPABASE_URL}\"" >> "$ENV_FILE"
    echo "VITE_SUPABASE_PROJECT_ID=\"${NEW_PROJECT_ID}\"" >> "$ENV_FILE"
    echo "VITE_SUPABASE_PUBLISHABLE_KEY=\"${NEW_ANON_KEY}\"" >> "$ENV_FILE"
fi

echo -e "${GREEN}✓ .env file updated${NC}"
echo ""

# Update config.toml
CONFIG_FILE="supabase/config.toml"
if [ -f "$CONFIG_FILE" ]; then
    echo -e "${BLUE}Updating supabase/config.toml...${NC}"
    cp "$CONFIG_FILE" "${CONFIG_FILE}.backup"

    sed -i.tmp "s|project_id = \".*\"|project_id = \"${NEW_PROJECT_ID}\"|" "$CONFIG_FILE"
    rm -f "${CONFIG_FILE}.tmp"

    echo -e "${GREEN}✓ config.toml updated${NC}"
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Configuration updated!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}Updated files:${NC}"
echo "  ✓ .env"
echo "  ✓ supabase/config.toml"
echo ""
echo -e "${BLUE}Backups created:${NC}"
echo "  ✓ .env.backup"
echo "  ✓ supabase/config.toml.backup"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Rebuild your application: ${YELLOW}npm run build${NC}"
echo "2. Test locally: ${YELLOW}npm run dev${NC}"
echo "3. Deploy to production with updated env vars"
echo ""
