# Deploy Edge Functions to Fix 403 Error

## Problem
The `send-magic-link` edge function is returning **403 Access denied** because:
- The `config.toml` was updated locally with `verify_jwt = false`
- But the functions haven't been redeployed to production
- The deployed version still uses the old config (or missing config)

## Solution: Deploy Edge Functions

### Option 1: Deploy All Edge Functions (Recommended)

```bash
# Login to Supabase (if not already logged in)
npx supabase login

# Link to the project
npx supabase link --project-ref rmyvvbqnccpfeyowidrq

# Deploy all functions
npx supabase functions deploy
```

### Option 2: Deploy Only Auth Functions (Faster)

```bash
# Deploy only the auth-related functions
npx supabase functions deploy send-magic-link
npx supabase functions deploy verify-magic-link
npx supabase functions deploy send-password-reset
```

### Verify Deployment

After deploying, test the function:

```bash
# Test send-magic-link
./test-magic-link.sh your@email.com

# Should return:
# - Status: 200 (not 403)
# - Response: {"success": true, "message": "Magic link sent!..."}
```

## Verify Config Is Applied

After deployment, the edge function should:
1. Accept unauthenticated requests (no Authorization header needed)
2. Return 200 status on valid requests
3. Send emails via Resend

## If Deployment Fails

### Check Login Status
```bash
npx supabase status
```

### Check Project Link
```bash
npx supabase projects list
```

### Manual Deploy via Supabase Dashboard
1. Go to: https://supabase.com/dashboard/project/rmyvvbqnccpfeyowidrq/functions
2. Click on each function
3. Click "Deploy" or "Redeploy"

## Expected Result

After deployment:
- ✅ `./test-magic-link.sh` returns 200 status
- ✅ Magic link emails sent successfully
- ✅ Password reset emails sent successfully
- ✅ `/auth/login` page works completely

---

**Note:** The config.toml changes (commit 5fd7372) added the missing function configurations, but functions must be redeployed for the changes to take effect in production.
