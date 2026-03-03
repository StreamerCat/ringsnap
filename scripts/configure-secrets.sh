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
echo -e "${BLUE}║         Configure Edge Function Secrets               ║${NC}"
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

echo -e "${YELLOW}This script will help you configure all required secrets${NC}"
echo -e "${YELLOW}for your edge functions.${NC}"
echo ""
echo -e "${BLUE}You can either:${NC}"
echo "1. Enter secrets interactively (recommended for first time)"
echo "2. Load from a .env file"
echo ""

read -p "Choose option (1/2): " -n 1 -r
echo
echo ""

if [[ $REPLY == "2" ]]; then
    # Load from file
    read -p "Enter path to .env file (e.g., .env.secrets): " ENV_FILE

    if [ ! -f "$ENV_FILE" ]; then
        echo -e "${RED}✗ File not found: $ENV_FILE${NC}"
        exit 1
    fi

    echo -e "${BLUE}Loading secrets from $ENV_FILE...${NC}"
    echo ""

    # Source the file and set secrets
    set -a
    source "$ENV_FILE"
    set +a

    # Set each secret
    [ ! -z "$SUPABASE_URL" ] && supabase secrets set SUPABASE_URL="$SUPABASE_URL"
    [ ! -z "$SUPABASE_SERVICE_ROLE_KEY" ] && supabase secrets set SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
    [ ! -z "$STRIPE_SECRET_KEY" ] && supabase secrets set STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY"
    [ ! -z "$STRIPE_PRICE_STARTER_OLD" ] && supabase secrets set STRIPE_PRICE_STARTER_OLD="$STRIPE_PRICE_STARTER_OLD"
    [ ! -z "$STRIPE_PRICE_PROFESSIONAL_OLD" ] && supabase secrets set STRIPE_PRICE_PROFESSIONAL_OLD="$STRIPE_PRICE_PROFESSIONAL_OLD"
    [ ! -z "$STRIPE_PRICE_PREMIUM_OLD" ] && supabase secrets set STRIPE_PRICE_PREMIUM_OLD="$STRIPE_PRICE_PREMIUM_OLD"
    [ ! -z "$VAPI_API_KEY" ] && supabase secrets set VAPI_API_KEY="$VAPI_API_KEY"
    [ ! -z "$VAPI_BASE_URL" ] && supabase secrets set VAPI_BASE_URL="$VAPI_BASE_URL"
    [ ! -z "$RESEND_PROD_KEY" ] && supabase secrets set RESEND_PROD_KEY="$RESEND_PROD_KEY"
    [ ! -z "$SENDGRID_API_KEY" ] && supabase secrets set SENDGRID_API_KEY="$SENDGRID_API_KEY"
    [ ! -z "$TWILIO_ACCOUNT_SID" ] && supabase secrets set TWILIO_ACCOUNT_SID="$TWILIO_ACCOUNT_SID"
    [ ! -z "$TWILIO_AUTH_TOKEN" ] && supabase secrets set TWILIO_AUTH_TOKEN="$TWILIO_AUTH_TOKEN"
    [ ! -z "$APP_URL" ] && supabase secrets set APP_URL="$APP_URL"
    [ ! -z "$NOTIFY_EMAIL_FROM" ] && supabase secrets set NOTIFY_EMAIL_FROM="$NOTIFY_EMAIL_FROM"
    [ ! -z "$NOTIFY_SMS_FROM" ] && supabase secrets set NOTIFY_SMS_FROM="$NOTIFY_SMS_FROM"
    [ ! -z "$NOTIFY_WEBHOOK_URL" ] && supabase secrets set NOTIFY_WEBHOOK_URL="$NOTIFY_WEBHOOK_URL"

    echo ""
    echo -e "${GREEN}✓ Secrets loaded from file${NC}"

