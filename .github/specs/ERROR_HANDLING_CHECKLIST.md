# Error Handling Implementation Checklist

**Feature:** Structured Error Handling for Trial Signup  
**Approach:** Feature-Flagged, Incremental, Reversible  
**Risk Level:** 🔴 HIGH

---

## ⚠️ CRITICAL: Read Before Starting

- [ ] I have read the SAFE implementation plan
- [ ] I understand this is HIGH-RISK (touches critical signup flow)
- [ ] I will follow the feature-flag approach
- [ ] I will capture baseline BEFORE any code changes
- [ ] I will test with flag OFF before turning it ON
- [ ] I have the rollback guide ready

---

## Phase 0: Preparation (MANDATORY)

### 0.1: Documentation Review
- [ ] Read `.github/specs/error-handling-ux-hardening-SAFE.md`
- [ ] Read `docs/ERROR_HANDLING_ROLLBACK.md`
- [ ] Read `docs/ERROR_CODES.md`
- [ ] Understand feature flag approach

### 0.2: Environment Setup
- [ ] Local development environment ready
- [ ] Supabase CLI installed and configured
- [ ] Can deploy edge functions locally
- [ ] Can test signup flow locally

### 0.3: Baseline Capture (DO NOT SKIP)
- [ ] Create test account for baseline testing
- [ ] Run Test 1: Valid card (`4242424242424242`)
  - [ ] Capture HTTP response
  - [ ] Capture Supabase logs
  - [ ] Capture database state
  - [ ] Capture Stripe dashboard state
- [ ] Run Test 2: Declined card (`4000000000000002`)
  - [ ] Capture HTTP response
  - [ ] Capture Supabase logs
  - [ ] Verify no account created
  - [ ] Verify Stripe cleanup
- [ ] Run Test 3: Unsupported card (if available)
  - [ ] Capture error message
  - [ ] Capture user experience
- [ ] Document all results in `docs/ERROR_HANDLING_BASELINE.md`
- [ ] **SIGN-OFF:** Baseline captured and documented

---

## Phase 1: Backend Implementation

### 1.1: Create Feature Branch
```bash
git checkout -b feature/error-handling-ux
git push -u origin feature/error-handling-ux
```
- [ ] Branch created
- [ ] Branch pushed to remote

### 1.2: Add Feature Flag
**File:** `supabase/functions/create-trial/index.ts`

Add at top of file (after imports):
```typescript
// Feature flag for structured error responses
const ENABLE_STRUCTURED_TRIAL_ERRORS =
  Deno.env.get("ENABLE_STRUCTURED_TRIAL_ERRORS") === "true";
```

- [ ] Feature flag added
- [ ] Code compiles
- [ ] No syntax errors

### 1.3: Add Type Definitions
**File:** `supabase/functions/create-trial/index.ts`

Add after imports, before functions:
```typescript
interface TrialCreationErrorResponse {
  success: false;
  errorCode: string;
  userMessage: string;
  debugMessage?: string;
  correlationId: string;
  phase?: string;
  retryable: boolean;
  suggestedAction?: string;
  error?: string;
  message?: string;
}

type ErrorCode = 'CARD_DECLINED' | 'CARD_NOT_SUPPORTED' | /* ... */;
```

- [ ] Types added
- [ ] Code compiles
- [ ] TypeScript happy

### 1.4: Add Helper Function
**File:** `supabase/functions/create-trial/index.ts`

Add `mapStripeErrorToUserError()` function before `Deno.serve()`:

- [ ] Function added
- [ ] All error cases covered:
  - [ ] Card not supported
  - [ ] Card declined
  - [ ] Insufficient funds
  - [ ] Expired card
  - [ ] Incorrect CVC
  - [ ] Fallback case
- [ ] Legacy fields included (`error`, `message`)
- [ ] Code compiles

### 1.5: Update Stripe Payment Method Error Handler
**File:** `supabase/functions/create-trial/index.ts`  
**Location:** Line ~664-676

Replace:
```typescript
} catch (e: any) {
  throw new Error(`Stripe Payment Method Attach Failed: ${e.message}`);
}
```

