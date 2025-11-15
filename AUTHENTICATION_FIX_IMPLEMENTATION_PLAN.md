# Authentication System - Implementation Plan
**Option A: Targeted Fixes (Recommended for Immediate Resolution)**

## Overview
This document provides step-by-step instructions to fix the critical authentication issues identified in the audit. The fixes are designed to be minimal, low-risk, and quick to implement.

**Estimated Time**: 1-2 hours
**Risk Level**: Low
**Impact**: Restores magic link authentication functionality

---

## Prerequisites

Before starting, ensure you have:
- [ ] Access to the repository with write permissions
- [ ] Supabase CLI installed and configured
- [ ] Node.js and npm installed
- [ ] Test email account for verification
- [ ] Access to Supabase dashboard
- [ ] Access to Resend dashboard (for monitoring)

---

## Fix #1: Resolve Token Hashing Mismatch (CRITICAL)

### What's Wrong
The `send-magic-link` function stores tokens hashed with SHA256, but `verify-magic-link` tries to match them using HMAC-SHA256. These produce completely different hashes, so magic links never work.

### What We'll Do
Change `verify-magic-link` to use the same SHA256 hashing as `send-magic-link`.

### Step-by-Step Instructions

#### Step 1: Update verify-magic-link function

Open: `supabase/functions/verify-magic-link/index.ts`

**Replace lines 1-8** (the imports):
```typescript
import { serve } from "std/server";
import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";
```

**With this**:
```typescript
import { serve } from "std/server";
import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";
import { hashToken } from "../_shared/auth-utils.ts";
```

**Replace lines 22-24** (the token hashing):
```typescript
// Use HMAC-SHA256 with service role key so hash matches send-magic-link storage
const tokenHash = await hashTokenHmac(token, supabaseKey);
const nowIso = new Date().toISOString();
```

**With this**:
```typescript
// Use SHA256 to match send-magic-link hashing
const tokenHash = hashToken(token);
const nowIso = new Date().toISOString();
```

**Delete lines 121-129** (the old hashTokenHmac function):
```typescript
// HMAC-SHA256 helper that must align with send-magic-link hashing scheme
async function hashTokenHmac(token: string, key: string) {
  const enc = new TextEncoder();
  const keyData = enc.encode(key);
  const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(token));
  const arr = Array.from(new Uint8Array(sig));
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
}
```

**That's it!** The function now uses the same hashing algorithm.

#### Step 2: Update auth-utils.ts to export hashToken

Open: `supabase/functions/_shared/auth-utils.ts`

The `hashToken` function already exists at line 27-29, but we need to make sure it's using Node.js crypto properly for Deno.

**Replace line 2**:
```typescript
import { createHash, randomBytes } from 'node:crypto';
```

**With**:
```typescript
import { createHash, randomBytes } from 'https://deno.land/std@0.177.0/node/crypto.ts';
```

This ensures Deno can properly use the crypto functions.

#### Step 3: Deploy the fix

```bash
# Deploy the updated function
supabase functions deploy verify-magic-link

# Check deployment status
supabase functions list
```

#### Step 4: Test the fix

1. Open your app in a browser
2. Navigate to the login page
3. Enter your email address
4. Click "Continue with email"
5. Check your email for the magic link
6. Click the magic link
7. **You should be logged in!** ✅

If it doesn't work, check the Supabase logs:
```bash
supabase functions logs verify-magic-link
```

Look for errors and check the hash values being computed.

---

## Fix #2: Standardize Device Nonce Implementation

### What's Wrong
The frontend creates device nonces using `crypto.randomUUID()`, but the utility function in `auth-utils.ts` uses `randomBytes().toString('base64url')`. This inconsistency could cause issues.

### What We'll Do
Create a browser-compatible device nonce utility and use it consistently.

### Step-by-Step Instructions

#### Step 1: Create browser utility for device nonce

Create a new file: `src/lib/auth/deviceNonce.ts`

```typescript
/**
 * Device Nonce Utility
 * Creates a unique identifier for this device/browser to bind magic links
 */

const STORAGE_KEY = 'device_nonce';

/**
 * Get existing device nonce from localStorage or create a new one
 */
export function getOrCreateDeviceNonce(): string {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    // Server-side or no localStorage: generate ephemeral nonce
    return crypto.randomUUID();
  }

  let nonce = localStorage.getItem(STORAGE_KEY);

  if (!nonce) {
    nonce = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, nonce);
  }

  return nonce;
}

/**
 * Clear device nonce (useful for testing or logout)
 */
export function clearDeviceNonce(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}
```

