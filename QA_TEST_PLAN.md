# Trial Signup Flow - Comprehensive QA Test Plan

## 🎯 Test Objective
Verify all fixes for planType validation, ReadableStream error parsing, and complete trial signup flow.

---

## ✅ Pre-Test Checklist

- [ ] Latest code deployed (commit: `5a20a95`)
- [ ] Supabase edge functions deployed
- [ ] Stripe API keys configured
- [ ] VAPI credentials configured
- [ ] Browser DevTools console open for monitoring logs
- [ ] Test email addresses ready (never used before)
- [ ] Test phone numbers ready (not used in last 30 days)

---

## 📋 Test Scenarios

### **TEST 1: Happy Path - Successful Trial Signup** ✅

**Goal**: Complete a trial signup from start to finish with no errors

**Steps**:
1. Navigate to homepage or trial signup page
2. Click "Start Free Trial" button
3. **Step 1 - Lead Capture**:
   - Enter full name: `John Smith`
   - Enter email: `john.smith+test1@example.com` (use a fresh email)
   - Enter phone: `(555) 123-4567`
   - Company name should auto-fill from email domain
   - Click "Continue"

4. **Step 2 - Plan Selection**:
   - Observe the three plan cards displayed
   - Click on "Professional" plan
   - **Expected**: Auto-advances to Step 3 immediately

5. **Step 3 - Payment**:
   - Verify order summary shows "Professional" plan
   - Verify "Due Today: $0.00"
   - Enter Stripe test card: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., `12/25`)
   - CVC: Any 3 digits (e.g., `123`)
   - ZIP: Any 5 digits (e.g., `12345`)
   - Check "I agree to the Terms" checkbox
   - Click "Start My Free Trial"

**Expected Results**:
- ✅ No errors in console
- ✅ Console logs show:
  ```
  ✅ Plan selected: professional
  📋 planType changed to: professional
  📋 Validating step 2 - planType: professional
  💳 Creating Stripe payment method...
  ✅ Payment method created: pm_xxxxx
  📞 Calling edge function with request body:
    - planType: professional (type: string)
  ✅ Trial signup successful!
  🔐 Auto-logging in user...
  ✅ Auto-login successful! Session: active
  ```
- ✅ Success toast: "Welcome! Redirecting to your dashboard..."
- ✅ Redirects to `/dashboard` or `/trial-confirmation`
- ✅ User is logged in automatically

**Backend Verification**:
- [ ] Stripe Dashboard → Customer created with correct email/name/phone
- [ ] Stripe Dashboard → Subscription created with:
  - Status: `trialing`
  - Trial end date: 3 days from now
  - Plan: Professional
  - Payment method attached
- [ ] Supabase → `accounts` table → New record with:
  - `stripe_customer_id`: matches Stripe customer ID
  - `stripe_subscription_id`: matches Stripe subscription ID
  - `plan_type`: 'professional'
  - `subscription_status`: 'trialing'
  - `trial_start_date`: today's date
  - `trial_end_date`: 3 days from now
- [ ] Supabase → `profiles` table → New record with user details
- [ ] Supabase → `signup_attempts` table → Success record with `success: true`
- [ ] Database → VAPI phone number provisioned
- [ ] Database → VAPI assistant created

---

### **TEST 2: Plan Selection Validation** 🎯

**Goal**: Verify planType is properly set and validated

**Steps**:
1. Start trial signup flow
2. Complete Step 1
3. At Step 2, click "Starter" plan
4. Observe console logs
5. Verify auto-advance to Step 3

**Expected Console Logs**:
```
✅ Plan selected: starter
📋 planType changed to: starter
📋 Validating step 2 - planType: starter
```

**Test Variations**:
- [ ] Test with "Starter" plan
- [ ] Test with "Professional" plan
- [ ] Test with "Premium" plan

**Expected**: All three plans should work correctly and auto-advance

---

### **TEST 3: Missing PlanType Error** 🛑

