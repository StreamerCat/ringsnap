#!/bin/bash

# Authentication Fixes Deployment Script
# This script deploys the edge function fixes and provides deployment status

set -e  # Exit on error

echo "🚀 RingSnap Authentication Fixes - Deployment Script"
echo "=================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found${NC}"
    echo ""
    echo "Please install it first:"
    echo "  npm install -g supabase"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓${NC} Supabase CLI found"

# Check if we're in the right directory
if [ ! -d "supabase/functions" ]; then
    echo -e "${RED}❌ Error: supabase/functions directory not found${NC}"
    echo "Please run this script from the project root"
    exit 1
fi

echo -e "${GREEN}✓${NC} Project structure verified"
echo ""

# Show what will be deployed
echo "📦 Files to be deployed:"
echo "  1. supabase/functions/verify-magic-link/index.ts (CRITICAL FIX)"
echo "  2. supabase/functions/send-password-reset/index.ts (template update)"
echo ""

# Confirm deployment
read -p "Deploy these fixes? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled"
    exit 0
fi

echo ""
echo "🔨 Deploying edge functions..."
echo ""

# Deploy verify-magic-link (critical fix)
echo "1/2 Deploying verify-magic-link (token hashing fix)..."
if supabase functions deploy verify-magic-link; then
    echo -e "${GREEN}✓${NC} verify-magic-link deployed successfully"
else
    echo -e "${RED}❌ verify-magic-link deployment failed${NC}"
    exit 1
fi

echo ""

# Deploy send-password-reset (template consolidation)
echo "2/2 Deploying send-password-reset (template update)..."
if supabase functions deploy send-password-reset; then
    echo -e "${GREEN}✓${NC} send-password-reset deployed successfully"
else
    echo -e "${RED}❌ send-password-reset deployment failed${NC}"
    exit 1
fi

echo ""
echo "=================================================="
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo "=================================================="
echo ""

# Show deployed functions
echo "📋 Deployed Functions:"
supabase functions list

echo ""
echo "🧪 Next Steps:"
echo ""
echo "1. Run Quick Smoke Test:"
echo "   - Go to https://getringsnap.com/auth/login"
echo "   - Enter your email"
echo "   - Click 'Continue with email'"
echo "   - Check email and click magic link"
echo "   - Should authenticate successfully ✅"
echo ""
echo "2. Monitor Logs:"
echo "   supabase functions logs verify-magic-link --tail"
echo ""
echo "3. Check Database:"
echo "   - Verify auth_events table shows successful magic_link_verified events"
echo "   - Check email_events table for delivery status"
echo ""
echo "4. Full Testing:"
echo "   - See QUICK_TEST_CHECKLIST.md for essential tests"
echo "   - See TESTING_AND_DEPLOYMENT_GUIDE.md for comprehensive testing"
echo ""

# Ask if user wants to watch logs
read -p "Watch logs now? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "📊 Watching verify-magic-link logs (Ctrl+C to exit)..."
    echo ""
    supabase functions logs verify-magic-link --tail
fi