#### Step 2: Update AuthLogin.tsx to use the utility

Open: `src/pages/AuthLogin.tsx`

**Add import at the top** (around line 11):
```typescript
import { getOrCreateDeviceNonce } from "@/lib/auth/deviceNonce";
```

**Replace lines 86-91**:
```typescript
// Get device nonce from localStorage or create one
let deviceNonce = localStorage.getItem("device_nonce");
if (!deviceNonce) {
  deviceNonce = crypto.randomUUID();
  localStorage.setItem("device_nonce", deviceNonce);
}
```

**With**:
```typescript
// Get device nonce from localStorage or create one
const deviceNonce = getOrCreateDeviceNonce();
```

#### Step 3: Update MagicCallback.tsx to use the utility

Open: `src/pages/MagicCallback.tsx`

**Add import at the top** (around line 7):
```typescript
import { getOrCreateDeviceNonce } from "@/lib/auth/deviceNonce";
```

**Replace line 30**:
```typescript
const deviceNonce = localStorage.getItem("device_nonce");
```

**With**:
```typescript
const deviceNonce = getOrCreateDeviceNonce();
```

#### Step 4: Test device binding

1. Log in on your computer using a magic link (should work)
2. Forward the magic link email to your phone
3. Try clicking the link on your phone (should fail with device mismatch error)

This confirms device binding is working correctly.

---

## Fix #3: Remove Unused Code

### What's Wrong
`auth-utils.ts` contains several unused functions that create confusion and potential bugs.

### What We'll Do
Add deprecation comments and document which functions are actually used.

### Step-by-Step Instructions

#### Step 1: Document unused functions

Open: `supabase/functions/_shared/auth-utils.ts`

**Add comments above unused functions**:

Before `createPasswordResetToken()` (line 99), add:
```typescript
/**
 * @deprecated This function is not used. Password reset uses Supabase's built-in
 * generateLink() API instead. See send-password-reset/index.ts line 55.
 * Kept for reference only.
 */
```

Before `validateAndConsumeToken()` (line 130), add:
```typescript
/**
 * @deprecated This function contains a race condition and is not used.
 * verify-magic-link implements atomic token consumption directly.
 * DO NOT USE THIS FUNCTION.
 */
```

Before `verify2FACode()` (line 322), add:
```typescript
/**
 * @deprecated Placeholder implementation. Only checks backup codes.
 * Full TOTP implementation pending.
 * See require-step-up function for actual 2FA verification.
 */
```

Before `getOrCreateDeviceNonce()` (line 261), add:
```typescript
/**
 * @deprecated This function uses Node.js crypto and cannot run in browser.
 * Use src/lib/auth/deviceNonce.ts instead for frontend code.
 */
```

#### Step 2: Add a README comment at the top of auth-utils.ts

**Add this comment after the imports** (around line 3):
```typescript
/**
 * Authentication Utilities
 *
 * ACTIVELY USED FUNCTIONS:
 * - generateToken() - Used by createMagicLinkToken, createInviteToken
 * - hashToken() - Used by verify-magic-link to hash tokens for lookup
 * - createMagicLinkToken() - Used by send-magic-link
 * - createInviteToken() - Used by staff invite system
 * - checkRateLimit() - Used by send-magic-link, other endpoints
 * - logAuthEvent() - Used by all auth edge functions
 * - requiresStepUp() - Used by require-step-up edge function
 * - updateStepUpTimestamp() - Used by require-step-up edge function
 * - buildAuthUrl() - Used by send-magic-link to build callback URLs
 * - createAdminClient() - Used by all edge functions
 *
 * DEPRECATED FUNCTIONS (see individual comments):
 * - createPasswordResetToken() - Use Supabase's generateLink() instead
 * - validateAndConsumeToken() - Has race condition, use atomic DB update
 * - verify2FACode() - Placeholder only
 * - getOrCreateDeviceNonce() - Use src/lib/auth/deviceNonce.ts for browser
 *
 * HELPER FUNCTIONS:
 * - getIpAddress() - Extract IP from request headers
 * - getUserAgent() - Extract user agent from request headers
 * - isValidEmail() - Email format validation
 */
```

---