With feature-flagged version:
```typescript
} catch (e: any) {
  logError("Stripe payment method attach failed", { /* ... */ });
  
  if (ENABLE_STRUCTURED_TRIAL_ERRORS) {
    const errorResponse = mapStripeErrorToUserError(e, phase, correlationId);
    return new Response(JSON.stringify(errorResponse), { /* ... */ });
  } else {
    throw new Error(`Stripe Payment Method Attach Failed: ${e.message}`);
  }
}
```

- [ ] Error handler updated
- [ ] Logging preserved
- [ ] Feature flag check added
- [ ] Legacy behavior preserved when flag OFF
- [ ] Code compiles

### 1.6: Update Stripe Subscription Error Handler
**File:** `supabase/functions/create-trial/index.ts`  
**Location:** Line ~679-701

Apply same pattern as 1.5:

- [ ] Error handler updated
- [ ] Logging preserved
- [ ] Feature flag check added
- [ ] Legacy behavior preserved
- [ ] Code compiles

### 1.7: Update Global Error Handler
**File:** `supabase/functions/create-trial/index.ts`  
**Location:** Bottom of function (catch block)

Add structured error response option:

- [ ] Global error handler updated
- [ ] Logging preserved
- [ ] Cleanup logic preserved
- [ ] Feature flag check added
- [ ] Legacy behavior preserved
- [ ] Code compiles

### 1.8: Backend Testing (Local)
- [ ] Function compiles without errors
- [ ] Function deploys locally
- [ ] Test with flag OFF (should behave as before)
- [ ] Test with flag ON (should return structured errors)

### 1.9: Backend Commit
```bash
git add supabase/functions/create-trial/index.ts
git commit -m "feat: Add feature-flagged structured error handling to create-trial

- Add ENABLE_STRUCTURED_TRIAL_ERRORS feature flag
- Add TrialCreationErrorResponse type
- Add mapStripeErrorToUserError helper
- Update Stripe error handlers with structured responses
- Preserve legacy behavior when flag is OFF
- All changes are additive and reversible"
```

- [ ] Changes committed
- [ ] Commit message descriptive
- [ ] Changes pushed to branch

---

## Phase 2: Frontend Implementation

### 2.1: Create Error Utility
**File:** `src/lib/errors.ts` (new file)

Create shared error utility:

- [ ] File created
- [ ] `AppError` interface defined
- [ ] `extractUserError()` function implemented
  - [ ] Handles new structured format
  - [ ] Handles legacy format
  - [ ] Provides sensible fallbacks
- [ ] `logClientError()` function implemented
- [ ] Code compiles
- [ ] TypeScript happy

### 2.2: Update OnboardingChat.tsx
**File:** `src/pages/OnboardingChat.tsx`  
**Location:** Line ~836-894 (handlePayment error handling)

- [ ] Import error utility
- [ ] Update error handling to use `extractUserError()`
- [ ] Add defensive checks for both formats
- [ ] Show user-friendly messages
- [ ] Keep user on payment step for retryable errors
- [ ] Log technical details
- [ ] Code compiles
- [ ] No TypeScript errors

### 2.3: Update SelfServeTrialFlow.tsx
**File:** `src/components/onboarding/SelfServeTrialFlow.tsx`

Apply same pattern as OnboardingChat:

- [ ] Import error utility
- [ ] Update error handling
- [ ] Defensive implementation
- [ ] Code compiles

### 2.4: Update SalesGuidedTrialFlow.tsx
**File:** `src/components/onboarding/SalesGuidedTrialFlow.tsx`

- [ ] Import error utility
- [ ] Update error handling
- [ ] Code compiles

### 2.5: Update SalesGuidedTrialFlowEmbedded.tsx
**File:** `src/components/onboarding/SalesGuidedTrialFlowEmbedded.tsx`

- [ ] Import error utility
- [ ] Update error handling
- [ ] Code compiles

### 2.6: Update AISignup.tsx
**File:** `src/pages/AISignup.tsx`

- [ ] Import error utility
- [ ] Update error handling
- [ ] Code compiles

### 2.7: Update SalesSignupForm.tsx
**File:** `src/components/SalesSignupForm.tsx`

- [ ] Import error utility
- [ ] Update error handling
- [ ] Code compiles

### 2.8: Frontend Testing (Local)
- [ ] App builds without errors
- [ ] All signup flows work with legacy errors
- [ ] All signup flows work with structured errors
- [ ] Error messages are user-friendly
- [ ] Retry functionality works

