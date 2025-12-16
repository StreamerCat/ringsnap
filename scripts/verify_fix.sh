#!/bin/bash

# Configuration
PROJECT_REF="rmyvvbqnccpfeyowidrq"
SUPABASE_URL="https://$PROJECT_REF.supabase.co"
# The ID from the user's log that failed mapping
TEST_PHONE_ID="026a18ca-b56d-4686-9613-12549c3da444"
SECRET="dc1e528d961893dcc07103e4aea07636d8cede9d3f4791f56f505d29cba62c42"

echo "=== 1. Checking get_recent_calls RPC ==="
# We expect a 401 (Unauthorized) if it exists, or 404 if it is missing.
# We are passing an invalid anon key just to check the STATUS CODE.
RPC_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$SUPABASE_URL/rest/v1/rpc/get_recent_calls" \
  -H "Content-Type: application/json" \
  -H "apikey: invalid-key")

if [ "$RPC_STATUS" == "404" ]; then
  echo "❌ RPC get_recent_calls is MISSING (404). You must run the SQL."
else
  echo "✅ RPC get_recent_calls exists (Status: $RPC_STATUS - 401/403 is good here)."
fi

echo ""
echo "=== 2. Checking Webhook Extraction Logic ==="
# We send a payload matching the user's error log
RESPONSE=$(curl -s -X POST "$SUPABASE_URL/functions/v1/vapi-webhook" \
  -H "Content-Type: application/json" \
  -H "x-vapi-secret: $SECRET" \
  -d "{
    \"message\": {
      \"type\": \"call-started\",
      \"call\": {
        \"id\": \"test-extraction-$(date +%s)\",
        \"phoneNumberId\": \"$TEST_PHONE_ID\",
        \"customer\": { \"number\": \"+19999999999\" }
      }
    }
  }")

# Check if the output contains "unmapped_account" (which is expected if the phone number isn't in DB)
# BUT we want to see if extraction worked. 
# Code returns: "Skipped: unmapped" if mapped logic ran but found no account.
# We can't see the internal logs easily, but if we get "Skipped: unmapped", it means extraction *might* have passed or failed.
# Ideally we check if it says "missing_call_id" or similar.

echo "Response: $RESPONSE"

if [[ "$RESPONSE" == *"Skipped: unmapped"* ]]; then
    echo "✅ Webhook code is creating mapping attempt."
    echo "   If 'provider_phone_number_id' is NOT null in call_webhook_inbox, extraction works."
else
    echo "⚠️ Unexpected response."
fi 
