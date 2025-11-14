# Quick Test Checklist - Authentication Fixes

**Run these tests immediately after deployment to verify fixes**

---

## ⚡ CRITICAL TEST (5 minutes)

### Magic Link Works ✅

```
1. Open: https://getringsnap.com/auth/login
2. Enter your email
3. Click "Continue with email"
4. Check your inbox
5. Click the magic link
6. ✅ Should authenticate successfully
```

**If this works, the critical fix is successful!** 🎉

**If this fails:**
```bash
# Check logs
supabase functions logs verify-magic-link --tail

# Look for error message
# If you see "Invalid or expired magic link" = deployment may have failed
```

---

## 🔍 ESSENTIAL TESTS (15 minutes)

### 1. Device Binding Works

```
✓ Request magic link on computer
✓ Forward email to phone
✓ Click link on phone → Should fail ❌
✓ Click link on computer → Should work ✅
```

### 2. Token Can't Be Reused

```
✓ Request magic link
✓ Click link → Authenticate ✅
✓ Copy the URL
✓ Log out
✓ Try same URL again → Should fail ❌
```

### 3. Rate Limiting Active

```
✓ Send 5 magic links quickly → All succeed ✅
✓ Send 6th magic link → Should be rate limited ❌
✓ Error: "Too many attempts. Please try again later."
```

### 4. Password Reset Still Works

```
✓ Click "Forgot password?"
✓ Enter email
✓ Check email
✓ Click reset link
✓ Set new password
✓ Login with new password ✅
```

---

## 📊 VERIFY IN DATABASE

```sql
-- Check auth events (should see magic_link_sent, magic_link_verified)
SELECT event_type, success, created_at
FROM auth_events
ORDER BY created_at DESC
LIMIT 10;

-- Check tokens are being used
SELECT token_type, email, used_at, expires_at
FROM auth_tokens
WHERE token_type = 'magic_link'
ORDER BY created_at DESC
LIMIT 10;

-- Check email delivery
SELECT email_type, event, created_at
FROM email_events
ORDER BY created_at DESC
LIMIT 10;
```

---

## ✅ SUCCESS INDICATORS

After testing, you should see:

✅ Magic link authentication works (no "Invalid or expired" errors)
✅ Device binding prevents cross-device use
✅ Tokens can only be used once
✅ Rate limiting prevents abuse
✅ Password reset continues working
✅ Emails are delivered (check Resend dashboard)
✅ All events logged in database
✅ No errors in Supabase logs

---

## 🚨 TROUBLESHOOTING

### Magic Link Still Doesn't Work

1. **Check deployment**:
   ```bash
   supabase functions list
   # Verify verify-magic-link shows latest version
   ```

2. **Check logs**:
   ```bash
   supabase functions logs verify-magic-link --tail
   ```

3. **Test hash directly**:
   ```javascript
   // In browser console
   const token = "test-token";
   const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
   const hashArray = Array.from(new Uint8Array(hash));
   const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
   console.log(hashHex);
   ```

### Email Not Arriving

1. Check spam folder
2. Check Resend dashboard: https://resend.com/emails
3. Verify RESEND_PROD_KEY is set in Supabase
4. Check email_events table for bounces

### Device Binding Not Working

1. Check browser console for localStorage errors
2. Verify deviceNonce is being sent:
   ```javascript
   localStorage.getItem('device_nonce')
   // Should show a UUID
   ```

---

## 📞 NEED HELP?

1. Review full documentation:
   - `TESTING_AND_DEPLOYMENT_GUIDE.md` - Complete testing procedures
   - `AUTHENTICATION_SYSTEM_AUDIT_REPORT.md` - Full audit details
   - `AUTHENTICATION_FIX_IMPLEMENTATION_PLAN.md` - Implementation steps

2. Check Supabase logs:
   ```bash
   supabase functions logs verify-magic-link --tail
   ```

3. Use debug endpoint:
   ```bash
   curl -X POST https://YOUR-PROJECT.supabase.co/functions/v1/verify-magic-debug \
     -H "Content-Type: application/json" \
     -d '{"token": "YOUR-TOKEN"}'
   ```

---

**Time to Complete**: 5-20 minutes
**Priority**: Run Critical Test immediately after deployment

Good luck! 🚀
