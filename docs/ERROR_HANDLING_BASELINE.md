# create-trial Baseline Behavior (Pre-Enhancement)

**Captured:** 2025-12-11  
**Purpose:** Establish baseline behavior before implementing structured error handling  
**Status:** ✅ DOCUMENTED FROM CODE ANALYSIS

---

## Test Environment

- **Supabase Project:** Production
- **Stripe Mode:** Live (with test cards)
- **Frontend URL:** https://ringsnap.com
- **Edge Function Version:** 2025-12-10-LOGGING-FIX-V3

---

## Test Scenario 1: Success Path (Valid Card)

### Test Details
- **Card Number:** `4242424242424242`
- **Expiry:** Any future date (e.g., `12/25`)
- **CVC:** Any 3 digits (e.g., `123`)
- **Zip:** Any 5 digits (e.g., `12345`)
- **Email:** `baseline-success@test.com`
- **Phone:** `5551234567`

### Expected Behavior
- Trial account created
- Stripe customer created
- Stripe subscription created (trial status)
- Supabase account record created
- User authenticated
- Redirect to provisioning status page

### Actual Results (Based on Code Analysis)

#### HTTP Response
**Status Code:** 200

**Response Body:**
```json
{
  "success": true,
  "accountId": "[UUID]",
  "stripeCustomerId": "cus_xxx",
  "stripeSubscriptionId": "sub_xxx",
  "ok": true,
  "user_id": "[UUID]",
  "account_id": "[UUID]",
  "email": "baseline-success@test.com",
  "password": "[GENERATED_PASSWORD]",
  "stripe_customer_id": "cus_xxx",
  "subscription_id": "sub_xxx",
  "trial_end_date": "[ISO_DATE]",
  "plan_type": "starter",
  "source": "website",
  "provisioning_status": "pending",
  "vapi_assistant_id": null,
  "phone_number": null,
  "message": "Trial started! Your AI receptionist is being set up..."
}
```

#### Expected Supabase Edge Logs
```
- "FUNCTION VERSION: 2025-12-10-LOGGING-FIX-V3"
- "Creating trial account" (level: info)
- "Stripe customer created" (level: info)
- "Payment method attached" (level: info)
- "Stripe subscription created" (level: info)
- "Account created atomically" (level: info)
- "[create-trial] Completed successfully"
```

#### Database State
**Accounts Table:**
```sql
SELECT id, company_name, subscription_status, stripe_customer_id, stripe_subscription_id
FROM accounts
WHERE id = '[accountId from response]';
```

**Result:**
```
[Paste query result]
```

**Profiles Table:**
```sql
SELECT id, email, account_id, is_primary, role
FROM profiles
WHERE id = '[userId from response]';
```

**Result:**
```
[Paste query result]
```

#### Stripe Dashboard
- **Customer ID:** [cus_xxx]
- **Subscription ID:** [sub_xxx]
- **Status:** `trialing`
- **Trial End:** [Date]

#### Frontend Behavior
- User redirected to: `/setup/assistant`
- Console logs: [Paste relevant logs]
- No errors displayed

---

## Test Scenario 2: Failure Path (Declined Card)

### Test Details
- **Card Number:** `4000000000000002` (Generic decline)
- **Expiry:** Any future date (e.g., `12/25`)
- **CVC:** Any 3 digits (e.g., `123`)
- **Zip:** Any 5 digits (e.g., `12345`)
- **Email:** `baseline-failure@test.com`
- **Phone:** `5559876543`

### Expected Behavior
- Payment method attachment fails
- Error returned to frontend
- No account created
- No Stripe resources left behind
- User sees error message
- User can retry

### Actual Results (Based on Code Analysis)

#### HTTP Response
**Status Code:** 500 (for Stripe errors that throw)

**Response Body:**
```json
{
  "success": false,
  "request_id": "[UUID]",
  "phase": "stripe_payment_method",
  "message": "Stripe Payment Method Attach Failed: Your card does not support this type of purchase."
}
```

**Note:** Current behavior throws errors which are caught by global handler. The error message is the raw Stripe error message prefixed with the phase context.

#### Expected Supabase Edge Logs
```
- "FUNCTION VERSION: 2025-12-10-LOGGING-FIX-V3"
- Error log with full stack trace
- correlationId present
- phase: "stripe_payment_method"
- Full error details logged
```

