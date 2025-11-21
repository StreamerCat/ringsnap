# Signup Flow Audit Report

**Date**: 2025-11-20
**Status**: Issues Identified - Fixes In Progress

---

## 1. Frontend Payload Audit

### FreeTrialSignupForm.tsx
**Endpoint**: `free-trial-signup`
**Payload Sent**:
```typescript
{
  name: string,
  email: string,
  phone: string,
  areaCode: string,        // ⚠️ ISSUE: Should use zipCode instead
  companyName?: string
}
```

**Issues**:
- ❌ Sends `areaCode` directly instead of `zipCode`
- ❌ Frontend collects 3-digit area code from user
- ⚠️ `free-trial-signup` function is DEPRECATED (comment says use `create-trial`)

**Recommendation**: Update form to use `zipCode` and migrate to `create-trial` function

---

### SalesSignupWizard.tsx
**Endpoint**: `create-trial`
**Payload Sent**:
```typescript
{
  name: string,              // ✅ customerName
  email: string,             // ✅ customerEmail
  phone: string,             // ✅ customerPhone
  companyName: string,       // ✅
  trade: string,             // ✅
  zipCode: string,           // ✅ CORRECT - uses zipCode not areaCode
  planType: string,          // ✅
  paymentMethodId: string,   // ✅
  source: 'sales',           // ⚠️ Should be signup_channel: 'sales_guided'
  salesRepName: string,      // ⚠️ Should be sales_rep_id: UUID
  leadId?: string,           // ✅
  serviceArea?: string,      // ✅
  businessHours?: string,    // ✅
  emergencyPolicy?: string,  // ✅
  assistantGender: string,   // ✅
  wantsAdvancedVoice: boolean // ✅
}
```

**Issues**:
- ⚠️ Uses `source: 'sales'` instead of `signup_channel: 'sales_guided'` (Phase 2 breaking change)
- ⚠️ Uses `salesRepName: string` instead of `sales_rep_id: UUID` (Phase 2 breaking change)
- ✅ Correctly uses `zipCode` not `areaCode`

**Recommendation**: Update to use Phase 2 field names (`signup_channel`, `sales_rep_id`)

---

## 2. Backend Validator Comparison

### free-trial-signup/index.ts (DEPRECATED)
**Expected Schema**:
```typescript
{
  name: string (1-100 chars),
  email: string (valid email, max 255),
  phone: string (min 1),
  areaCode: string (/^\d{3}$/),       // ⚠️ Expects 3-digit area code
  companyName?: string (max 200),
  companyWebsite?: string (max 255),
  deviceFingerprint?: string (max 500),
  trade?: string (max 100),
  wantsAdvancedVoice?: boolean,
  zipCode?: string,
  assistantGender?: 'female' | 'male',
  referralCode?: string (max 50),
  source?: string (max 100),
  planType: 'starter' | 'professional' | 'premium',
  paymentMethodId: string (min 1)
}
```

**Issues**:
- ❌ Expects `areaCode` as required field
- ⚠️ Entire function is deprecated but still in use
- ⚠️ Passes `areaCode` to `provision-resources` function

---

### create-trial/index-v2.ts (Phase 2)
**Expected Schema**:
```typescript
{
  name: string (1-100 chars),
  email: string (valid email, max 255),
  phone: string (min 1),
  companyName: string (1-200 chars),
  trade: string (1-100 chars),
  website?: string (valid URL or empty),
  serviceArea?: string (max 200),
  zipCode?: string (/^\d{5}$/ or empty),      // ✅ Expects 5-digit ZIP
  businessHours?: string (max 500),
  emergencyPolicy?: string (max 1000),
  assistantGender: 'male' | 'female' (default: 'female'),
  primaryGoal?: 'book_appointments' | 'capture_leads' | 'answer_questions' | 'take_orders',
  wantsAdvancedVoice?: boolean (default: false),
  planType: 'starter' | 'professional' | 'premium',
  paymentMethodId: string (min 1),
  signup_channel: 'self_service' | 'sales_guided' | 'enterprise' (default: 'self_service'),
  sales_rep_id?: string (UUID) | null,
  referralCode?: string (length 8 or empty),
  deviceFingerprint?: string (max 500),
  leadId?: string (UUID) | null
}
```

**Issues**:
- ✅ Expects `zipCode` not `areaCode` (correct)
- ⚠️ Does NOT pass zipCode to provisioning functions (missing implementation)
- ✅ Uses Phase 2 fields (`signup_channel`, `sales_rep_id`)

---

## 3. Area Code Issues

### Problem: `numberDesiredAreaCode` sent to Vapi API

**Locations Using numberDesiredAreaCode**:
1. `provision-resources/index.ts:116`
2. `provision-phone-number/index.ts:158`
3. `test-vapi-integration/index.ts:91`

**Current Behavior**:
```typescript
body: JSON.stringify({
  provider: 'vapi',
  name: `${companyName} - Primary`,
  fallbackDestination: { ... },
  numberDesiredAreaCode: areaCode    // ⚠️ ISSUE: No fallback if area code not available
})
```

**Issue**: If Vapi API returns error "area code not available", entire provisioning fails with no retry

**Required Fix**: Implement Option A fallback:
```typescript
// Try with area code first
try {
  const phoneData = await createPhoneWithAreaCode(areaCode);
} catch (error) {
  if (error.message.includes('not available') || error.message.includes('area code')) {
    // Retry WITHOUT area code - let Vapi choose any available number
    const phoneData = await createPhoneWithoutAreaCode();
  } else {
    throw error;
  }
}
```

