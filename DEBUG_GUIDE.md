# Phone Provisioning Debugging Guide

## What Was Fixed

### 1. **Back Button Issue** ✅
**Problem**: Users could click "Back" during phone provisioning, reverting to Step 2 and losing their provisioning state.

**Solution**:
- Disabled "Back" button on Step 3 (phone provisioning)
- Added tooltip: "Complete phone provisioning to proceed"
- Added info alert explaining this is the final step

### 2. **Error Message Visibility** ✅
**Problem**: Error messages were only shown in small form field errors, easy to miss.

**Solution**:
- Added dedicated `errorMessage` state
- Show prominent red alert at top of component when errors occur
- Clear error messages on reset
- Different error messages for different failure scenarios

### 3. **Missing Debug Logging** ✅
**Problem**: No way to know what was happening when provisioning failed.

**Solution**:
Added console.log statements that log:
```
[OnboardingNumberStep] Starting provisioning for area code: 303 account: <uuid>
[OnboardingNumberStep] Response received: { data: {...}, error: null }
[OnboardingNumberStep] Number activated: +13035551234
```

Check your browser DevTools (F12 → Console tab) to see these logs when testing.

### 4. **Better Error Handling** ✅
**Problem**: Function errors and response errors weren't being handled consistently.

**Solution**:
- Parse Edge Function errors from response body
- Detect error patterns (API, network, area code, timeout)
- Show user-friendly error messages instead of technical ones
- Log all errors to console for debugging

## How to Debug if Issues Persist

### Step 1: Check Browser Console (Frontend Logs)
1. Open DevTools: `F12` or `Cmd+Opt+I`
2. Go to "Console" tab (and keep it open during testing)
3. Start the onboarding wizard and go to Step 3
4. Click "Get Number" with an area code
5. Look for logs starting with `[OnboardingNumberStep]`

**Expected log sequence (successful):**
```
[OnboardingNumberStep] Starting provisioning for area code: 303 account: <uuid>
[OnboardingNumberStep] Response received: {
  data: { status: "active", number: "+13035551234", ... },
  error: null,
  dataKeys: [...],
  dataStatus: "active",
  dataNumber: "+13035551234",
  dataError: undefined
}
[OnboardingNumberStep] ✓ SUCCESS: Number activated: +13035551234
```

**Expected log sequence (error):**
```
[OnboardingNumberStep] Starting provisioning for area code: 303 account: <uuid>
[OnboardingNumberStep] Response received: {
  data: { status: "failed", error: "VAPI_API_KEY not configured. Please contact support." },
  error: null,
  dataStatus: "failed",
  dataError: "VAPI_API_KEY not configured. Please contact support."
}
[OnboardingNumberStep] ✗ FAILED: Provisioning failed: {
  status: "failed",
  error: "VAPI_API_KEY not configured. Please contact support.",
  fullResponse: { ... }
}
```

### Step 2: Check Supabase Edge Function Logs (Backend Logs)
1. Go to Supabase Dashboard → Your Project
2. Navigate to **Functions** → **provision_number**
3. Click the **Logs** tab
4. Look for the most recent invocation (should have timestamp matching your attempt)

**Expected log output (successful):**
```
[provision_number] Request received: POST
[provision_number] Request body: { areaCode: "303", accountId: "<uuid>" }
[provision_number] Validation passed, starting provisioning
[provision_number] VAPI_API_KEY found
[provision_number] Updating account status to provisioning
[provision_number] Account status updated
[provision_number] Creating phone number on Vapi
[provision_number] Vapi creation result: { created: { id: "...", status: "pending", number: "+13035551234" }, createError: null }
[provision_number] Phone created on Vapi: <vapi-id>
[provision_number] Starting polling for phone activation
[provision_number] Polling result: { finalPhone: { id: "...", status: "active", number: "+13035551234" }, pollError: null }
[provision_number] Final status: active
[provision_number] Upserting phone record
[provision_number] Upsert result: { inserted: { id: "...", ... }, upsertError: null }
[provision_number] Updating account with phone info
[provision_number] Provisioning complete, returning response
[provision_number] Returning active status with number: +13035551234
```

**Expected log output (VAPI_API_KEY missing):**
```
[provision_number] Request received: POST
[provision_number] Request body: { areaCode: "303", accountId: "<uuid>" }
[provision_number] Validation passed, starting provisioning
[provision_number] VAPI_API_KEY not configured
```

