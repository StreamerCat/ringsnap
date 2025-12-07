#!/bin/bash
# Test create-trial with full error output

RANDOM_EMAIL="test$(date +%s)@example.com"
RANDOM_PHONE="555$(printf '%07d' $((RANDOM % 10000000)))"

echo "Testing create-trial function..."
echo "Email: $RANDOM_EMAIL"
echo ""

curl -v -X POST "https://rmyvvbqnccpfeyowidrq.supabase.co/functions/v1/create-trial" \
  -H "Content-Type: application/json" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJteXZ2YnFuY2NwZmV5b3dpZHJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA3NTQzMzIsImV4cCI6MjA0NjMzMDMzMn0.XqtopqHACBOMJE9E1MoBesp-tw9FjDWC0slMcXqDwtk" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJteXZ2YnFuY2NwZmV5b3dpZHJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA3NTQzMzIsImV4cCI6MjA0NjMzMDMzMn0.XqtopqHACBOMJE9E1MoBesp-tw9FjDWC0slMcXqDwtk" \
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
