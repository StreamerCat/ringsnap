#!/bin/bash

# Deploy VAPI Demo Edge Function and Set Secrets
# This script deploys the vapi-demo-call edge function to production
# and sets the required secrets

set -e

PROJECT_REF="rmyvvbqnccpfeyowidrq"

# VAPI Credentials
VAPI_PUBLIC_KEY="9159dfe3-b11f-457c-b41b-e296872027a0"
VAPI_DEMO_ASSISTANT_ID="db066c6c-e2e3-424e-9fd1-1473f2ac3b01"

echo "=========================================="
echo "🚀 Deploying VAPI Demo to Production"
echo "=========================================="
echo ""
echo "Project: $PROJECT_REF"
echo ""

# Step 1: Link to project
echo "📍 Step 1: Linking to Supabase project..."
npx supabase link --project-ref $PROJECT_REF

# Step 2: Deploy edge function
echo ""
echo "📦 Step 2: Deploying vapi-demo-call edge function..."
npx supabase functions deploy vapi-demo-call --project-ref $PROJECT_REF

# Step 3: Set secrets
echo ""
echo "🔐 Step 3: Setting secrets..."
npx supabase secrets set VAPI_PUBLIC_KEY="$VAPI_PUBLIC_KEY" --project-ref $PROJECT_REF
npx supabase secrets set VAPI_DEMO_ASSISTANT_ID="$VAPI_DEMO_ASSISTANT_ID" --project-ref $PROJECT_REF

# Step 4: Verify deployment
echo ""
echo "✅ Step 4: Verifying deployment..."
echo ""
curl -s -X POST "https://$PROJECT_REF.supabase.co/functions/v1/vapi-demo-call" \
  -H "Content-Type: application/json" | jq . || echo "Response received (jq not available)"

echo ""
echo "=========================================="
echo "✨ Deployment Complete!"
echo "=========================================="
echo ""
echo "Test the demo at: https://ringsnap.app"
echo ""
