#!/bin/bash
# Test create-trial with full error output

RANDOM_EMAIL="test$(date +%s)@example.com"
RANDOM_PHONE="555$(printf '%07d' $((RANDOM % 10000000)))"

echo "Testing create-trial function..."
echo "Email: $RANDOM_EMAIL"
echo ""

curl -v -X POST "https://rmyvvbqnccpfeyowidrq.supabase.co/functions/v1/create-trial" \
  -H "Content-Type: application/json" \
  -H "apikey: ${SUPABASE_ANON_KEY:?SUPABASE_ANON_KEY is required}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY:?SUPABASE_ANON_KEY is required}" \
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
  }" 2>&1
