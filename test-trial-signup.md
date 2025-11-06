# Trial Signup Flow Test Guide

## Prerequisites
- [ ] Edge functions deployed (`search-vapi-numbers`, `provision-resources`)
- [ ] Frontend running locally (`npm run dev`)
- [ ] Supabase project running
- [ ] VAPI_API_KEY configured

## Test Steps

### 1. Trial Signup
**URL**: `http://localhost:5173/` (or your frontend URL)

**Form Fields**:
- Name: `Test User`
- Email: `test-trial-${Date.now()}@example.com` (use unique email)
- Phone: `(555) 123-4567`
- Password: `TestPass123!`

**Actions**:
1. Fill out the form
2. Click "Start Free Trial"
3. Wait for success message
4. Note the credentials

**Expected Result**:
- ✅ Success message appears
- ✅ Redirected to login or auto-logged-in
- ✅ No console errors

---

### 2. Login (if not auto-logged-in)
**URL**: `http://localhost:5173/login`

**Credentials**:
- Email: (from step 1)
- Password: `TestPass123!`

**Expected Result**:
- ✅ Successfully logs in
- ✅ Redirected to dashboard
- ✅ Onboarding wizard opens automatically

---

### 3. Onboarding Step 1: Phone Number Search

**Test Area Codes**:
- `415` (San Francisco) - Should return results
- `720` (Denver) - Should return results
- `212` (New York) - Should return results
- `907` (Alaska) - May have no results (test fallback)

**Actions**:
1. Enter area code: `415`
2. Wait for search (should be < 1 second)
3. Verify numbers appear

**Expected Result**:
- ✅ "Searching for numbers..." message appears briefly
- ✅ 3 phone numbers displayed within 1 second
- ✅ Numbers formatted as (415) XXX-XXXX
- ✅ Can select a number (radio button)
- ✅ "Continue" button becomes enabled

**If No Numbers Appear**:
- ❌ Check browser console for errors
- ❌ Check Supabase Edge Function logs
- ❌ Verify VAPI_API_KEY is set correctly
- ❌ Try different area code

---

### 4. Onboarding Step 2: Business Details

**Form Fields**:
- Company Name: `Test Plumbing Co`
- Trade: Select `Plumbing` from dropdown
- Assistant Voice: Select `Female` (or Male)

**Actions**:
1. Fill out all fields
2. Click "Continue"

**Expected Result**:
- ✅ All fields validate
- ✅ Proceeds to step 3
- ✅ No validation errors

---

### 5. Onboarding Step 3: Availability (Optional)

**Form Fields**:
- Business Hours: `Monday-Friday 8am-5pm` (optional)

**Actions**:
1. Enter business hours or leave blank
2. Click "Complete Setup"

**Expected Result**:
- ✅ Shows loading state
- ✅ "Provisioning your assistant..." message

---

### 6. Provisioning & Success

**Wait Time**: 5-15 seconds

**Expected Result**:
- ✅ Loading spinner shown during provisioning
- ✅ Success screen appears after completion
- ✅ Phone number displayed (formatted)
- ✅ Forwarding instructions shown
- ✅ "Access Your Dashboard" section visible

**Phone Number Should**:
- ✅ Start with selected area code (415)
- ✅ Be formatted as (415) XXX-XXXX
- ✅ Be different from previously provisioned numbers

---

### 7. Verify Welcome Email

**Check Email Inbox**: test-trial-[timestamp]@example.com

**Expected Email**:
- ✅ From: RingSnap <welcome@ringsnap.com>
- ✅ Subject: "Your RingSnap line is live - start catching every call"
- ✅ Contains: Phone number
- ✅ Contains: Forwarding instructions (*72 code)
- ✅ Contains: Formatted phone number

---

### 8. Verify Database Records

Run this SQL in Supabase SQL Editor:

```sql
-- Find the test account
SELECT
  a.id as account_id,
  a.company_name,
  a.trade,
  a.vapi_phone_number,
  a.vapi_assistant_id,
  a.stripe_customer_id,
  a.provisioning_status,
  a.onboarding_completed,
  a.subscription_status,
  p.email,
  p.name,
  p.phone
FROM accounts a
JOIN profiles p ON p.account_id = a.id
WHERE p.email LIKE 'test-trial-%@example.com'
ORDER BY a.created_at DESC
LIMIT 1;
```

