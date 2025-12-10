#!/bin/bash
# Quick diagnostic script for provisioning issues

echo "======================================"
echo "PROVISIONING DIAGNOSTIC REPORT"
echo "======================================"
echo ""

echo "1. ENVIRONMENT CONFIGURATION"
echo "----------------------------"
echo "Checking Twilio credentials..."
TWILIO_CREDS=$(npx supabase secrets list 2>/dev/null | grep -E "TWILIO" | wc -l)
echo "  Twilio secrets found: $TWILIO_CREDS/4 expected"

echo ""
echo "Checking Vapi credentials..."
VAPI_CREDS=$(npx supabase secrets list 2>/dev/null | grep -E "VAPI_API_KEY|VAPI_DEFAULT_PROVIDER" | wc -l)
echo "  Vapi secrets found: $VAPI_CREDS/2 expected"

echo ""
echo "2. CODE VERIFICATION"
echo "----------------------------"
echo "Checking provision-vapi function..."
if [ -f "supabase/functions/provision-vapi/index.ts" ]; then
  echo "  ✅ provision-vapi/index.ts exists"
  
  # Check for the fix
  if grep -q "vapi_phone_id: vapiPhoneId" supabase/functions/provision-vapi/index.ts; then
    echo "  ✅ Schema fix applied (vapi_phone_id)"
  else
    echo "  ❌ Schema fix NOT found"
  fi
  
  # Check for Twilio provisioning
  if grep -q "provisionPhoneNumber" supabase/functions/provision-vapi/index.ts; then
    echo "  ✅ Twilio provisioning code present"
  else
    echo "  ❌ Twilio provisioning code missing"
  fi
else
  echo "  ❌ provision-vapi/index.ts NOT FOUND"
fi

echo ""
echo "3. DEPLOYMENT STATUS"
echo "----------------------------"
echo "Last 3 commits on current branch:"
git log --oneline -3

echo ""
echo "4. NEXT STEPS"
echo "----------------------------"
echo "To investigate the failure, you need to:"
echo ""
echo "A. Check Supabase Logs:"
echo "   https://supabase.com/dashboard/project/rmyvvbqnccpfeyowidrq/functions/provision-vapi/logs"
echo ""
echo "B. Check Database (run in Supabase SQL Editor):"
echo "   SELECT status, error, attempts FROM provisioning_jobs ORDER BY created_at DESC LIMIT 1;"
echo ""
echo "C. Look for these error patterns in logs:"
echo "   - 'Missing Twilio credentials' → Credentials not set"
echo "   - 'Telephony Provisioning Failed' → Twilio API error"
echo "   - 'Vapi phone import failed' → Vapi API error"
echo "   - 'Failed to save phone to DB' → Database error"
echo ""
echo "D. Check if number was purchased:"
echo "   - Twilio Console: https://console.twilio.com/us1/develop/phone-numbers/manage/active"
echo "   - Vapi Dashboard: https://dashboard.vapi.ai/phone-numbers"
echo ""
echo "======================================"
echo "Please check the logs and report back with the error message!"
echo "======================================"
