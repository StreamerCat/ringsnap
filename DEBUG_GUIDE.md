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

### Step 1: Check Browser Console
1. Open DevTools: `F12` or `Cmd+Opt+I`
2. Go to "Console" tab
3. Try the provisioning flow
4. Look for `[OnboardingNumberStep]` logs
5. Take note of any errors

### Step 2: Check Supabase Edge Function Logs
1. Go to Supabase Dashboard
2. Navigate to **Functions** → **provision_number** → **Logs**
3. Look for your request (sort by timestamp)
4. Check the response and any error messages

### Step 3: Verify Environment Variables
```bash
# In Supabase Dashboard → Project Settings → Functions → Environment Variables
# Make sure these exist:
- VAPI_API_KEY (must start with sk_)
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
```

### Step 4: Test Vapi API Directly
```bash
# Test if Vapi API is reachable
curl -X GET "https://api.vapi.ai/phone-number" \
  -H "Authorization: Bearer YOUR_VAPI_KEY"

# Should return 200 with phone number list
```

## Common Errors & Solutions

### Error: "Failed to provision number" (no details)
**Cause**: Edge Function returned error or no data
**Solution**:
1. Check browser console for detailed logs
2. Check Supabase function logs
3. Verify VAPI_API_KEY is set correctly

### Error: "This area code is not available"
**Cause**: Vapi doesn't have numbers in that area code
**Solution**:
1. Try different area codes (312, 415, 510, 720, 917, etc.)
2. Vapi availability varies by region

### Error: "Unable to connect to provisioning service"
**Cause**: API connectivity issue
**Solution**:
1. Check internet connection
2. Check Supabase service status
3. Verify VAPI_API_KEY and Vapi API is accessible

### Error: "Network error"
**Cause**: Request timed out or network issue
**Solution**:
1. Check network connection
2. Try again (provisioning can take time)
3. Check Supabase function execution time (should be < 20s)

## What to Look For in Logs

### Successful Provisioning:
```
[OnboardingNumberStep] Starting provisioning for area code: 303 account: abc-123
[OnboardingNumberStep] Response received: { data: { status: "active", number: "+13035551234" }, error: null }
[OnboardingNumberStep] Number activated: +13035551234
```

### Pending Provisioning (will complete in background):
```
[OnboardingNumberStep] Starting provisioning for area code: 303 account: abc-123
[OnboardingNumberStep] Response received: { data: { status: "pending", ... }, error: null }
[OnboardingNumberStep] Number provisioning in background
```

### Error Response:
```
[OnboardingNumberStep] Starting provisioning for area code: 303 account: abc-123
[OnboardingNumberStep] Response received: { data: { status: "failed", error: "area code not available" }, error: null }
[OnboardingNumberStep] Provisioning failed: area code not available
```

### Function Error (invocation failed):
```
[OnboardingNumberStep] Starting provisioning for area code: 303 account: abc-123
[OnboardingNumberStep] Function error: FunctionRelayError: ...
```

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
