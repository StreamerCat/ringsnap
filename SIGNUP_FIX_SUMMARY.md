# Signup Flow Fix Summary

**Date**: 2025-11-20
**Branch**: `claude/fix-enterprise-signup-019aRzfVGwkZhfwPc1uRkrUk`
**Status**: ✅ Core Fixes Complete - Ready for Testing

---

## Summary of Changes

### ✅ Task 1: Audit Frontend Payloads
**Status**: COMPLETED

**Findings**:
- **FreeTrialSignupForm**: Sends `areaCode` to deprecated `free-trial-signup` function
- **SalesSignupWizard**: Correctly sends `zipCode` to `create-trial` function
- **Mismatches identified**:
  - SalesSignupWizard uses `source: 'sales'` instead of `signup_channel: 'sales_guided'`
  - SalesSignupWizard uses `salesRepName: string` instead of `sales_rep_id: UUID`

**Documentation**: See `SIGNUP_AUDIT_REPORT.md` for full audit details

---

### ✅ Task 2: Remove Frontend-Derived `numberDesiredAreaCode`
**Status**: NO ACTION NEEDED

**Findings**:
- Frontend does NOT send `numberDesiredAreaCode` directly to backend
- Frontend sends either:
  - `areaCode` (FreeTrialSignupForm - 3 digits)
  - `zipCode` (SalesSignupWizard - 5 digits)
- Backend converts zipCode → areaCode → numberDesiredAreaCode for Vapi API

**Recommendation**:
- Migrate FreeTrialSignupForm to use `zipCode` instead of `areaCode` (future enhancement)
- No immediate changes required for this task

---

### ✅ Task 3: Implement Backend Option A Fallback
**Status**: COMPLETED

**Changes Made**:

#### provision-resources/index.ts
```typescript
// Before: Single attempt with area code, fail if unavailable
const phoneResponse = await fetch('https://api.vapi.ai/phone-number', {
  body: JSON.stringify({
    provider: 'vapi',
    numberDesiredAreaCode: areaCode  // ❌ Fails entirely if unavailable
  })
});

// After: Try with area code, fallback to no area code
let phoneResponse = await fetch('https://api.vapi.ai/phone-number', {
  body: JSON.stringify({
    provider: 'vapi',
    numberDesiredAreaCode: areaCode  // ✅ Try preferred area code first
  })
});

if (!phoneResponse.ok) {
  const errorText = await phoneResponse.text();
  const isAreaCodeError = errorText.toLowerCase().includes('not available') ||
                         errorText.toLowerCase().includes('area code');

  if (isAreaCodeError) {
    // ✅ Retry WITHOUT area code - accept any available number
    phoneResponse = await fetch('https://api.vapi.ai/phone-number', {
      body: JSON.stringify({
        provider: 'vapi',
        // No numberDesiredAreaCode - Vapi assigns any available number
      })
    });
  }
}
```

#### provision-phone-number/index.ts
```typescript
// Integrated fallback logic with existing retry mechanism
try {
  // Try with area code (3 retries with exponential backoff)
  phoneData = await retryWithBackoff(createPhoneWithAreaCode, 3, 2000);
} catch (areaCodeError) {
  if (isAreaCodeError(areaCodeError)) {
    // Retry WITHOUT area code (3 retries with exponential backoff)
    phoneData = await retryWithBackoff(createPhoneWithoutAreaCode, 3, 2000);
  } else {
    throw areaCodeError;
  }
}
```

**Benefits**:
- ✅ Prevents provisioning failures due to unavailable area codes
- ✅ Graceful degradation with clear logging
- ✅ Maintains user preference when possible
- ✅ No manual intervention needed
- ✅ Full observability via correlation IDs

---

### ✅ Task 4: Fix Voice Provider String
**Status**: VERIFIED - NO CHANGES NEEDED

**Investigation**:
Checked Vapi agent documentation (`.github/agents/vapi-provision-agent.md`)

**Findings**:
- ✅ Phone provider: `'vapi'` is **CORRECT**
- ✅ Voice provider: `'11labs'` is **CORRECT**

**Documentation Reference**:
```typescript
// Vapi Assistant Configuration (from official docs)
{
  voice: {
    provider: "11labs",     // ✅ Correct
    voiceId: "sarah" | "michael"
  }
}

// Vapi Phone Number Configuration (from official docs)
{
  provider: "vapi",         // ✅ Correct
  name: "Company Name - Primary",
  numberDesiredAreaCode: "415"
}
```