### 2.9: Frontend Commit
```bash
git add src/lib/errors.ts
git add src/pages/OnboardingChat.tsx
git add src/components/onboarding/*.tsx
git add src/pages/AISignup.tsx
git add src/components/SalesSignupForm.tsx
git commit -m "feat: Add defensive error handling to signup flows

- Create shared error utility (handles both formats)
- Update all signup flows to use extractUserError()
- Show user-friendly messages for payment errors
- Keep users on payment step for retryable errors
- Log technical details for debugging
- Backward compatible with legacy error format"
```

- [ ] Changes committed
- [ ] Changes pushed

---

## Phase 3: Regression Testing (Flag OFF)

### 3.1: Deploy to Staging (Flag OFF)
```bash
# Deploy backend
supabase functions deploy create-trial

# Ensure flag is OFF or unset
supabase secrets unset ENABLE_STRUCTURED_TRIAL_ERRORS

# Deploy frontend (via Vercel or manual)
npm run build
```

- [ ] Backend deployed
- [ ] Frontend deployed
- [ ] Flag is OFF (or unset)

### 3.2: Test Success Path (Flag OFF)
**Card:** `4242424242424242`

- [ ] Trial created successfully
- [ ] Response matches baseline
- [ ] Account created
- [ ] Stripe customer created
- [ ] Stripe subscription created
- [ ] User authenticated
- [ ] Redirect to provisioning works
- [ ] **NO REGRESSIONS**

### 3.3: Test Failure Path (Flag OFF)
**Card:** `4000000000000002`

- [ ] Error returned
- [ ] Response matches baseline
- [ ] No account created
- [ ] No Stripe resources left behind
- [ ] Error message matches baseline
- [ ] **NO REGRESSIONS**

### 3.4: Regression Sign-Off
- [ ] All tests pass
- [ ] Behavior identical to baseline
- [ ] No regressions detected
- [ ] **APPROVED TO ENABLE FLAG**

---

## Phase 4: Enhanced Testing (Flag ON)

### 4.1: Enable Feature Flag
```bash
supabase secrets set ENABLE_STRUCTURED_TRIAL_ERRORS=true
```

- [ ] Flag enabled in staging
- [ ] Verified in Supabase dashboard

### 4.2: Test Success Path (Flag ON)
**Card:** `4242424242424242`

- [ ] Trial created successfully
- [ ] Response has `success: true`
- [ ] Account created
- [ ] Stripe customer created
- [ ] Stripe subscription created
- [ ] User authenticated
- [ ] Redirect works
- [ ] **SUCCESS PATH UNCHANGED**

### 4.3: Test Declined Card (Flag ON)
**Card:** `4000000000000002`

Expected response:
```json
{
  "success": false,
  "errorCode": "CARD_DECLINED",
  "userMessage": "Your card was declined. Please try a different card.",
  "retryable": true,
  "suggestedAction": "Try a different payment method"
}
```

- [ ] Structured error returned
- [ ] User sees friendly message
- [ ] User can retry
- [ ] No account created
- [ ] Stripe cleanup occurred
- [ ] Logs contain technical details

### 4.4: Test Insufficient Funds (Flag ON)
**Card:** `4000000000009995`

- [ ] Structured error returned
- [ ] `errorCode: "INSUFFICIENT_FUNDS"`
- [ ] User-friendly message shown
- [ ] User can retry

### 4.5: Test Expired Card (Flag ON)
**Card:** `4000000000000069`

- [ ] Structured error returned
- [ ] `errorCode: "CARD_EXPIRED"`
- [ ] User-friendly message shown
- [ ] User can retry

### 4.6: Test Incorrect CVC (Flag ON)
**Card:** `4000000000000127`

- [ ] Structured error returned
- [ ] `errorCode: "INCORRECT_CVC"`
- [ ] User-friendly message shown
- [ ] User can retry

### 4.7: Enhanced Testing Sign-Off
- [ ] All error types return structured responses
- [ ] User messages are clear and actionable
- [ ] Retry functionality works
- [ ] Logging is comprehensive
- [ ] No technical details in UI
- [ ] **APPROVED FOR PRODUCTION**

---

## Phase 5: Production Deployment