---

## 4. Voice Provider String Issues

### provision-resources/index.ts

**Phone Number Creation (line 110)**:
```typescript
body: JSON.stringify({
  provider: 'vapi',     // ⚠️ NEEDS VERIFICATION: Is 'vapi' correct?
  ...
})
```

**Voice Configuration (line 182)**:
```typescript
voice: {
  provider: '11labs',   // ⚠️ MIGHT BE WRONG: Should be 'elevenlabs'?
  voiceId: voiceId,
}
```

### test-vapi-integration/index.ts

**Phone Number Creation (line 89)**:
```typescript
provider: 'vapi',       // ⚠️ Same as above
```

**Voice Configuration (line 159)**:
```typescript
voice: {
  provider: '11labs',   // ⚠️ Same as above
  voiceId: 'sarah'
}
```

**Question**: What is the correct provider string?
- `'vapi'` for phone provider? Or should it be `'twilio'`, `'vonage'`, etc.?
- `'11labs'` for voice provider? Or should it be `'elevenlabs'`?

**Action Required**: Check Vapi API documentation or test to determine correct provider strings

---

## 5. Data Flow Mismatch

### Current Flow:
```
FreeTrialSignupForm
  ↓ areaCode (3-digit)
free-trial-signup function
  ↓ areaCode
provision-resources
  ↓ numberDesiredAreaCode: areaCode
Vapi API (fails if area code unavailable)
```

### Expected Flow (Sales):
```
SalesSignupWizard
  ↓ zipCode (5-digit)
create-trial function
  ↓ zipCode → areaCode conversion (missing!)
provision-phone-number
  ↓ numberDesiredAreaCode: areaCode (with fallback)
Vapi API (retry without area code on error)
```

**Missing Implementation**:
- `create-trial-v2` does NOT pass zipCode to provisioning
- No conversion from zipCode to areaCode
- No fallback logic for area code failures

---

## 6. Recommendations

### Immediate Fixes (Priority 1):
1. ✅ **Implement area code fallback in `provision-resources`**
   - Try with area code first
   - Retry without area code if "not available" error
   - Log both attempts with correlation ID

2. ✅ **Implement area code fallback in `provision-phone-number`**
   - Same retry logic as above
   - Use existing `retryWithBackoff` helper

3. ✅ **Verify and fix voice provider strings**
   - Run `test-vapi-integration` with different provider strings
   - Update all functions with correct provider values

### Short Term (Priority 2):
4. **Migrate FreeTrialSignupForm to use zipCode**
   - Remove areaCode field
   - Add zipCode field (5 digits)
   - Update to call `create-trial` instead of `free-trial-signup`

5. **Update SalesSignupWizard to use Phase 2 fields**
   - Change `source: 'sales'` → `signup_channel: 'sales_guided'`
   - Change `salesRepName: string` → `sales_rep_id: UUID`
   - Get sales rep ID from current authenticated user

### Long Term (Priority 3):
6. **Deprecate and remove `free-trial-signup` function**
   - All forms should use unified `create-trial` function
   - Reduces maintenance burden
   - Consistent behavior across all channels

7. **Pass zipCode from `create-trial-v2` to provisioning**
   - Extract zipCode from validated data
   - Convert to area code using `getAreaCodeFromZip()`
   - Pass to `provision-phone-number` function

---

## 7. Testing Plan

### Phase 1: Fix Area Code Fallback
1. Update `provision-resources` with fallback logic
2. Update `provision-phone-number` with fallback logic
3. Update `test-vapi-integration` if needed
4. Run `test-vapi-integration` to verify Vapi connectivity
5. Test with area code that doesn't exist (e.g., "000")

### Phase 2: Fix Voice Provider Strings
1. Run `test-vapi-integration` with current strings
2. Check Vapi API docs for correct provider values
3. Update all functions with correct strings
4. Re-run `test-vapi-integration` to verify

### Phase 3: Update Frontend Forms
1. Update FreeTrialSignupForm to use zipCode
2. Update SalesSignupWizard to use Phase 2 fields
3. Test self-service signup flow
4. Test sales-guided signup flow

### Phase 4: Full Integration Test
1. Test self-service signup with valid zipCode
2. Test self-service signup with invalid zipCode (fallback)
3. Test sales-guided signup with valid zipCode
4. Test sales-guided signup with invalid zipCode (fallback)
5. Verify no orphaned Stripe resources
6. Verify state transitions logged correctly

---

## 8. Summary of Issues

| Issue | Severity | Status | Fix Required |
|-------|----------|--------|--------------|
| No area code fallback in provision-resources | 🔴 Critical | Open | Implement retry without area code |
| No area code fallback in provision-phone-number | 🔴 Critical | Open | Implement retry without area code |
| Voice provider string unverified | 🟡 Medium | Open | Test and verify correct strings |
| FreeTrialSignupForm uses areaCode | 🟡 Medium | Open | Migrate to zipCode |
| SalesSignupWizard uses old field names | 🟡 Medium | Open | Update to Phase 2 fields |
| create-trial-v2 doesn't pass zipCode | 🟢 Low | Open | Add zipCode to provisioning payload |
| free-trial-signup is deprecated | 🟢 Low | Open | Migrate all forms to create-trial |

---

**Next Steps**:
1. Fix critical area code fallback issues
2. Verify voice provider strings
3. Run test-vapi-integration
4. Re-test full signup flow
