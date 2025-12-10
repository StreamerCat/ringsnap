#!/bin/bash
# Debug script to check provisioning secrets

echo "=== Checking Provisioning Configuration ==="
echo ""

# Get the hashed value
VAPI_PROVIDER_HASH=$(npx supabase secrets list 2>/dev/null | grep VAPI_DEFAULT_PROVIDER | awk '{print $3}')

echo "VAPI_DEFAULT_PROVIDER hash: $VAPI_PROVIDER_HASH"
echo ""
echo "Expected values:"
echo "  - 'twilio' (for Twilio provisioning)"
echo "  - 'vapi' (for legacy Vapi provisioning - deprecated)"
echo ""
echo "Twilio credentials status:"
npx supabase secrets list 2>/dev/null | grep -E "TWILIO" | while read line; do
  secret_name=$(echo "$line" | awk '{print $1}')
  echo "  ✅ $secret_name is set"
done
echo ""
echo "To verify the actual value of VAPI_DEFAULT_PROVIDER:"
echo "  1. Go to Supabase Dashboard > Project Settings > Edge Functions > Secrets"
echo "  2. Check if VAPI_DEFAULT_PROVIDER = 'twilio'"
echo ""
echo "If it's not 'twilio', run:"
echo "  npx supabase secrets set VAPI_DEFAULT_PROVIDER=twilio"
