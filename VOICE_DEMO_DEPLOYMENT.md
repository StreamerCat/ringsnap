# Voice Demo Deployment Guide

## Quick Deployment (5 Minutes)

### Step 1: Deploy Edge Function

```bash
# Login to Supabase
npx supabase login

# Link to your project
npx supabase link --project-ref lytnlrkdccqmxgdmdxef

# Deploy the voice demo edge function
npx supabase functions deploy vapi-demo-call
```

### Step 2: Configure Secrets

Set the required secrets for the voice demo:

```bash
# Set the public key (get from https://dashboard.vapi.ai → Settings → API Keys)
npx supabase secrets set VAPI_PUBLIC_KEY="9159dfe3-b11f-457c-b41b-e296872027a0"

# Set the assistant ID
npx supabase secrets set VAPI_DEMO_ASSISTANT_ID="db066c6c-e2e3-424e-9fd1-1473f2ac3b01"
```

### Step 3: Verify Deployment

```bash
npm run test:voice-demo
```

**Expected Output:**
```
✅ SUCCESS - Edge function is deployed and working!
✅ Voice demo secrets are configured correctly
🎉 Voice demo should work!
```

---

## Troubleshooting

### Error: "Access denied" (HTTP 403)
**Cause:** Edge function not deployed
**Fix:** Run Step 1 above

### Error: "Voice demo service not configured"
**Cause:** Secrets not set or incorrect
**Fix:** Run Step 2 above, verify secrets in dashboard

### Error: "Demo temporarily unavailable"
**Cause:** Network issue or service temporarily down
**Fix:** Check internet connection, try again in a few minutes

### Error: "Microphone access required"
**Cause:** User denied microphone permission
**Fix:** Allow microphone access in browser settings

---

## Manual Deployment via Dashboard

1. Go to https://supabase.com/dashboard/project/lytnlrkdccqmxgdmdxef
2. Click "Edge Functions" in sidebar
3. Click "Deploy new function"
4. Select `vapi-demo-call` folder
5. Deploy

Then add secrets:
1. Click on deployed function
2. Go to "Secrets" tab
3. Add:
   - `VAPI_PUBLIC_KEY` = `9159dfe3-b11f-457c-b41b-e296872027a0`
   - `VAPI_DEMO_ASSISTANT_ID` = `db066c6c-e2e3-424e-9fd1-1473f2ac3b01`

---

## Testing

### Browser Test
1. Open https://ringsnap.app
2. Scroll to "Hear It in Action" section
3. Click the button
4. Allow microphone when prompted
5. Should connect to voice demo

### Console Logs
Open DevTools (F12) → Console, look for:
```
[Voice Demo] Loading configuration...
[Voice Demo] Configuration loaded successfully
[Voice Demo] Initialization complete
```

### Network Test
Open DevTools → Network tab, filter for "vapi-demo-call"
- Should see POST request with status 200
- Response should contain `publicKey` and `assistantId`

---

## Architecture

```
User Browser
    ↓ (clicks button)
SolutionDemo.tsx
    ↓ (POST request)
Edge Function: vapi-demo-call
    ↓ (returns credentials)
Voice Demo Client
    ↓ (connects to service)
Voice AI Assistant
```

**Security:**
- Public key is safe to expose (it's public by design)
- Assistant ID is safe to expose (demo assistant only)
- No private keys are ever sent to browser
- All credentials fetched from secure edge function

---

## Files

- **Frontend:** `src/components/SolutionDemo.tsx`
- **Edge Function:** `supabase/functions/vapi-demo-call/index.ts`
- **Config:** `supabase/config.toml` (verify_jwt = false)
- **Test Script:** `scripts/test-voice-demo.sh`

---

## Support

If issues persist after following this guide:
1. Check browser console for detailed error messages (prefix: `[Voice Demo]`)
2. Run `npm run test:voice-demo` to diagnose
3. Verify secrets are set correctly in Supabase dashboard
4. Check Edge Function logs in Supabase dashboard

---

## Credentials Reference

**Project:** lytnlrkdccqmxgdmdxef
**Public Key:** 9159dfe3-b11f-457c-b41b-e296872027a0
**Assistant ID:** db066c6c-e2e3-424e-9fd1-1473f2ac3b01

These credentials are for the demo assistant and are safe to use in production.