## Fix #4: Consolidate Email Templates

### What's Wrong
There are two email template files with overlapping functionality, causing confusion.

### What We'll Do
Use `auth-email-templates.ts` as the single source of truth and update imports.

### Step-by-Step Instructions

#### Step 1: Update send-password-reset to use auth-email-templates

Open: `supabase/functions/send-password-reset/index.ts`

**Replace line 2**:
```typescript
import { buildPasswordResetEmail } from "../_shared/email-templates.ts";
```

**With**:
```typescript
import { buildPasswordSetResetEmail } from "../_shared/auth-email-templates.ts";
```

**Replace lines 73-76**:
```typescript
// Build email template
const emailContent = buildPasswordResetEmail({
  recipientName: profile?.name,
  resetLink: data.properties.action_link
});
```

**With**:
```typescript
// Build email template
const emailContent = buildPasswordSetResetEmail(
  data.properties.action_link,
  profile?.name || 'there',
  false, // isFirstTime
  60 // expiresInMinutes
);
```

#### Step 2: Add deprecation notice to old template file

Open: `supabase/functions/_shared/email-templates.ts`

**Add at the very top**:
```typescript
/**
 * @deprecated This file is deprecated. Use auth-email-templates.ts instead.
 * This file is kept only for backwards compatibility and will be removed in a future version.
 *
 * Migration status:
 * - buildPasswordResetEmail() → Use buildPasswordSetResetEmail() from auth-email-templates.ts
 * - buildTeamInviteEmail() → Use buildStaffInviteEmail() from auth-email-templates.ts
 */
```

#### Step 3: Deploy the updated function

```bash
supabase functions deploy send-password-reset
```

#### Step 4: Test password reset

1. Go to login page
2. Click "Forgot password?"
3. Enter your email
4. Check your email - should receive password reset email
5. Click the link - should be able to reset password

---

## Testing Checklist

After implementing all fixes, verify:

### Magic Link Authentication
- [ ] Can send magic link email
- [ ] Email received with correct branding
- [ ] Clicking link authenticates user
- [ ] User redirected to correct dashboard (role-based)
- [ ] Token cannot be reused (clicking again shows error)
- [ ] Link expires after 20 minutes
- [ ] Rate limiting works (max 5 per hour per email)
- [ ] Device binding works (link fails on different device)

### Password Reset
- [ ] Can request password reset
- [ ] Email received with reset link
- [ ] Can set new password
- [ ] Old password no longer works
- [ ] New password works for login
- [ ] Link expires after 60 minutes
- [ ] Used link cannot be reused

### Audit Logging
- [ ] Magic link sends logged to auth_events
- [ ] Magic link verifications logged to auth_events
- [ ] Failed attempts logged with success=false
- [ ] Email sends logged to email_events
- [ ] Rate limit violations logged

### Error Handling
- [ ] Invalid token shows friendly error
- [ ] Expired token shows appropriate message
- [ ] Network errors handled gracefully
- [ ] Email delivery failures logged

---

## Rollback Instructions

If something goes wrong, you can quickly rollback:

### Rollback Edge Functions
```bash
# List deployed versions
supabase functions list

# Revert to previous version
supabase functions deploy verify-magic-link --version <previous-version-id>
supabase functions deploy send-password-reset --version <previous-version-id>
```

### Rollback Frontend Code
```bash
# Revert your git changes
git checkout HEAD~1 src/pages/AuthLogin.tsx
git checkout HEAD~1 src/pages/MagicCallback.tsx
git checkout HEAD~1 src/lib/auth/deviceNonce.ts

# Rebuild and redeploy
npm run build
```

### Emergency Workaround
If magic links still don't work after fixes:
1. Tell users to use "Use password instead" option
2. Or use Google OAuth button
3. Password reset flow is working and can be used

---

## Monitoring After Deployment

### Check Supabase Logs
```bash
# Watch logs in real-time
supabase functions logs verify-magic-link --tail

# Check for errors in the last hour
supabase functions logs verify-magic-link --since=1h
```

### Monitor Database Tables

**Check auth_events for failures**:
```sql
SELECT
  event_type,
  success,
  event_data,
  ip_address,
  created_at
FROM auth_events
WHERE created_at > now() - interval '1 hour'
  AND success = false
ORDER BY created_at DESC
LIMIT 50;
```

