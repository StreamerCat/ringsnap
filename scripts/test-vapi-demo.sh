#!/bin/bash

# Test VAPI Demo Edge Function
# This script tests the vapi-demo-call edge function to verify it's deployed and configured correctly

set -e

SUPABASE_URL="https://lytnlrkdccqmxgdmdxef.supabase.co"
ENDPOINT="$SUPABASE_URL/functions/v1/vapi-demo-call"

echo "🔍 Testing VAPI Demo Edge Function"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📍 Endpoint: $ENDPOINT"
echo ""

# Make request and capture response
echo "📡 Sending POST request..."
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$ENDPOINT" -H "Content-Type: application/json")

# Extract HTTP status
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

echo "📊 HTTP Status: $HTTP_STATUS"
echo ""

# Analyze response
case $HTTP_STATUS in
  200)
    echo "✅ SUCCESS - Edge function is deployed and working!"
    echo ""
    echo "Response:"
    echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
    echo ""

    # Check if secrets are set
    if echo "$BODY" | grep -q "publicKey"; then
      echo "✅ VAPI secrets are configured correctly"
      echo ""
      echo "🎉 Voice demo should work! Test it at:"
      echo "   https://ringsnap.app (or your deployment URL)"
    else
      echo "❌ Response doesn't contain expected fields"
      echo "   Expected: publicKey and assistantId"
    fi
    ;;

  403)
    echo "❌ FAILED - Access denied (HTTP 403)"
    echo ""
    echo "Response: $BODY"
    echo ""
    echo "🔧 Issue: Edge function is not deployed or has access restrictions"
    echo ""
    echo "📋 Solution:"
    echo "   1. Deploy the edge function:"
    echo "      npx supabase login"
    echo "      npx supabase link --project-ref lytnlrkdccqmxgdmdxef"
    echo "      npx supabase functions deploy vapi-demo-call"
    echo ""
    echo "   2. After deployment, run this script again"
    echo ""
    echo "See VAPI_SETUP.md for detailed instructions"
    ;;

  500)
    echo "⚠️  WARNING - Server error (HTTP 500)"
    echo ""
    echo "Response: $BODY"
    echo ""

    if echo "$BODY" | grep -q "Voice demo service not configured"; then
      echo "🔧 Issue: VAPI secrets are not set"
      echo ""
      echo "📋 Solution:"
      echo "   Set the required secrets in Supabase:"
      echo "   npx supabase secrets set VAPI_PUBLIC_KEY=\"your-key-here\""
      echo "   npx supabase secrets set VAPI_DEMO_ASSISTANT_ID=\"your-id-here\""
      echo ""
      echo "Or set them in the Supabase Dashboard:"
      echo "   https://supabase.com/dashboard/project/lytnlrkdccqmxgdmdxef"
      echo "   → Edge Functions → vapi-demo-call → Secrets tab"
    else
      echo "🔧 Issue: Unknown server error"
      echo "   Check Supabase Edge Function logs for details"
    fi
    echo ""
    echo "See VAPI_SETUP.md for detailed instructions"
    ;;

  *)
    echo "❓ UNEXPECTED - HTTP $HTTP_STATUS"
    echo ""
    echo "Response: $BODY"
    echo ""
    echo "Check VAPI_SETUP.md for troubleshooting steps"
    ;;
esac

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "For more details, see: VAPI_SETUP.md"