**Expected Results**:
- ✅ `company_name` = 'Test Plumbing Co'
- ✅ `trade` = 'Plumbing'
- ✅ `vapi_phone_number` starts with '+1415'
- ✅ `vapi_assistant_id` is populated (starts with 'ast_')
- ✅ `stripe_customer_id` is populated (starts with 'cus_')
- ✅ `provisioning_status` = 'completed'
- ✅ `onboarding_completed` = true
- ✅ `subscription_status` = 'trial'

---

### 9. Verify Phone Numbers Table

```sql
-- Check phone number record
SELECT
  pn.id,
  pn.phone_number,
  pn.vapi_phone_id,
  pn.area_code,
  pn.is_primary,
  pn.status,
  a.company_name
FROM phone_numbers pn
JOIN accounts a ON a.id = pn.account_id
JOIN profiles p ON p.account_id = a.id
WHERE p.email LIKE 'test-trial-%@example.com'
ORDER BY pn.created_at DESC
LIMIT 1;
```

**Expected Results**:
- ✅ `phone_number` matches account's `vapi_phone_number`
- ✅ `vapi_phone_id` is populated (starts with 'ph_')
- ✅ `area_code` = '415'
- ✅ `is_primary` = true
- ✅ `status` = 'active'

---

### 10. Verify Assistants Table

```sql
-- Check assistant record
SELECT
  ast.id,
  ast.vapi_assistant_id,
  ast.name,
  ast.voice_gender,
  ast.is_primary,
  ast.status,
  a.company_name
FROM assistants ast
JOIN accounts a ON a.id = ast.account_id
JOIN profiles p ON p.account_id = a.id
WHERE p.email LIKE 'test-trial-%@example.com'
ORDER BY ast.created_at DESC
LIMIT 1;
```

**Expected Results**:
- ✅ `vapi_assistant_id` is populated (starts with 'ast_')
- ✅ `name` = 'Test Plumbing Co Assistant'
- ✅ `voice_gender` = 'female' (or 'male' if selected)
- ✅ `is_primary` = true
- ✅ `status` = 'active'

---

## Success Criteria

All of these must be true:
- ✅ Number search returns results in < 1 second
- ✅ Can select and continue with phone number
- ✅ Provisioning completes in 5-15 seconds
- ✅ Phone number displayed on success screen
- ✅ Welcome email received
- ✅ Database records all populated correctly
- ✅ No console errors
- ✅ No edge function errors in Supabase logs

---

## Common Issues

### Issue: Number search returns empty
**Symptom**: "No numbers available" for 415, 720, 212
**Solution**:
- Check Edge Function logs for `search-vapi-numbers`
- Verify VAPI_API_KEY is set
- Verify edge function deployed with latest code
- Test Vapi API directly: `curl -X POST https://api.vapi.ai/phone-number/search -H "Authorization: Bearer $VAPI_API_KEY" -d '{"numberDesiredAreaCode":"415","limit":3,"country":"US"}'`

### Issue: Provisioning fails
**Symptom**: Error message during provisioning
**Solution**:
- Check Edge Function logs for `provision-resources`
- Check `accounts` table for `provisioning_status` = 'failed'
- Check `provisioning_error` column for error message
- Verify VAPI_API_KEY, STRIPE_SECRET_KEY, RESEND_API_KEY are set

### Issue: Welcome email not received
**Symptom**: Email doesn't arrive
**Solution**:
- Check spam folder
- Verify RESEND_API_KEY is set
- Check Resend dashboard for delivery status
- Check Edge Function logs for email send errors

---

## Next Steps After Successful Test

- [ ] Test with different area codes (720, 212, 949)
- [ ] Test with different trades
- [ ] Test with male voice assistant
- [ ] Test error handling (invalid area code like '000')
- [ ] Move on to Sales Signup Flow test