**Check email_events for delivery issues**:
```sql
SELECT
  email_type,
  recipient,
  event,
  event_data,
  created_at
FROM email_events
WHERE created_at > now() - interval '1 hour'
  AND event IN ('bounced', 'failed')
ORDER BY created_at DESC;
```

**Check unused tokens**:
```sql
SELECT
  token_type,
  email,
  expires_at,
  device_nonce,
  created_at
FROM auth_tokens
WHERE used_at IS NULL
  AND expires_at > now()
ORDER BY created_at DESC
LIMIT 20;
```

### Monitor Resend Dashboard
1. Go to https://resend.com/emails
2. Check delivery rate (should be >98%)
3. Look for bounces or complaints
4. Verify click-through rates

---

## Performance Optimization (Optional)

If you notice slow authentication after fixes:

### Add Database Indexes
These indexes should already exist from the migration, but verify:
```sql
-- Check existing indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'auth_tokens';

-- If missing, add them:
CREATE INDEX IF NOT EXISTS idx_auth_tokens_token_hash ON auth_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_email_type ON auth_tokens(email, token_type);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_expires_used ON auth_tokens(expires_at, used_at);
```

### Monitor Query Performance
```sql
-- Find slow queries
SELECT
  query,
  calls,
  total_time,
  mean_time
FROM pg_stat_statements
WHERE query LIKE '%auth_tokens%'
ORDER BY mean_time DESC
LIMIT 10;
```

---

## Success Criteria

You'll know the fixes are successful when:

✅ Magic links work end-to-end
✅ No "Invalid or expired link" errors for valid links
✅ Authentication completes in < 2 seconds
✅ Email delivery rate > 98%
✅ No errors in Supabase logs
✅ All test cases pass
✅ Users can authenticate without issues

---

## Support and Troubleshooting

### Common Issues

**"Invalid or expired magic link" still appearing**:
- Check Supabase logs for the actual error
- Verify token hash in database matches computed hash
- Confirm edge function was deployed successfully

**Email not arriving**:
- Check spam folder
- Verify Resend dashboard shows email sent
- Check email_events table for delivery status
- Verify RESEND_API_KEY is set correctly

**Device binding not working**:
- Check browser console for localStorage errors
- Verify deviceNonce is being sent in request
- Check verify-magic-link logs for device_nonce value

**Rate limiting too aggressive**:
- Check auth_events for rate_limited events
- Adjust limits in send-magic-link/index.ts (lines 77, 104)
- Clear rate_limits table: `DELETE FROM rate_limits WHERE window_start < now();`

### Getting Help

If you encounter issues:

1. **Check logs first**:
   ```bash
   supabase functions logs verify-magic-link --tail
   ```

2. **Check database**:
   ```sql
   SELECT * FROM auth_events WHERE success = false ORDER BY created_at DESC LIMIT 10;
   ```

3. **Test with debug endpoint**:
   ```bash
   curl -X POST https://your-project.supabase.co/functions/v1/verify-magic-debug \
     -H "Content-Type: application/json" \
     -d '{"token": "your-token-here"}'
   ```

4. **Contact support**:
   - Supabase Discord: https://discord.supabase.com
   - Resend Support: support@resend.com

---

## Next Steps

After successfully deploying Option A fixes:

1. **Monitor for 1 week** - Watch logs and user feedback
2. **Collect metrics** - Track authentication success rate
3. **Plan Option B** - Schedule complete redesign for next quarter
4. **Document learnings** - Update team wiki with lessons learned

---

## Appendix: File Changes Summary

| File | Changes | Lines Modified |
|------|---------|----------------|
| `supabase/functions/verify-magic-link/index.ts` | Replace HMAC with SHA256 | 1-8, 22-24, 121-129 |
| `supabase/functions/_shared/auth-utils.ts` | Add docs, fix imports | 2, 3, 99, 130, 261, 322 |
| `supabase/functions/send-password-reset/index.ts` | Update template import | 2, 73-76 |
| `supabase/functions/_shared/email-templates.ts` | Add deprecation notice | 1 |
| `src/lib/auth/deviceNonce.ts` | New file | - |
| `src/pages/AuthLogin.tsx` | Use device nonce utility | 11, 86-91 |
| `src/pages/MagicCallback.tsx` | Use device nonce utility | 7, 30 |

**Total Files Modified**: 7
**Total Lines Changed**: ~50
**New Files Created**: 1

---

**End of Implementation Plan**
