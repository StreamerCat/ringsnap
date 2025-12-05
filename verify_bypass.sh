#!/bin/bash

# ==============================================================================
# RingSnap Verification Script
# Purpose: Test backend "Bypass Mode" directly to avoid UI iteration loops.
# ==============================================================================

# 1. SETUP
# Replace this with your project URL (e.g., from Vercel)
URL="https://rmyvvbqnccpfeyowidrq.supabase.co/functions/v1/create-trial"

# Replace this with your SUPABASE_ANON_KEY from Vercel dash or .env.local
# I cannot read it for you automatically for security/access reasons.
ANON_KEY="REPLACE_THIS_WITH_YOUR_ANON_KEY"

# 2. PAYLOAD
# We use "bypassStripe": true to force the mock path.
JSON_DATA='{
  "name": "Bypass Test User",
  "email": "bypass_test_'$(date +%s)'@example.com",
  "phone": "5551234567",
  "companyName": "Test Co",
  "trade": "Plumber",
  "planType": "starter",
  "source": "website",
  "paymentMethodId": "pm_bypass_check_deploy",
  "bypassStripe": true,
  "zipCode": "99999"
}'

echo "---------------------------------------------------"
echo "Testing Backend URL: $URL"
echo "Payload Mode: bypassStripe=true"
echo "---------------------------------------------------"

if [ "$ANON_KEY" == "REPLACE_THIS_WITH_YOUR_ANON_KEY" ]; then
  echo "ERROR: Please open this script and paste your SUPABASE_ANON_KEY on line 12."
  exit 1
fi

curl -v -X POST "$URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ANON_KEY" \
  -d "$JSON_DATA"

echo -e "\n---------------------------------------------------"
echo "If you see {\"success\":true...} above, the backend is working."
echo "If you see a 500 error, please copy the FULL output back to the chat."