**No changes required** - current implementation matches Vapi API specification.

---

## Testing Plan

### 🔄 Task 5: Run Isolated Vapi Test
**Status**: READY FOR TESTING
**Endpoint**: `test-vapi-integration`

**Test Levels**:
1. **Minimal** (0 credits): API key validation only
2. **Phone** (low credits): Phone number creation test
3. **Assistant** (low credits): Assistant creation test
4. **Full** (high credits): Complete integration test with linking

**How to Run**:
```bash
# Test API key only (free)
curl -X POST https://your-project.supabase.co/functions/v1/test-vapi-integration \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"testLevel": "minimal"}'

# Test phone number creation (uses credits)
curl -X POST https://your-project.supabase.co/functions/v1/test-vapi-integration \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"testLevel": "phone"}'

# Full integration test (uses more credits)
curl -X POST https://your-project.supabase.co/functions/v1/test-vapi-integration \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type": application/json" \
  -d '{"testLevel": "full", "skipCleanup": false}'
```

**Expected Results**:
```json
{
  "success": true,
  "testLevel": "minimal",
  "tests": {
    "apiKey": {
      "success": true,
      "details": "Valid API key (X assistants found)"
    }
  },
  "summary": "✓ All tests passed!",
  "nextSteps": [
    "✓ API key validated successfully (0 credits used)",
    "Run with {\"testLevel\": \"phone\"} to test phone number creation"
  ]
}
```

---

### 🔄 Task 6: Re-Test Full Signup
**Status**: READY FOR TESTING

**Test Scenarios**:

#### Scenario 1: Self-Service Signup with Valid Area Code
```bash
# Prerequisites:
# - Valid Stripe test card
# - ZIP code with available area code (e.g., 94102 → 415)

# Expected Behavior:
# 1. Signup completes successfully
# 2. Phone number provisioned with area code 415
# 3. No fallback needed
# 4. Logs show: "VAPI phone number created successfully"
```

#### Scenario 2: Self-Service Signup with Unavailable Area Code
```bash
# Prerequisites:
# - Valid Stripe test card
# - ZIP code with unavailable area code (e.g., 00000 → 000)

# Expected Behavior:
# 1. First attempt with area code 000 fails
# 2. Log shows: "Area code not available, retrying without area code constraint"
# 3. Second attempt succeeds with ANY area code
# 4. Signup completes successfully
# 5. Phone number provisioned (any available area code)
# 6. Logs show: "Phone number created without area code constraint (fallback)"
```

#### Scenario 3: Sales-Guided Signup
```bash
# Prerequisites:
# - Logged in as sales rep
# - Valid Stripe test card
# - Customer ZIP code

# Expected Behavior:
# 1. Signup completes
# 2. zipCode converted to area code
# 3. Phone provisioning follows same fallback logic
# 4. Customer receives magic link email
# 5. Sales rep sees success modal WITHOUT password display
```

**Validation Queries**:
```sql
-- Check provisioning state transitions
SELECT * FROM provisioning_state_transitions
WHERE account_id = 'YOUR_ACCOUNT_ID'
ORDER BY created_at;

-- Check for orphaned Stripe resources (should be empty)
SELECT * FROM orphaned_stripe_resources
WHERE status = 'pending_manual_cleanup';

-- Check account provisioning status
SELECT
  id,
  email,
  provisioning_stage,
  phone_number_status,
  vapi_phone_number,
  phone_provisioned_at
FROM accounts
WHERE id = 'YOUR_ACCOUNT_ID';
```

---

## Remaining Work

### 🟡 Frontend Updates (Optional - Phase 4)
**Priority**: Medium
**Effort**: 2-3 hours

1. **Migrate FreeTrialSignupForm to zipCode**
   - Remove `areaCode` field (3 digits)
   - Add `zipCode` field (5 digits)
   - Update validation regex to `/^\d{5}$/`
   - Call `create-trial` instead of `free-trial-signup`

2. **Update SalesSignupWizard to Phase 2 fields**
   - Change `source: 'sales'` → `signup_channel: 'sales_guided'`
   - Change `salesRepName: string` → `sales_rep_id: UUID`
   - Get sales rep ID from authenticated user context

3. **Deprecate free-trial-signup function**
   - Add deprecation warning to function
   - Update all references to use `create-trial`
   - Schedule removal in Phase 5

### 🟢 Enhancement: Pass zipCode to Provisioning (Optional)
**Priority**: Low
**Effort**: 1 hour