### Step 3: Verify Environment Variables are Set
1. Go to Supabase Dashboard → Your Project
2. Go to **Project Settings** → **Functions** (scroll down)
3. Look for "Environment variables" section
4. You should see these variables set:
   - `VAPI_API_KEY` - Should start with `sk_` (from Vapi)
   - `SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key

**If VAPI_API_KEY is missing:**
- This is the most common cause of failures
- Get it from your Vapi Dashboard → API Keys
- Add it to Supabase project settings
- Redeploy the function (Supabase auto-redeploys when env vars change)

### Step 4: Test Vapi API Directly
```bash
# Test if your Vapi API key works
curl -X GET "https://api.vapi.ai/phone-number" \
  -H "Authorization: Bearer YOUR_VAPI_KEY"

# Should return 200 with list of phone numbers
# If you get 401, the API key is invalid
```

### Step 5: Manual Function Test (Advanced)
1. Go to Supabase Dashboard → Functions → **provision_number**
2. Click "Execute" button
3. Paste this test request body:
```json
{
  "areaCode": "415",
  "accountId": "<your-account-id>"
}
```
4. Click "Execute"
5. Check if you see success or an error message
6. Check the logs to see exactly where it fails

## Common Errors & Solutions

### Error: "Provisioning service is not properly configured"
**Cause**: `VAPI_API_KEY` environment variable is missing or not set
**How to debug:**
1. Check browser console: Look for `[OnboardingNumberStep] Response received:` with `dataError: "VAPI_API_KEY not configured..."`
2. Check Supabase logs: Look for `[provision_number] VAPI_API_KEY not configured`
3. Verify env var is set in Supabase Dashboard → Project Settings → Functions → Environment variables
4. Env var must be set BEFORE function is deployed

**Solution:**
1. Get your API key from Vapi Dashboard → API Keys
2. Go to Supabase Dashboard → Your Project
3. Project Settings → Functions → Environment variables
4. Add: `VAPI_API_KEY` = `sk_xxxxxxxx...`
5. Save and wait for auto-redeploy
6. Try provisioning again

### Error: "This area code is not available"
**Cause**: Vapi doesn't have phone numbers available in that area code
**How to debug:**
1. Check browser console: Look for `dataError: "not available"` or `"exhausted"`
2. Check Supabase logs: Look for response from Vapi with similar message

**Solution:**
1. Try different area codes (known working: 312, 415, 510, 720, 917, 212, 646)
2. Check Vapi's documentation for availability
3. Try area codes with historically high availability

### Error: "Unable to connect to provisioning service"
**Cause**: Network or API connectivity issue with Vapi
**How to debug:**
1. Check browser console: Look for `dataError: "VAPI" or "api"`
2. Check Supabase logs: Look for `[provision_number] Vapi creation result:` with `createError`
3. Check if Vapi API is accessible: `curl -H "Authorization: Bearer YOUR_KEY" https://api.vapi.ai/phone-number`

**Solution:**
1. Check your internet connection
2. Verify Vapi API key is valid
3. Check Vapi's status page for any outages
4. Try again in a few moments

### Error: "Database error occurred"
**Cause**: Supabase database operation failed
**How to debug:**
1. Check browser console: Look for `dataError: "Database"`
2. Check Supabase logs: Look for `[provision_number] Failed to update account:` or `[provision_number] Failed to upsert phone record:`

**Solution:**
1. Check Supabase database status (Dashboard → Status page)
2. Verify database hasn't hit row limits
3. Check RLS policies are correct
4. Try again

### Error: "Network error" or "Request timed out"
**Cause**: Network issue or request taking longer than 20 seconds
**How to debug:**
1. Check browser console: Look for `dataError: "network"` or `"timeout"`
2. Check Supabase logs: If logs stop mid-execution, function timed out
3. Check your network connection speed

**Solution:**
1. Check internet connection
2. Try again (provisioning can take time)
3. If persistent, the Vapi API may be slow - contact Vapi support

## What to Look For in Logs

### ✓ Successful Provisioning (Number Active Immediately):
```
[OnboardingNumberStep] Starting provisioning for area code: 303 account: abc-123-uuid
[OnboardingNumberStep] Response received: {
  data: { status: "active", number: "+13035551234", phoneId: "abc-def-123", phone: {...} },
  error: null,
  dataKeys: [...],
  dataStatus: "active",
  dataNumber: "+13035551234",
  dataError: undefined
}
[OnboardingNumberStep] ✓ SUCCESS: Number activated: +13035551234
```

**What it means**: Your number is ready to use immediately!

