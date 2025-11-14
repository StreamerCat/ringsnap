# Deploy Auth Functions to Fix Access Denied Error

## What This Fixes

The `verify-magic-debug` and other auth functions are returning **403 Access denied** because:
- The functions either don't exist in production or have outdated configurations
- The `config.toml` has `verify_jwt = false` but needs to be deployed
- The new `verify-magic-debug` function needs to be deployed for the first time

## Functions to Deploy

1. **send-magic-link** - Sends magic link emails
2. **verify-magic-link** - Verifies magic link tokens and creates sessions
3. **verify-magic-debug** - NEW: Debug endpoint to check token validity without consuming it
4. **send-password-reset** - Sends password reset emails

## Deployment Options

### Option 1: GitHub Actions (Recommended)

The changes have been committed to branch `claude/verify-magic-debug-015hEwvrgCgmToysv4PADBBs`.

When merged to `main`, the GitHub Actions workflow will automatically deploy all functions.

**Manual trigger:**
1. Go to: https://github.com/StreamerCat/ringsnap/actions/workflows/deploy-supabase-functions.yml
2. Click "Run workflow"
3. Select branch: `claude/verify-magic-debug-015hEwvrgCgmToysv4PADBBs` or `main`
4. Click "Run workflow"

### Option 2: Manual Deployment via CLI

```bash
# 1. Login to Supabase
npx supabase login

# 2. Link to the project
npx supabase link --project-ref rmyvvbqnccpfeyowidrq

# 3. Deploy only the auth functions
npx supabase functions deploy send-magic-link
npx supabase functions deploy verify-magic-link
npx supabase functions deploy verify-magic-debug
npx supabase functions deploy send-password-reset

# OR deploy all functions at once
npx supabase functions deploy
```

### Option 3: Manual Deployment via Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/rmyvvbqnccpfeyowidrq/functions
2. For each function that needs updating:
   - Click on the function name
   - Click "Deploy" or "Redeploy"
   - Upload the function code from `supabase/functions/{function-name}/`

## Verify Deployment

After deployment, test the functions:

### Test verify-magic-debug (NEW)
```bash
curl -s -X POST "https://rmyvvbqnccpfeyowidrq.supabase.co/functions/v1/verify-magic-debug" \
  -H "Content-Type: application/json" \
  -d '{"token":"test-token-here"}'

# Expected: 200 status with JSON response showing token validation details
```

### Test send-magic-link
```bash
./test-magic-link.sh your@email.com

# Expected:
# - Status: 200 (not 403)
# - Response: {"success": true, ...}
```

### Test verify-magic-link
```bash
curl -s -X POST "https://rmyvvbqnccpfeyowidrq.supabase.co/functions/v1/verify-magic-link" \
  -H "Content-Type: application/json" \
  -d '{"token":"actual-magic-link-token"}'

# Expected: 401 for invalid token (not 403 Access denied)
```

## What verify-magic-debug Does

The new `verify-magic-debug` endpoint allows you to:
- Check if a magic link token is valid **without consuming it**
- See token expiration status
- Check device nonce matching
- Debug magic link issues in development/staging

Unlike `verify-magic-link`, this endpoint:
- Does NOT mark tokens as used
- Does NOT create sessions
- Returns detailed debugging information

### Example Response

```json
{
  "valid": true,
  "reason": "Token is valid and ready to use",
  "debug": {
    "timestamp": "2025-11-14T21:00:00.000Z",
    "providedDeviceNonce": "abc123...",
    "totalMatches": 1,
    "validMatches": 1,
    "tokens": [
      {
        "email": "user@example.com",
        "created_at": "2025-11-14T20:50:00.000Z",
        "expires_at": "2025-11-14T21:10:00.000Z",
        "used_at": null,
        "device_nonce": "abc123...",
        "device_match": true,
        "is_expired": false,
        "is_used": false,
        "is_valid": true
      }
    ]
  }
}
```

## Expected Results

After deployment:
- ✅ `verify-magic-debug` returns 200 with token debug info
- ✅ `send-magic-link` returns 200 and sends emails
- ✅ `verify-magic-link` returns 200 for valid tokens (401 for invalid)
- ✅ `send-password-reset` returns 200 and sends emails
- ✅ Login and password reset flows work end-to-end

## Configuration

All functions have `verify_jwt = false` in `supabase/config.toml`:

```toml
[functions.send-magic-link]
verify_jwt = false

[functions.verify-magic-link]
verify_jwt = false

[functions.verify-magic-debug]
verify_jwt = false

[functions.send-password-reset]
verify_jwt = false
```

This allows unauthenticated requests, which is necessary for login/signup flows.