**Goal**: Verify validation prevents submission without planType

**Steps**:
1. Open browser DevTools console
2. Start trial signup flow
3. Complete Step 1
4. At Step 2, DO NOT click any plan
5. In console, type: `document.querySelector('[type="button"]')?.click()` to try to manually advance
6. Verify error handling

**Expected Results**:
- ✅ Toast error: "Please complete all required fields"
- ✅ Cannot advance to Step 3 without selecting a plan

---

### **TEST 4: Email Already Exists (422 Error)** 📧

**Goal**: Verify 422 error displays user-friendly message

**Steps**:
1. Start trial signup flow
2. Enter email that was already used in TEST 1
3. Complete Step 1 and Step 2
4. Enter valid payment method
5. Click "Start My Free Trial"

**Expected Results**:
- ✅ Toast error: "An account with this email already exists. Please sign in or use a different email address."
- ✅ Console shows parsed 422 error body
- ✅ No generic "Signup failed" message

---

### **TEST 5: Rate Limit (429 Error)** 🚫

**Goal**: Verify rate limiting error message

**Steps**:
1. Complete 3 successful trial signups from the same IP
2. Attempt a 4th signup
3. Complete all steps

**Expected Results**:
- ✅ Toast error: "Trial limit reached. You can only create 3 trials per location in 30 days. Contact support@getringsnap.com for assistance."
- ✅ Console shows 429 status code
- ✅ No generic error message

---

### **TEST 6: Phone Number Reuse (400 Error)** 📱

**Goal**: Verify phone number validation error message

**Steps**:
1. Start trial signup with NEW email
2. Use phone number from recent signup (within 30 days)
3. Complete all steps

**Expected Results**:
- ✅ Toast error: "This phone number was recently used for a trial. Please use a different number or contact support."
- ✅ Console shows 400 status code with phone validation error

---

### **TEST 7: Invalid Card (Stripe Error)** 💳

**Goal**: Verify Stripe card validation errors are displayed

**Steps**:
1. Start trial signup with fresh email
2. Complete Steps 1 and 2
3. At Step 3, enter test card that will be declined: `4000000000000002`
4. Complete form and submit

**Expected Results**:
- ✅ Toast error: "Your card was declined."
- ✅ Console shows Stripe error
- ✅ Payment step shows inline error message
- ✅ User remains on Step 3 to retry

---

### **TEST 8: Disposable Email (400 Error)** 🗑️

**Goal**: Verify disposable email blocking

**Steps**:
1. Start trial signup
2. Enter email with disposable domain: `test@mailinator.com`
3. Complete all steps

**Expected Results**:
- ✅ Toast error: "Please use a valid business or personal email address."
- ✅ Console shows 400 status with disposable email error

---

### **TEST 9: ReadableStream Error Parsing** 🔄

**Goal**: Verify 400 errors with ReadableStream bodies are parsed correctly

**Steps**:
1. Open browser DevTools console
2. Start trial signup
3. At Step 3, open console and intercept the edge function call
4. Force a validation error by modifying the request (if possible)

**Expected Results**:
- ✅ Console shows: "❌ Parsed 400 error body: [actual error object]"
- ✅ **NOT**: "❌ Parsed 400 error body: ReadableStream"
- ✅ Specific error message displayed to user

---

### **TEST 10: Form State Persistence** 💾

**Goal**: Verify form data persists when navigating between steps

**Steps**:
1. Complete Step 1 with name "John Doe", email "john@example.com", phone "(555) 555-5555"
2. Advance to Step 2
3. Click "Starter" plan
4. At Step 3, use browser back button or click "Back"
5. Verify Step 2 still shows "Starter" selected
6. Click back again to Step 1

**Expected Results**:
- ✅ Step 1 fields still populated with original values
- ✅ Step 2 still shows selected plan
- ✅ No data loss when navigating back

---

### **TEST 11: Auto-Login Verification** 🔐