### ⏳ Pending Provisioning (will complete in background):
```
[OnboardingNumberStep] Starting provisioning for area code: 303 account: abc-123-uuid
[OnboardingNumberStep] Response received: {
  data: { status: "pending", number: "+13035551234", phoneId: "abc-def-123", error: "Phone is still provisioning..." },
  error: null,
  dataStatus: "pending",
  dataNumber: "+13035551234",
  dataError: "Phone is still provisioning..."
}
[OnboardingNumberStep] ⏳ PENDING: Number provisioning in background { number: "+13035551234", phoneId: "abc-def-123" }
```

**What it means**: Your number is being set up. You'll get an email when it's ready. This is normal!

### ✗ Failed - Invalid Area Code:
```
[OnboardingNumberStep] Starting provisioning for area code: 999 account: abc-123-uuid
[OnboardingNumberStep] Response received: {
  data: { status: "failed", error: "Invalid area code. Must be 3 digits (e.g., 303)." },
  dataError: "Invalid area code..."
}
[OnboardingNumberStep] ✗ FAILED: Provisioning failed: {
  status: "failed",
  error: "Invalid area code. Must be 3 digits (e.g., 303).",
  fullResponse: { ... }
}
```

**What to do**: Enter a valid 3-digit area code (e.g., 303, 415, 510)

### ✗ Failed - Area Code Not Available:
```
[OnboardingNumberStep] ✗ FAILED: Provisioning failed: {
  status: "failed",
  error: "Area code 303 is not available. No numbers found in area.",
  fullResponse: { ... }
}
```

**What to do**: Try a different area code (415, 510, 312, 720, 917 usually work)

### ✗ Failed - VAPI_API_KEY Not Configured:
```
[OnboardingNumberStep] Response received: {
  data: { status: "failed", error: "VAPI_API_KEY not configured. Please contact support." },
  dataError: "VAPI_API_KEY not configured..."
}
[OnboardingNumberStep] ✗ FAILED: Provisioning failed: {
  status: "failed",
  error: "VAPI_API_KEY not configured. Please contact support.",
  fullResponse: { ... }
}
```

**What to do**:
1. Check Supabase Dashboard → Project Settings → Functions → Environment variables
2. Verify `VAPI_API_KEY` is set and starts with `sk_`
3. If missing, add it and wait for auto-redeploy

### ✗ Failed - Network/API Error:
```
[OnboardingNumberStep] Response received: {
  data: { status: "failed", error: "Vapi API error: 502" },
  dataError: "Vapi API error: 502"
}
[OnboardingNumberStep] ✗ FAILED: Provisioning failed: {
  status: "failed",
  error: "Vapi API error: 502",
  fullResponse: { ... }
}
```

**What to do**: Check Vapi's status page or try again in a moment

### ⚠️ Unexpected Response (Should Not Happen):
```
[OnboardingNumberStep] Response received: {
  data: { status: "unknown_status", ... },
  dataStatus: "unknown_status"
}
[OnboardingNumberStep] ⚠️ UNEXPECTED: Unexpected response status: {
  status: "unknown_status",
  fullResponse: { ... }
}
[OnboardingNumberStep] ✗ CATCH: Provisioning error caught: {
  message: "Unexpected response status: unknown_status",
  errorType: "Error",
  fullError: Error
}
```

**What to do**: This is unusual. Check both browser console and Supabase logs. Contact support if issue persists.

## Testing Checklist

- [ ] Open DevTools Console (F12)
- [ ] Go through onboarding steps 1-2
- [ ] Click "Get Number" on Step 3
- [ ] Watch console logs appear
- [ ] Try valid area code (e.g., 415, 510, 312)
- [ ] Try invalid area code (e.g., 999)
- [ ] Verify error messages appear prominently
- [ ] Verify "Back" button is disabled on Step 3
- [ ] Try to go back (should be prevented)
- [ ] Check Supabase function logs for execution details

## Next Steps if Still Not Working

If you still see issues after these fixes:

1. **Get detailed logs**:
   - Screenshot the console errors
   - Copy Edge Function logs from Supabase
   - Note the exact error message

2. **Check the Edge Function**:
   - Run the function manually from Supabase dashboard
   - Test with hardcoded values to isolate issue
   - Check function execution time

3. **Verify Vapi**:
   - Confirm API key works
   - Try Vapi's number availability endpoint directly
   - Check Vapi's status page for outages

---

**The main improvements made ensure that:**
- Errors are visible and actionable
- Users can't accidentally lose state by going back
- Debugging is much easier with console logs
- The UI clearly communicates what's happening at each step
