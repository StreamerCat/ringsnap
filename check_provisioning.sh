#!/bin/bash
# Check provisioning status for the test account

set -e

SUPABASE_URL="https://rmyvvbqnccpfeyowidrq.supabase.co"
SUPABASE_SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"

if [ -z "$SUPABASE_SERVICE_KEY" ]; then
  echo "❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable not set"
  exit 1
fi

# Get the account ID from the last test
ACCOUNT_ID="45494a43-fb23-4e8e-9ea8-2d4ac232ce8d"

echo "🔍 Checking provisioning status for account: $ACCOUNT_ID"
echo ""

# Check account provisioning status
echo "📋 Account Status:"
curl -s "${SUPABASE_URL}/rest/v1/accounts?id=eq.${ACCOUNT_ID}&select=provisioning_status,vapi_phone_number,vapi_assistant_id" \
  -H "apikey: ${SUPABASE_SERVICE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  | jq '.'

echo ""
echo "📋 Provisioning Jobs:"
curl -s "${SUPABASE_URL}/rest/v1/provisioning_jobs?account_id=eq.${ACCOUNT_ID}&order=created_at.desc&limit=5" \
  -H "apikey: ${SUPABASE_SERVICE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  | jq '.'

echo ""
echo "📋 Recent provision-vapi logs:"
echo "(Check Supabase dashboard for function logs)"