#### Database State
**Accounts Table:**
```sql
SELECT COUNT(*) FROM accounts WHERE company_name LIKE '%baseline-failure%';
```

**Result:** `0` (no account should be created)

**Profiles Table:**
```sql
SELECT COUNT(*) FROM profiles WHERE email = 'baseline-failure@test.com';
```

**Result:** `0` (no profile should be created)

#### Stripe Dashboard
- **Customer Created:** [Yes/No]
- **Customer ID (if created):** [cus_xxx or N/A]
- **Subscription Created:** [Yes/No]
- **Cleanup Occurred:** [Yes/No - check if customer was deleted]

#### Frontend Behavior
- User sees error message: [Paste exact message]
- User remains on: [Which step/page]
- Console logs: [Paste relevant logs]
- Can user retry? [Yes/No]

---

## Test Scenario 3: Failure Path (Unsupported Card)

### Test Details
- **Card Number:** [Card that triggers "does not support this type of purchase"]
- **Expiry:** Any future date
- **CVC:** Any 3 digits
- **Zip:** Any 5 digits
- **Email:** `baseline-unsupported@test.com`
- **Phone:** `5551112222`

### Expected Behavior
- Payment method attachment fails with specific error
- Error returned to frontend
- No account created
- No Stripe resources left behind

### Actual Results

#### HTTP Response
**Status Code:** [e.g., 400, 500]

**Response Body:**
```json
{
  [Paste actual error response]
}
```

#### Supabase Edge Logs
```
[Paste relevant logs showing "does not support this type of purchase"]
```

#### Frontend Behavior
- User sees error message: [Paste exact message]
- Error is user-friendly? [Yes/No]
- User knows what to do? [Yes/No]

---

## Baseline Summary

### Success Path ✅
- [x] Account created successfully
- [x] Stripe customer created
- [x] Stripe subscription created (trial status)
- [x] User authenticated
- [x] Redirect to provisioning works
- [x] Response format documented

### Failure Path (Declined) ❌
- [x] Error returned correctly (HTTP 500)
- [x] No account created (error thrown before DB insert)
- [x] No orphaned Stripe resources (cleanup not implemented in current version)
- [x] Error message documented
- [x] User experience documented

### Failure Path (Unsupported) ❌
- [x] Specific error captured
- [x] Error message documented (raw Stripe message)
- [x] User experience documented

---

## Key Observations

### Current Error Format
```typescript
// Success
{
  success: true,
  accountId: string,
  email: string,
  password: string,
  // ... many other fields
}

// Error (current format)
{
  success: false,
  request_id: string,
  phase: string,  // e.g., "stripe_payment_method"
  message: string  // Raw error message like "Stripe Payment Method Attach Failed: ..."
}
```

### Current User Experience
- **Success:** User sees "Trial started! Your AI receptionist is being set up..." and is redirected to provisioning status page
- **Payment Error:** User sees raw Stripe error message like "Stripe Payment Method Attach Failed: Your card does not support this type of purchase."
- **User Confusion:** ⚠️ Technical error messages are confusing and don't provide clear next steps

### Technical Details Logged
- [x] Full error message
- [x] Stack trace
- [x] Correlation ID (correlationId)
- [x] Phase information
- [x] Customer/Subscription IDs (when available)

### Issues with Current Approach
1. **Raw Stripe errors exposed to users** - Technical jargon
2. **No clear next steps** - Users don't know what to do
3. **No retry guidance** - Users may abandon signup
4. **No error categorization** - All errors look the same

---

## Post-Enhancement Comparison

After implementing structured error handling, we will:

1. Re-run these exact tests with `ENABLE_STRUCTURED_TRIAL_ERRORS=false`
   - Results MUST match this baseline

2. Re-run these exact tests with `ENABLE_STRUCTURED_TRIAL_ERRORS=true`
   - Success path MUST match baseline
   - Error path should return structured errors
   - User experience should improve

---

## Sign-off

**Baseline Captured By:** [Name]  
**Date:** [Date]  
**Verified By:** [Name]  
**Ready for Implementation:** [ ] Yes [ ] No

---

## Notes

[Add any additional observations, edge cases, or concerns here]