**Goal**: Verify user is automatically logged in after successful signup

**Steps**:
1. Complete successful trial signup (TEST 1)
2. Check browser local storage for Supabase session
3. Verify redirect to dashboard
4. Check that user can access protected routes

**Expected Results**:
- ✅ Console log: "✅ Auto-login successful! Session: active"
- ✅ Supabase session token in local storage
- ✅ User redirected to `/dashboard` (not `/trial-confirmation`)
- ✅ Dashboard shows user profile info
- ✅ No login prompt shown

---

### **TEST 12: Auto-Login Failure Fallback** 🔓

**Goal**: Verify credentials are shown if auto-login fails

**Steps**:
1. Complete signup but simulate auto-login failure
2. Verify redirect to trial confirmation page
3. Check that credentials are displayed

**Expected Results**:
- ✅ Toast: "Account created! Please check your email for login instructions."
- ✅ Redirect to `/trial-confirmation?email=...&password=...`
- ✅ Confirmation page shows email and password
- ✅ Password is initially hidden but can be revealed

---

### **TEST 13: Mobile Responsiveness** 📱

**Goal**: Verify signup flow works on mobile devices

**Steps**:
1. Open Chrome DevTools
2. Toggle device emulation (iPhone 12 Pro, Pixel 5, etc.)
3. Complete entire signup flow on mobile viewport

**Expected Results**:
- ✅ All steps render correctly
- ✅ Form inputs are accessible
- ✅ Plan cards stack vertically
- ✅ Buttons are tap-friendly (minimum 44px height)
- ✅ No horizontal scrolling
- ✅ Dialog modal fits within viewport

---

### **TEST 14: Network Error Handling** 🌐

**Goal**: Verify graceful handling of network failures

**Steps**:
1. Start trial signup
2. Complete Steps 1 and 2
3. Open DevTools → Network tab
4. Set throttling to "Offline"
5. At Step 3, submit the form

**Expected Results**:
- ✅ Toast error: "Connection timeout. Please check your internet and try again."
- ✅ Loading spinner stops
- ✅ Form remains interactive
- ✅ User can retry after reconnecting

---

### **TEST 15: Concurrent Form Submissions** 🚦

**Goal**: Verify form prevents double submission

**Steps**:
1. Start trial signup
2. Complete all steps
3. At Step 3, rapidly click "Start My Free Trial" button multiple times

**Expected Results**:
- ✅ Button shows "Processing..." and becomes disabled
- ✅ Only ONE edge function call is made
- ✅ No duplicate Stripe customers created
- ✅ Loading state prevents additional clicks

---

## 🐛 Known Issues to Watch For

- [ ] **Issue**: ReadableStream not parsed
  - **Fix Applied**: Async stream reader with TextDecoder
  - **Test**: Verify console shows parsed error body, not "ReadableStream"

- [ ] **Issue**: planType undefined in request
  - **Fix Applied**: Validation before submission + improved step 2 validation
  - **Test**: Verify console logs show `planType: professional (type: string)`

- [ ] **Issue**: Generic "Signup failed" error
  - **Fix Applied**: Specific error messages for all scenarios
  - **Test**: Verify each error type shows correct message

---

## 📊 Success Criteria

For QA to pass, the following must be true:

- [x] **Build**: TypeScript build completes with no errors
- [ ] **TEST 1**: Happy path signup creates Stripe customer, subscription, account, and VAPI resources
- [ ] **TEST 2-3**: Plan selection validates and prevents submission without planType
- [ ] **TEST 4-8**: All error scenarios display specific, user-friendly messages
- [ ] **TEST 9**: ReadableStream errors are parsed correctly
- [ ] **TEST 10**: Form state persists across navigation
- [ ] **TEST 11**: Auto-login works after successful signup
- [ ] **TEST 13**: Mobile responsiveness verified
- [ ] **TEST 15**: No duplicate submissions possible

---

## 🔍 Console Log Checklist

