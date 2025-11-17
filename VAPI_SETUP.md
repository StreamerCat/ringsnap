# VAPI Voice Demo Setup Guide

## Issue Identified

The `vapi-demo-call` edge function is currently returning **HTTP 403 "Access denied"**, which means it's either not deployed or has access restrictions.

## Step 1: Deploy Edge Function to Production

The edge function needs to be deployed to your Supabase project. Run:

```bash
# Login to Supabase (if not already logged in)
npx supabase login

# Link to your project
npx supabase link --project-ref lytnlrkdccqmxgdmdxef

# Deploy the edge function
npx supabase functions deploy vapi-demo-call
```

## Step 2: Set Up VAPI Secrets

After deploying the function, you need to set the required secrets in your Supabase project.

### Required Secrets:

1. **VAPI_PUBLIC_KEY** - Your VAPI public key
2. **VAPI_DEMO_ASSISTANT_ID** - Your VAPI demo assistant ID

### How to Set Secrets:

**Option 1: Via Supabase CLI**
```bash
npx supabase secrets set VAPI_PUBLIC_KEY="your-vapi-public-key-here"
npx supabase secrets set VAPI_DEMO_ASSISTANT_ID="your-vapi-assistant-id-here"
```

**Option 2: Via Supabase Dashboard**
1. Go to https://supabase.com/dashboard/project/lytnlrkdccqmxgdmdxef
2. Click on "Edge Functions" in the left sidebar
3. Click on "vapi-demo-call" function
4. Go to the "Secrets" tab
5. Add both secrets:
   - Key: `VAPI_PUBLIC_KEY`, Value: (your VAPI public key)
   - Key: `VAPI_DEMO_ASSISTANT_ID`, Value: (your VAPI assistant ID)

### Where to Find VAPI Credentials:

1. Log in to your VAPI dashboard at https://dashboard.vapi.ai
2. **Public Key**: Found in Settings → API Keys
3. **Assistant ID**: Found in Assistants → Select your demo assistant → Copy the ID from the URL or assistant details

## Step 3: Verify Edge Function Works

After deploying and setting secrets, test the function:

```bash
# Run the test script
npm run test:vapi-demo
```

Or manually test:
```bash
curl -X POST "https://lytnlrkdccqmxgdmdxef.supabase.co/functions/v1/vapi-demo-call" \
  -H "Content-Type: application/json"
```

### Expected Response (Success):
```json
{
  "publicKey": "your-vapi-public-key",
  "assistantId": "your-vapi-assistant-id"
}
```

### Expected Response (Missing Secrets):
```json
{
  "error": "Voice demo service not configured"
}
```

### Unexpected Response (Not Deployed):
```
Access denied
```
→ This means the function needs to be deployed (see Step 1)

## Step 4: Test in Browser

Once the edge function is deployed and secrets are set:

1. Open your RingSnap website
2. Navigate to the "Hear It in Action" demo
3. Open browser DevTools (F12) → Console tab
4. Click "Hear It in Action" button
5. Watch the console for detailed logs:

```
[Voice Demo] Loading configuration... { retryCount: 0 }
[Voice Demo] Response received: { status: 200, ok: true }
[Voice Demo] Configuration loaded successfully { hasPublicKey: true, hasAssistantId: true }
[Voice Demo] Initialization complete
```

## Troubleshooting

### Error: "Access denied" (HTTP 403)
→ Edge function not deployed. Run deployment command in Step 1.

### Error: "Voice demo service not configured"
→ Secrets not set. Follow Step 2 to add VAPI secrets.

### Error: "Voice demo temporarily unavailable"
→ VAPI service might be down or credentials are invalid. Verify credentials in VAPI dashboard.

### Error: "Microphone access required"
→ User denied microphone permission. Prompt them to allow access.

### Error: "Connection took too long"
→ Network issue or VAPI service slow. Check internet connection.

## Configuration File Reference

The edge function configuration is in: `supabase/config.toml`

```toml
[functions.vapi-demo-call]
verify_jwt = false  # No authentication required (public demo)
```

## Code References

- Edge Function: `supabase/functions/vapi-demo-call/index.ts`
- Frontend Component: `src/components/SolutionDemo.tsx`
- Required Environment Variables:
  - `VAPI_PUBLIC_KEY` (Supabase secret)
  - `VAPI_DEMO_ASSISTANT_ID` (Supabase secret)

## Security Notes

- ✅ VAPI public key is safe to expose to frontend (it's public by design)
- ✅ VAPI assistant ID is safe to expose (it's a demo assistant)
- ✅ Private keys are NEVER exposed or used client-side
- ✅ All VAPI branding removed from user-facing error messages
- ✅ Comprehensive error handling with retry logic (2 retries with exponential backoff)

## Need Help?

If you continue experiencing issues:
1. Check Supabase Edge Function logs in the dashboard
2. Verify VAPI credentials are valid in VAPI dashboard
3. Ensure the function is deployed (not just locally available)
4. Check browser console for detailed error messages with `[Voice Demo]` prefix
