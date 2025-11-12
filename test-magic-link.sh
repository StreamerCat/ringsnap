#!/bin/bash

# Test send-magic-link edge function directly
# Usage: ./test-magic-link.sh your@email.com

EMAIL="${1:-test@example.com}"

echo "Testing send-magic-link edge function..."
echo "Email: $EMAIL"
echo ""

# Get Supabase URL from config.toml
PROJECT_ID=$(grep 'project_id' supabase/config.toml | cut -d'"' -f2)
FUNCTION_URL="https://${PROJECT_ID}.supabase.co/functions/v1/send-magic-link"

echo "Calling: $FUNCTION_URL"
echo ""

curl -X POST "$FUNCTION_URL" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\"}" \
  -v 2>&1

echo ""
echo ""
echo "Check the response above for:"
echo "- Status code (should be 200)"
echo "- Response body with 'success: true'"
echo "- Any error messages"
