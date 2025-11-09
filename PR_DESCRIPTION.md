## Summary

Fixes critical timeout issue in trial signup flow by making VAPI provisioning asynchronous.

### Problem
The trial signup edge function was timing out with "FunctionsFetchError: Failed to send a request" because it was **blocking for 1-2 minutes** waiting for VAPI resources to provision. This caused:
- Edge function timeout (exceeds 60-second limit)
- Users stuck on "Processing..." spinner
- Signup failures even when Stripe payment succeeded

### Solution
Changed VAPI provisioning from **synchronous (blocking)** to **asynchronous (fire-and-forget)**:

**Before (BLOCKING)**:
```typescript
const provisionResponse = await supabase.functions.invoke('provision-resources', {...});
// ☝️ Waits 1-2 minutes for VAPI = TIMEOUT
```

**After (ASYNC)**:
```typescript
supabase.functions.invoke('provision-resources', {...})
  .then((response) => { /* log success */ })
  .catch((error) => { /* log error */ });
// ☝️ Triggers but doesn't wait = NO TIMEOUT
```

### New Flow
1. ✅ Create auth user (instant)
2. ✅ Create Stripe customer + subscription with 3-day trial (1-2 seconds)
3. ✅ Create account record (instant)
4. ✅ Create profile record (instant)
5. ✅ **Trigger VAPI provisioning in background** (fire-and-forget)
6. ✅ **Return success immediately** (5-15 second total)
7. 🔄 VAPI finishes provisioning 1-2 minutes later

### Expected Results
✅ No more timeout errors
✅ Signup completes in 5-15 seconds (not 1-2 minutes)
✅ Stripe customer + subscription created immediately
✅ User redirected to dashboard/confirmation page
✅ VAPI provisions in background (check after 2-3 mins)

### Testing
After deploying the edge function:
1. Complete trial signup with test card `4242 4242 4242 4242`
2. Should succeed within 15 seconds
3. Verify Stripe customer/subscription created
4. Verify account/profile in database
5. Wait 2-3 minutes, verify VAPI resources provisioned

## Files Changed
- `supabase/functions/free-trial-signup/index.ts` - Async VAPI provisioning
- `ASYNC_VAPI_FIX_DEPLOYMENT.md` - Deployment guide

## Test Plan
- [ ] Trial signup completes without timeout
- [ ] Stripe customer created
- [ ] Stripe subscription created with 3-day trial
- [ ] Account record created
- [ ] Profile record created
- [ ] VAPI resources provision in background (verify after 2-3 mins)
- [ ] User redirected to dashboard
- [ ] No console errors
