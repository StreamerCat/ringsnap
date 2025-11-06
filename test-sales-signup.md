# Sales Signup Flow Test Guide

## Prerequisites
- [ ] Edge functions deployed (`create-sales-account`, `provision-resources`)
- [ ] Frontend running locally (`npm run dev`)
- [ ] Stripe test mode configured
- [ ] Sales page password known
- [ ] All environment variables set

## Test Steps

### 1. Access Sales Page
**URL**: `http://localhost:5173/sales`

**Actions**:
1. Navigate to sales page
2. Enter sales password when prompted
3. Verify page loads with demo, calculator, and signup wizard

**Expected Result**:
- ✅ Sales page accessible
- ✅ Demo widget visible
- ✅ ROI calculator visible
- ✅ Signup wizard visible at bottom

---

### 2. Step 1: Business Essentials

**Form Fields**:
- Company Name: `Test HVAC LLC`
- Trade: Select `HVAC` from dropdown
- Service Area: `Denver, CO`
- ZIP Code: `80202`

**Actions**:
1. Fill out all fields
2. Click "Continue"

**Expected Result**:
- ✅ All fields validate
- ✅ ZIP code accepts 5 digits
- ✅ Proceeds to Step 2: Plan Selection
- ✅ Progress bar updates to 2/4

---

### 3. Step 2: Plan Selection

**Available Plans**:
- Starter: $297/mo
- Professional: $797/mo (Popular)
- Premium: $1497/mo

**Actions**:
1. Review plan options
2. Select **Professional** plan
3. Click "Continue"

**Expected Result**:
- ✅ Plan cards displayed with features
- ✅ "Popular" badge shown on Professional
- ✅ Selection highlights chosen plan
- ✅ Proceeds to Step 3: Business Details
- ✅ Progress bar updates to 3/4

---

### 4. Step 3: Business Details

**Form Fields**:
- Customer Name: `John Doe`
- Email: `john.test-${Date.now()}@testhvac.com` (use unique email)
- Phone: `(303) 555-1234`
- Business Hours: `Monday-Friday 8am-6pm, Emergency service available 24/7`
- Emergency Policy: `We provide 24/7 emergency service for heating and cooling emergencies. After hours calls are automatically forwarded to our on-call technician.`
- Assistant Gender: Select `Female`
- Sales Rep Name: `Your Name` (enter your name)

**Actions**:
1. Fill out all fields
2. Ensure all required fields are complete
3. Click "Continue"

**Expected Result**:
- ✅ All fields validate
- ✅ Email format validated
- ✅ Phone format validated
- ✅ Emergency policy min length met (10 chars)
- ✅ Proceeds to Step 4: Payment
- ✅ Progress bar updates to 4/4

---

### 5. Step 4: Payment

**Stripe Test Card**:
- Card Number: `4242 4242 4242 4242`
- Expiry: `12/25` (any future date)
- CVC: `123` (any 3 digits)
- ZIP: `80202`

**Actions**:
1. Enter card details
2. Wait for Stripe validation (green checkmark)
3. Click "Complete Payment"
4. **Wait 10-15 seconds** for payment + provisioning

**Expected Result**:
- ✅ Card input shows green checkmark when complete
- ✅ "Complete Payment" button enabled
- ✅ Loading state appears after clicking
- ✅ "Processing Payment..." message shown
- ✅ After ~5-10 seconds, changes to "Payment successful! Your phone number is being activated."

**⚠️ Important**: Don't reload the page while provisioning is happening!

---

### 6. Success Screen (No Phone Selection Step!)

**Expected Result**:
- ✅ **Immediately** shows success screen (skips phone selection)
- ✅ Success header with checkmark icon
- ✅ "🎉 Success!" message
- ✅ Company name displayed: "Test HVAC LLC"
- ✅ Selected plan badge: "PROFESSIONAL"
- ✅ Phone number shown (or "Provisioning..." if still in progress)
- ✅ Forwarding instructions visible (if phone ready)
- ✅ "Access Your Dashboard" collapsible section
- ✅ Support contact information