During a successful signup, you should see these logs in order:

```
// Step 2: Plan selection
✅ Plan selected: professional
📋 planType changed to: professional
📋 Validating step 2 - planType: professional

// Step 3: Form submission
🚀 Starting trial signup submission...
💳 Creating Stripe payment method...
✅ Payment method created: pm_xxxxxxxxxxxxx

// Edge function request
📞 Calling edge function with request body:
  - name: John Smith
  - email: john.smith@example.com
  - phone: (555) 123-4567
  - companyName: Example
  - planType: professional (type: string)
  - paymentMethodId: pm_xxxxxxxxxxxxx
  - acceptTerms: true
  - source: website

// Edge function response
📦 Edge function response: {data: {…}, error: null}
✅ Trial signup successful! User: john.smith@example.com
📦 Signup response data: {
  email: "john.smith@example.com",
  hasPassword: true,
  accountId: "xxx-xxx-xxx",
  stripeCustomerId: "cus_xxxxxxxxxxxxx"
}

// Auto-login
🔐 Auto-logging in user...
✅ Auto-login successful! Session: active
🔄 Redirecting in 1.5 seconds...
✅ Navigating to: /dashboard
```

**Red Flags** (should NOT appear):
- ❌ `planType: undefined`
- ❌ `❌ Parsed 400 error body: ReadableStream`
- ❌ `Signup failed. Please try again.` (generic error)
- ❌ TypeScript errors or warnings
- ❌ Uncaught exceptions

---

## 📝 Test Results Template

Copy this template to record your test results:

```
## QA Test Results - [Date]

**Tester**: [Your Name]
**Environment**: [Production/Staging/Local]
**Browser**: [Chrome 120, Firefox 115, Safari 17, etc.]
**Commit**: 5a20a95

### Test Results

- [ ] TEST 1: Happy Path - PASS/FAIL
  - Notes:
  - Stripe Customer ID:
  - Subscription ID:

- [ ] TEST 2: Plan Selection - PASS/FAIL
  - Notes:

- [ ] TEST 3: Missing PlanType - PASS/FAIL
  - Notes:

- [ ] TEST 4: Email Already Exists - PASS/FAIL
  - Notes:

- [ ] TEST 5: Rate Limit - PASS/FAIL
  - Notes:

- [ ] TEST 6: Phone Reuse - PASS/FAIL
  - Notes:

- [ ] TEST 7: Invalid Card - PASS/FAIL
  - Notes:

- [ ] TEST 8: Disposable Email - PASS/FAIL
  - Notes:

- [ ] TEST 9: ReadableStream Parsing - PASS/FAIL
  - Notes:

- [ ] TEST 10: Form State Persistence - PASS/FAIL
  - Notes:

- [ ] TEST 11: Auto-Login - PASS/FAIL
  - Notes:

- [ ] TEST 12: Auto-Login Failure - PASS/FAIL
  - Notes:

- [ ] TEST 13: Mobile Responsiveness - PASS/FAIL
  - Notes:

- [ ] TEST 14: Network Error - PASS/FAIL
  - Notes:

- [ ] TEST 15: Concurrent Submissions - PASS/FAIL
  - Notes:

### Issues Found

1. [Issue description]
   - Severity: Critical/High/Medium/Low
   - Steps to reproduce:
   - Expected:
   - Actual:

### Overall Assessment

- Total Tests: 15
- Passed: X
- Failed: X
- Pass Rate: X%

**Recommendation**: APPROVE/REJECT for production deployment
```

---

## 🚀 Next Steps After QA

If all tests pass:
1. ✅ Create pull request
2. ✅ Request code review
3. ✅ Merge to main branch
4. ✅ Deploy to production
5. ✅ Monitor error logs for 24 hours

If tests fail:
1. 🐛 Document failing tests
2. 🔍 Debug and fix issues
3. 🔄 Re-run QA
4. 📝 Update test plan if needed
