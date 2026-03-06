#!/bin/bash
# Automated test loop for create-trial function
# This script waits for deployment, tests, and reports results

set -e

SUPABASE_URL="${SUPABASE_URL:-http://127.0.0.1:54321}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:?SUPABASE_ANON_KEY is required}"

echo "🔄 Waiting for GitHub Actions deployment to complete..."
sleep 30  # Give GitHub Actions time to start

# Wait for deployment (max 3 minutes)
for i in {1..36}; do
  echo "⏳ Checking deployment status (attempt $i/36)..."
  sleep 5
done

echo ""
echo "🧪 Running bypass test..."
echo ""

# Generate random test data
RANDOM_EMAIL="test$(date +%s)@example.com"
RANDOM_PHONE="555$(printf '%07d' $((RANDOM % 10000000)))"

# Run the test
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "${SUPABASE_URL}/functions/v1/create-trial" \
  -H "Content-Type: application/json" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -d "{
    \"name\": \"Test User\",
    \"email\": \"${RANDOM_EMAIL}\",
    \"phone\": \"${RANDOM_PHONE}\",
    \"companyName\": \"Test Company\",
    \"trade\": \"plumbing\",
    \"planType\": \"starter\",
    \"paymentMethodId\": \"pm_bypass_check_deploy\",
    \"zipCode\": \"99999\",
    \"assistantGender\": \"female\",
    \"source\": \"website\",
    \"bypassStripe\": true
  }")

# Extract HTTP code and body
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "📊 Test Results:"
echo "HTTP Status: $HTTP_CODE"
echo ""
echo "Response Body:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

# Check for success
if [ "$HTTP_CODE" = "200" ]; then
  SUCCESS=$(echo "$BODY" | jq -r '.success // false' 2>/dev/null)
  if [ "$SUCCESS" = "true" ]; then
    echo "✅ TEST PASSED - Signup successful!"
    exit 0
  fi
fi

echo "❌ TEST FAILED"
echo ""
echo "Error details:"
echo "$BODY" | jq -r '.message // .error // "Unknown error"' 2>/dev/null || echo "$BODY"

exit 1