**Phone Number**:
- If provisioned: Should show formatted number starting with (303) - derived from ZIP 80202
- If still provisioning: Shows "Provisioning..." with loading indicator
- After ~10 seconds: Phone number should appear

---

### 7. Verify Login Credentials

**Actions**:
1. Expand "Access Your Dashboard" section
2. Copy the temporary password
3. Note the email address

**Expected Result**:
- ✅ Email displayed: john.test-[timestamp]@testhvac.com
- ✅ Temporary password visible (16 characters)
- ✅ Copy button works
- ✅ "Go to Login" button visible

---

### 8. Verify Stripe Dashboard

**URL**: [Stripe Dashboard - Test Mode](https://dashboard.stripe.com/test/customers)

**Actions**:
1. Search for customer by email: `john.test-[timestamp]@testhvac.com`
2. Click on customer
3. Review details

**Expected Result**:

**Customer Details**:
- ✅ Name: "John Doe"
- ✅ Email: john.test-[timestamp]@testhvac.com
- ✅ Phone: "+13035551234"

**Metadata**:
- ✅ `company_name`: "Test HVAC LLC"
- ✅ `trade`: "HVAC"
- ✅ `sales_rep`: "Your Name"
- ✅ `source`: "sales-team"

**Subscriptions**:
- ✅ Status: Active ✅
- ✅ Plan: Professional ($797/month)
- ✅ Payment method: Visa ending in 4242

**Subscription Metadata**:
- ✅ `sales_rep`: "Your Name"
- ✅ `plan_type`: "professional"

---

### 9. Verify Database - Accounts Table

Run this SQL in Supabase SQL Editor:

```sql
-- Find the sales test account
SELECT
  a.id as account_id,
  a.company_name,
  a.trade,
  a.service_area,
  a.plan_type,
  a.subscription_status,
  a.stripe_customer_id,
  a.stripe_subscription_id,
  a.vapi_phone_number,
  a.vapi_assistant_id,
  a.provisioning_status,
  a.phone_number_area_code,
  a.sales_rep_name,
  a.business_hours,
  a.emergency_policy,
  a.assistant_gender,
  p.email,
  p.name,
  p.phone
FROM accounts a
JOIN profiles p ON p.account_id = a.id
WHERE p.email LIKE 'john.test-%@testhvac.com'
ORDER BY a.created_at DESC
LIMIT 1;
```

**Expected Results**:

**Basic Info**:
- ✅ `company_name` = 'Test HVAC LLC'
- ✅ `trade` = 'HVAC'
- ✅ `service_area` = 'Denver, CO'

**Plan & Subscription**:
- ✅ `plan_type` = 'professional'
- ✅ `subscription_status` = 'active'
- ✅ `stripe_customer_id` starts with 'cus_' (e.g., cus_ABC123...)
- ✅ `stripe_subscription_id` starts with 'sub_' (e.g., sub_XYZ789...)

**Phone & Assistant** (Critical - these were missing before):
- ✅ `vapi_phone_number` starts with '+1303' (from ZIP 80202)
- ✅ `vapi_assistant_id` starts with 'ast_'
- ✅ `provisioning_status` = 'completed'
- ✅ `phone_number_area_code` = '303' (or ZIP code 80202)

**Sales Details**:
- ✅ `sales_rep_name` = 'Your Name'
- ✅ `business_hours` contains entered text
- ✅ `emergency_policy` contains entered text
- ✅ `assistant_gender` = 'female'

**Profile Info**:
- ✅ `email` = john.test-[timestamp]@testhvac.com
- ✅ `name` = 'John Doe'
- ✅ `phone` = entered phone number

**❌ If Stripe IDs are NULL**: The fix didn't deploy correctly
**❌ If vapi_phone_number is NULL**: Provisioning didn't run or failed

---

### 10. Verify Database - Phone Numbers Table

```sql
-- Check phone number record
SELECT
  pn.id,
  pn.account_id,
  pn.phone_number,
  pn.vapi_phone_id,
  pn.area_code,
  pn.is_primary,
  pn.status,
  pn.label,
  pn.created_at,
  a.company_name
FROM phone_numbers pn
JOIN accounts a ON a.id = pn.account_id
JOIN profiles p ON p.account_id = a.id
WHERE p.email LIKE 'john.test-%@testhvac.com'
ORDER BY pn.created_at DESC
LIMIT 1;
```

**Expected Results**:
- ✅ Record exists
- ✅ `phone_number` matches account's `vapi_phone_number`
- ✅ `vapi_phone_id` starts with 'ph_'
- ✅ `area_code` = '303' (from Denver ZIP)
- ✅ `is_primary` = true
- ✅ `status` = 'active'
- ✅ `label` = 'Primary'

**❌ If no record**: Provisioning didn't complete phone_numbers insert

---

### 11. Verify Database - Assistants Table

```sql
-- Check assistant record
SELECT
  ast.id,
  ast.account_id,
  ast.phone_number_id,
  ast.vapi_assistant_id,
  ast.name,
  ast.voice_id,
  ast.voice_gender,
  ast.is_primary,
  ast.status,
  ast.created_at,
  a.company_name
FROM assistants ast
JOIN accounts a ON a.id = ast.account_id
JOIN profiles p ON p.account_id = a.id
WHERE p.email LIKE 'john.test-%@testhvac.com'
ORDER BY ast.created_at DESC
LIMIT 1;
```

**Expected Results**:
- ✅ Record exists
- ✅ `vapi_assistant_id` starts with 'ast_'
- ✅ `name` = 'Test HVAC LLC Assistant'
- ✅ `voice_id` = 'sarah' (for female) or 'michael' (for male)
- ✅ `voice_gender` = 'female'
- ✅ `is_primary` = true
- ✅ `status` = 'active'
- ✅ `phone_number_id` is populated (links to phone_numbers)

**❌ If no record**: Provisioning didn't complete assistants insert

---

### 12. Verify Referral Code

```sql
-- Check referral code generated
SELECT
  rc.code,
  rc.account_id,
  rc.is_active,
  rc.created_at,
  a.company_name
FROM referral_codes rc
JOIN accounts a ON a.id = rc.account_id
JOIN profiles p ON p.account_id = a.id
WHERE p.email LIKE 'john.test-%@testhvac.com'
ORDER BY rc.created_at DESC
LIMIT 1;
```

**Expected Results**:
- ✅ Record exists
- ✅ `code` is 6-8 character alphanumeric
- ✅ `is_active` = true

---

### 13. Verify Welcome Email

**Check Email Inbox**: john.test-[timestamp]@testhvac.com

**Expected Email**:
- ✅ From: RingSnap <welcome@ringsnap.com>
- ✅ Subject: "Your RingSnap line is live - start catching every call"
- ✅ Greeting: "Hey John,"
- ✅ Phone number: Formatted as (303) XXX-XXXX
- ✅ Forwarding instructions: *72 + 10-digit number
- ✅ Professional formatting (HTML email)

**If No Email Received**:
- Check spam/junk folder
- Check Resend dashboard for delivery status
- Verify RESEND_API_KEY is set
- Check Edge Function logs for email send errors

---

### 14. Test Login

**URL**: `http://localhost:5173/login`

**Credentials**:
- Email: john.test-[timestamp]@testhvac.com
- Password: (temp password from success screen)

**Actions**:
1. Navigate to login page
2. Enter credentials
3. Click "Sign In"

**Expected Result**:
- ✅ Successfully logs in
- ✅ Redirected to dashboard
- ✅ No "complete onboarding" prompt (already completed)
- ✅ Dashboard shows:
  - Company name: "Test HVAC LLC"
  - Phone number: (303) XXX-XXXX
  - Plan: Professional
  - Subscription status: Active

---

### 15. Test Dashboard Features

**Actions**:
1. Navigate around dashboard
2. Check phone number display
3. Check call logs (should be empty)
4. Check account settings

**Expected Result**:
- ✅ Phone number visible in header/sidebar
- ✅ Account details accurate
- ✅ No errors loading dashboard
- ✅ Can access all features

---

## Success Criteria

All of these must be true:

**Payment Flow**:
- ✅ Payment processes successfully
- ✅ No phone selection step shown
- ✅ Goes directly to success screen after payment

**Stripe Integration**:
- ✅ Customer created in Stripe
- ✅ Subscription active in Stripe
- ✅ Metadata populated correctly
- ✅ stripe_customer_id saved to database
- ✅ stripe_subscription_id saved to database

**Provisioning**:
- ✅ Phone number provisioned immediately after payment
- ✅ Assistant created and linked
- ✅ Provisioning completes in 5-15 seconds
- ✅ provisioning_status = 'completed'

**Database**:
- ✅ All tables populated correctly (accounts, profiles, phone_numbers, assistants)
- ✅ Foreign keys all linked properly
- ✅ No NULL values in required fields

**User Experience**:
- ✅ Welcome email received
- ✅ Can log in with temp password
- ✅ Dashboard accessible and functional
- ✅ No console errors
- ✅ No edge function errors in logs

---

## Common Issues & Solutions

### Issue: Stripe IDs are NULL in database
**Symptom**: `stripe_customer_id` and `stripe_subscription_id` are NULL
**Cause**: Edge function not deployed with latest code
**Solution**:
- Redeploy `create-sales-account` edge function
- Clear browser cache
- Retry signup

### Issue: Phone number is NULL
**Symptom**: `vapi_phone_number` is NULL, provisioning_status = 'failed'
**Cause**: Provisioning failed or didn't run
**Solution**:
- Check Edge Function logs for `provision-resources`
- Check `accounts.provisioning_error` for error message
- Verify VAPI_API_KEY is set and valid
- Check Vapi dashboard for account status

### Issue: "provision-sales-account function not found"
**Symptom**: Error in browser console about missing function
**Cause**: Old code still calling removed function
**Solution**:
- Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)
- Rebuild frontend: `npm run build`
- Restart dev server