else
    # Interactive mode
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}Supabase Configuration${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo ""

    read -p "SUPABASE_URL (https://xxxxx.supabase.co): " SUPABASE_URL
    read -sp "SUPABASE_SERVICE_ROLE_KEY: " SUPABASE_SERVICE_ROLE_KEY
    echo ""
    echo ""

    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}Stripe Configuration${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo ""

    read -sp "STRIPE_SECRET_KEY (sk_test_... or sk_live_...): " STRIPE_SECRET_KEY
    echo ""
    read -p "STRIPE_PRICE_STARTER_OLD (price_...): " STRIPE_PRICE_STARTER_OLD
    read -p "STRIPE_PRICE_PROFESSIONAL_OLD (price_...): " STRIPE_PRICE_PROFESSIONAL_OLD
    read -p "STRIPE_PRICE_PREMIUM_OLD (price_...): " STRIPE_PRICE_PREMIUM_OLD
    echo ""

    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}VAPI Configuration${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo ""

    read -sp "VAPI_API_KEY (sk_...): " VAPI_API_KEY
    echo ""
    read -p "VAPI_BASE_URL [https://api.vapi.ai]: " VAPI_BASE_URL
    VAPI_BASE_URL=${VAPI_BASE_URL:-https://api.vapi.ai}
    echo ""

    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}Email Provider (choose one)${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo ""

    read -p "Use Resend? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -sp "RESEND_PROD_KEY (re_...): " RESEND_PROD_KEY
        echo ""
    else
        read -sp "SENDGRID_API_KEY (SG....): " SENDGRID_API_KEY
        echo ""
    fi
    echo ""

    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}Twilio SMS Configuration${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo ""

    read -p "TWILIO_ACCOUNT_SID (AC...): " TWILIO_ACCOUNT_SID
    read -sp "TWILIO_AUTH_TOKEN: " TWILIO_AUTH_TOKEN
    echo ""
    echo ""

    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}Application Configuration${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo ""

    read -p "APP_URL (e.g., https://ringsnap.lovable.app): " APP_URL
    read -p "NOTIFY_EMAIL_FROM (e.g., noreply@getringsnap.com): " NOTIFY_EMAIL_FROM
    read -p "NOTIFY_SMS_FROM (e.g., +1234567890): " NOTIFY_SMS_FROM
    echo ""

    read -p "NOTIFY_WEBHOOK_URL (optional, press enter to skip): " NOTIFY_WEBHOOK_URL
    echo ""

    # Set secrets
    echo -e "${BLUE}Setting secrets in Supabase...${NC}"
    echo ""

    supabase secrets set SUPABASE_URL="$SUPABASE_URL"
    supabase secrets set SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
    supabase secrets set STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY"
    supabase secrets set STRIPE_PRICE_STARTER_OLD="$STRIPE_PRICE_STARTER_OLD"
    supabase secrets set STRIPE_PRICE_PROFESSIONAL_OLD="$STRIPE_PRICE_PROFESSIONAL_OLD"
    supabase secrets set STRIPE_PRICE_PREMIUM_OLD="$STRIPE_PRICE_PREMIUM_OLD"
    supabase secrets set VAPI_API_KEY="$VAPI_API_KEY"
    supabase secrets set VAPI_BASE_URL="$VAPI_BASE_URL"

    if [ ! -z "$RESEND_PROD_KEY" ]; then
        supabase secrets set RESEND_PROD_KEY="$RESEND_PROD_KEY"
    fi

    if [ ! -z "$SENDGRID_API_KEY" ]; then
        supabase secrets set SENDGRID_API_KEY="$SENDGRID_API_KEY"
    fi

    supabase secrets set TWILIO_ACCOUNT_SID="$TWILIO_ACCOUNT_SID"
    supabase secrets set TWILIO_AUTH_TOKEN="$TWILIO_AUTH_TOKEN"
    supabase secrets set APP_URL="$APP_URL"
    supabase secrets set NOTIFY_EMAIL_FROM="$NOTIFY_EMAIL_FROM"
    supabase secrets set NOTIFY_SMS_FROM="$NOTIFY_SMS_FROM"

    if [ ! -z "$NOTIFY_WEBHOOK_URL" ]; then
        supabase secrets set NOTIFY_WEBHOOK_URL="$NOTIFY_WEBHOOK_URL"
    fi
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ All secrets configured!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo ""

# List configured secrets
echo -e "${BLUE}Configured secrets:${NC}"
supabase secrets list

echo ""
echo -e "${BLUE}Next step:${NC}"
echo "Run: ${YELLOW}./scripts/deploy-functions.sh${NC} to deploy edge functions"
echo ""