**Current**: `create-trial-v2` doesn't pass zipCode to provisioning functions
**Enhancement**: Extract zipCode and pass to `provision-phone-number`

```typescript
// In create-trial-v2.ts
await supabase.from("provisioning_jobs").insert({
  account_id: accountResult.account_id,
  job_type: "full_provisioning",
  metadata: {
    ...existing fields,
    zip_code: data.zipCode,  // ✅ Add this
  }
});
```

---

## Success Criteria

### ✅ Completed
- [x] Area code fallback implemented in `provision-resources`
- [x] Area code fallback implemented in `provision-phone-number`
- [x] Voice provider strings verified (no changes needed)
- [x] Comprehensive audit documentation created
- [x] Changes committed and pushed to branch

### 🔄 In Progress
- [ ] Run `test-vapi-integration` to verify Vapi connectivity
- [ ] Test self-service signup with valid area code
- [ ] Test self-service signup with unavailable area code (fallback)
- [ ] Test sales-guided signup flow
- [ ] Verify state transitions logged correctly
- [ ] Verify no orphaned Stripe resources

### 🟡 Optional Enhancements
- [ ] Migrate FreeTrialSignupForm to use zipCode
- [ ] Update SalesSignupWizard to use Phase 2 field names
- [ ] Deprecate `free-trial-signup` function
- [ ] Pass zipCode from `create-trial-v2` to provisioning

---

## Files Modified

### Core Fixes
1. `supabase/functions/provision-resources/index.ts`
   - Added area code fallback logic (lines 92-199)
   - Enhanced logging with requested vs actual area code

2. `supabase/functions/provision-phone-number/index.ts`
   - Added area code fallback integrated with retry mechanism (lines 187-292)
   - Enhanced error detection for area code issues

### Documentation
3. `SIGNUP_AUDIT_REPORT.md` (NEW)
   - Complete audit of frontend/backend payload mismatches
   - Documented voice provider verification
   - Created testing plan

4. `SIGNUP_FIX_SUMMARY.md` (THIS FILE)
   - Summary of all changes
   - Testing instructions
   - Success criteria

---

## How to Test

### Quick Validation (5 minutes)
```bash
# 1. Test Vapi API key
curl -X POST https://your-project.supabase.co/functions/v1/test-vapi-integration \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"testLevel": "minimal"}'

# Expected: {"success": true, "tests": {"apiKey": {"success": true}}}
```

### Full Integration Test (15-20 minutes)
```bash
# 1. Deploy updated functions
npm run functions:deploy

# 2. Run minimal Vapi test (free)
curl test-vapi-integration with testLevel: "minimal"

# 3. Run phone test (uses credits - optional)
curl test-vapi-integration with testLevel: "phone"

# 4. Test signup with valid area code
# - Use frontend form or API call
# - ZIP code: 94102 (area code 415)

# 5. Test signup with invalid area code
# - Use frontend form or API call
# - ZIP code: 00000 (area code 000 - unavailable)
# - Verify fallback works

# 6. Check database
# - Query provisioning_state_transitions
# - Query orphaned_stripe_resources
# - Verify phone_number assigned
```

---

## Deployment Checklist

### Pre-Deployment
- [x] Code committed to branch
- [x] Changes pushed to remote
- [ ] Run local Supabase test (if possible)
- [ ] Review code changes one more time

### Deployment
- [ ] Deploy `provision-resources` function
- [ ] Deploy `provision-phone-number` function
- [ ] Test Vapi integration endpoint
- [ ] Monitor logs for first hour

### Post-Deployment
- [ ] Test self-service signup
- [ ] Test sales-guided signup
- [ ] Verify no orphaned Stripe resources
- [ ] Check stuck provisioning accounts view

### Rollback Plan
If issues occur:
```bash
# Revert to previous commit
git revert HEAD
git push

# Redeploy old version
npm run functions:deploy
```

---

## Contact & Support

**Branch**: `claude/fix-enterprise-signup-019aRzfVGwkZhfwPc1uRkrUk`
**Related Docs**:
- `SIGNUP_AUDIT_REPORT.md` - Full audit findings
- `IMPLEMENTATION_REVIEW.md` - Phase 1-3 implementation
- `.github/agents/vapi-provision-agent.md` - Vapi integration docs

**Next Steps**:
1. Run `test-vapi-integration` endpoint
2. Test signup flows
3. Verify fallback behavior
4. Monitor provisioning success rates