### Issue: Payment succeeds but account not created
**Symptom**: Stripe shows charge but no database record
**Cause**: Edge function error after payment
**Solution**:
- Check Edge Function logs for full error
- Check Supabase logs for database errors
- May need to manually create account and link Stripe ID

### Issue: Phone selection step still appears
**Symptom**: Shows phone selection after payment
**Cause**: Frontend not rebuilt with new code
**Solution**:
- Stop dev server
- Clear node_modules/.vite cache
- Restart: `npm run dev`
- Hard refresh browser (Ctrl+Shift+R)

---

## Edge Function Logs to Check

### In Supabase Dashboard:
1. Go to **Edge Functions**
2. Click on function name
3. Click **Logs** tab
4. Filter by recent time period

### Look For:

**create-sales-account**:
- ✅ "Creating sales account" log
- ✅ "Stripe customer created" log
- ✅ "Auth user created" log
- ✅ "Account updated with sales data" log
- ✅ "Starting immediate provisioning" log
- ✅ "Provisioning succeeded" log
- ❌ Any error logs

**provision-resources**:
- ✅ "Starting provisioning workflow" log
- ✅ "Using selected area code" log
- ✅ "VAPI phone number created" log
- ✅ "Assistant created" log
- ✅ "Account updated successfully" log
- ✅ "Welcome email sent" log
- ❌ Any error logs

---

## Performance Benchmarks

**Target Times**:
- Payment processing: < 3 seconds
- Provisioning: 5-15 seconds
- Total signup time: < 20 seconds
- Email delivery: < 30 seconds

**If Slower Than Expected**:
- Check Vapi API response times
- Check Stripe API response times
- Check edge function cold start times
- Consider optimizing async operations

---

## Next Steps After Successful Test

- [ ] Test with different plans (Starter, Premium)
- [ ] Test with different trades
- [ ] Test with male voice assistant
- [ ] Test with different ZIP codes (different area codes)
- [ ] Test card decline scenarios (card 4000 0000 0000 0002)
- [ ] Test provisioning retry if it fails
- [ ] Load test with multiple simultaneous signups
- [ ] Move to production deployment
