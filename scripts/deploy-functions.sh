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
echo -e "${BLUE}║         Edge Functions Deployment                     ║${NC}"
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

# Count functions
FUNCTION_COUNT=$(ls -1d supabase/functions/*/ 2>/dev/null | wc -l)
echo -e "${BLUE}Found ${FUNCTION_COUNT} edge functions to deploy${NC}"
echo ""

# Check if secrets are configured
echo -e "${YELLOW}⚠ IMPORTANT: Configure secrets before deploying functions${NC}"
echo ""
echo "Required secrets:"
echo "  - SUPABASE_URL"
echo "  - SUPABASE_SERVICE_ROLE_KEY"
echo "  - STRIPE_SECRET_KEY"
echo "  - STRIPE_PRICE_STARTER_OLD"
echo "  - STRIPE_PRICE_PROFESSIONAL_OLD"
echo "  - STRIPE_PRICE_PREMIUM_OLD"
echo "  - VAPI_API_KEY"
echo "  - VAPI_BASE_URL"
echo "  - RESEND_PROD_KEY (or SENDGRID_API_KEY)"
echo "  - TWILIO_ACCOUNT_SID"
echo "  - TWILIO_AUTH_TOKEN"
echo "  - APP_URL"
echo "  - NOTIFY_EMAIL_FROM"
echo "  - NOTIFY_SMS_FROM"
echo ""

read -p "Have you configured all required secrets? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${YELLOW}Please configure secrets first:${NC}"
    echo ""
    echo "supabase secrets set STRIPE_SECRET_KEY=sk_..."
    echo "supabase secrets set VAPI_API_KEY=sk_..."
    echo "# ... etc"
    echo ""
    echo "Or use: ${YELLOW}./scripts/configure-secrets.sh${NC}"
    echo ""
    exit 0
fi

echo ""
echo -e "${BLUE}Deploying all edge functions...${NC}"
echo ""
echo "This may take 5-10 minutes..."
echo ""

# Deploy all functions
supabase functions deploy

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ All functions deployed successfully!${NC}"
    echo ""

    # List deployed functions
    echo -e "${BLUE}Deployed functions:${NC}"
    supabase functions list

    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}Edge functions deployment complete!${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${BLUE}Functions deployed (37 total):${NC}"
    echo ""
    echo "Authentication & Auth:"
    echo "  ✓ send-magic-link"
    echo "  ✓ verify-magic-link"
    echo "  ✓ send-verification-code"
    echo "  ✓ verify-code"
    echo "  ✓ send-password-reset"
    echo "  ✓ require-step-up"
    echo ""
    echo "Onboarding & Signup:"
    echo "  ✓ free-trial-signup"
    echo "  ✓ complete-onboarding"
    echo "  ✓ handle-referral-signup"
    echo ""
    echo "Staff Management:"
    echo "  ✓ create-staff-user"
    echo "  ✓ create-staff-invite"
    echo "  ✓ accept-staff-invite"
    echo "  ✓ list-staff-users"
    echo "  ✓ manage-staff-role"
    echo "  ✓ manage-team-member"
    echo ""
    echo "Phone Provisioning:"
    echo "  ✓ provision"
    echo "  ✓ provision-resources"
    echo "  ✓ manage-phone-lifecycle"
    echo "  ✓ get-available-area-codes"
    echo ""
    echo "VAPI Integration:"
    echo "  ✓ authorize-call"
    echo "  ✓ vapi-demo-call"
    echo ""
    echo "Webhooks:"
    echo "  ✓ stripe-webhook"
    echo "  ✓ resend-webhook"
    echo ""
    echo "And 13 more..."
    echo ""
    echo -e "${BLUE}Next step:${NC}"
    echo "Update your .env file with new Supabase credentials"
    echo ""
else
    echo ""
    echo -e "${RED}✗ Function deployment failed${NC}"
    echo ""
    echo -e "${YELLOW}Troubleshooting tips:${NC}"
    echo "1. Check if all required secrets are configured"
    echo "2. Verify you have correct permissions"
    echo "3. Check function logs: supabase functions logs FUNCTION_NAME"
    echo "4. Try deploying one function at a time to identify the issue"
    exit 1
fi