### 5.1: Deploy to Production (Flag OFF Initially)
```bash
# Deploy backend
supabase functions deploy create-trial --project-ref [prod-ref]

# Ensure flag is OFF initially
supabase secrets unset ENABLE_STRUCTURED_TRIAL_ERRORS --project-ref [prod-ref]

# Deploy frontend to production
# (via Vercel automatic deployment or manual)
```

- [ ] Backend deployed to production
- [ ] Frontend deployed to production
- [ ] Flag is OFF
- [ ] Monitoring in place

### 5.2: Monitor Production (Flag OFF)
**Duration:** 24 hours

- [ ] Signup success rate normal
- [ ] No increase in errors
- [ ] Provisioning working correctly
- [ ] No user complaints
- [ ] **STABLE WITH FLAG OFF**

### 5.3: Enable Flag in Production
```bash
supabase secrets set ENABLE_STRUCTURED_TRIAL_ERRORS=true --project-ref [prod-ref]
```

- [ ] Flag enabled
- [ ] Verified in dashboard
- [ ] Timestamp recorded: [___________]

### 5.4: Monitor Production (Flag ON)
**Duration:** First 1 hour (close monitoring), then 24 hours

**First Hour:**
- [ ] 15 min: Check signup success rate
- [ ] 30 min: Check error logs
- [ ] 45 min: Check user feedback
- [ ] 60 min: Verify provisioning working

**First 24 Hours:**
- [ ] Signup success rate stable or improved
- [ ] Error messages user-friendly
- [ ] No increase in support tickets
- [ ] Provisioning working correctly
- [ ] Stripe resources created correctly

### 5.5: Production Sign-Off
- [ ] Feature working as expected
- [ ] User experience improved
- [ ] No regressions
- [ ] Monitoring shows healthy metrics
- [ ] **PRODUCTION DEPLOYMENT SUCCESSFUL**

---

## Phase 6: Documentation & Cleanup

### 6.1: Update Documentation
- [ ] Update `docs/ERROR_HANDLING_BASELINE.md` with results
- [ ] Update `docs/ERROR_CODES.md` if needed
- [ ] Create `docs/ERROR_HANDLING.md` with final patterns
- [ ] Update CHANGELOG.md

### 6.2: Create Pull Request
```markdown
# Error Handling + UX Hardening

## Summary
Implements feature-flagged structured error handling for trial signup flow.

## Changes
- Backend: Add structured error responses to create-trial
- Frontend: Add defensive error handling to all signup flows
- Utility: Create shared error extraction utility

## Testing
- ✅ Baseline captured
- ✅ Regression testing passed (flag OFF)
- ✅ Enhanced testing passed (flag ON)
- ✅ Production monitoring successful

## Rollback
Set `ENABLE_STRUCTURED_TRIAL_ERRORS=false` to revert

## Risk
HIGH - Touches critical signup flow
Mitigated by: Feature flag, baseline testing, comprehensive testing

## Deployment
1. Deployed with flag OFF
2. Monitored for 24 hours
3. Enabled flag
4. Monitored for 24 hours
5. All metrics healthy
```

- [ ] PR created
- [ ] PR reviewed
- [ ] PR approved
- [ ] PR merged

### 6.3: Cleanup
- [ ] Delete feature branch (after merge)
- [ ] Archive baseline testing data
- [ ] Update team on new error handling patterns

---

## Rollback Procedure (If Needed)

If ANY issues arise:

1. **Immediate:** Set `ENABLE_STRUCTURED_TRIAL_ERRORS=false`
2. **If insufficient:** Follow `docs/ERROR_HANDLING_ROLLBACK.md`
3. **Document:** What went wrong and why
4. **Fix:** Address issue before re-enabling

---

## Success Criteria

- ✅ No regressions in trial signup flow
- ✅ User-friendly error messages shown
- ✅ Users can retry payment errors
- ✅ Technical details logged but not shown to users
- ✅ Signup success rate stable or improved
- ✅ Support tickets about payment errors reduced
- ✅ Easy to rollback if needed

---

## Sign-Off

**Implementation Completed By:** [Name]  
**Date:** [Date]  
**Production Deployment:** [Date]  
**Status:** [ ] In Progress [ ] Completed [ ] Rolled Back

---

**Last Updated:** 2025-12-11  
**Maintained By:** RingSnap Engineering Team
