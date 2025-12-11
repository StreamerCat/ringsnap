# Error Handling + UX Hardening - SAFE IMPLEMENTATION PLAN

**Created:** 2025-12-11  
**Status:** Ready for Implementation  
**Risk Level:** 🔴 HIGH (touches critical signup flow)  
**Approach:** ⚠️ INCREMENTAL, ADDITIVE, FEATURE-FLAGGED, EASILY REVERSIBLE

---

## ⚠️ CRITICAL CONSTRAINTS

### DO NOT BREAK `create-trial`
- ✅ Function JUST started working reliably
- ✅ Trial provisioning (Auth + Account + Stripe + Vapi) MUST NOT break
- ✅ All changes must be thin wrappers, NOT refactors
- ✅ Feature-flagged for easy rollback
- ✅ Baseline testing BEFORE any changes

### Guardrails
1. **No contract changes** - Request/response schemas stay the same
2. **Additive only** - Add new fields, don't remove existing ones
3. **Feature-flagged** - `ENABLE_STRUCTURED_TRIAL_ERRORS` env var
4. **Backward compatible** - Frontend handles both old and new formats
5. **Baseline testing** - Capture before/after behavior
6. **Easy rollback** - Toggle flag to revert, no code deploy needed

---

## 🎯 Implementation Strategy

### Phase 0: Baseline Capture (MANDATORY FIRST STEP)

**Before ANY code changes**, capture current behavior:

#### Test Scenarios
1. **Success scenario** - Valid test card `4242424242424242`
2. **Failure scenario** - Declined card `4000000000000002`

#### Data to Capture
For each scenario:
- HTTP status code
- Complete JSON response
- Supabase edge logs (create-trial function)
- Frontend console logs
- Network request/response

#### Storage
Create `docs/ERROR_HANDLING_BASELINE.md` with:
```markdown
# create-trial Baseline Behavior (Pre-Enhancement)

## Success Scenario (Valid Card)
**Card:** 4242424242424242
**Status:** 200
**Response:**
```json
{
  "success": true,
  "email": "test@example.com",
  "password": "...",
  "accountId": "...",
  "userId": "..."
}
```
**Logs:** [paste relevant logs]

## Failure Scenario (Declined Card)
**Card:** 4000000000000002
**Status:** 400 (or 500)
**Response:**
```json
{
  "error": "Stripe Payment Method Attach Failed: ..."
}
```
**Logs:** [paste relevant logs]
```

---

## Phase 1: Backend - Minimal Additive Changes

### 1.1: Add Feature Flag (Top of file)

```typescript
// Feature flag for structured error responses
// Set to "true" to enable user-friendly error messages
// Set to "false" or omit to preserve legacy behavior
const ENABLE_STRUCTURED_TRIAL_ERRORS =
  Deno.env.get("ENABLE_STRUCTURED_TRIAL_ERRORS") === "true";
```

### 1.2: Add Type Definitions (After imports)

```typescript
// Structured error response (ADDITIVE - does not replace existing types)
interface TrialCreationErrorResponse {
  success: false;
  errorCode: string;
  userMessage: string;
  debugMessage?: string;
  correlationId: string;
  phase?: string;
  retryable: boolean;
  suggestedAction?: string;
  // Legacy fields preserved for backward compatibility
  error?: string;
  message?: string;
}

type ErrorCode =
  | 'CARD_DECLINED'
  | 'CARD_NOT_SUPPORTED'
  | 'CARD_EXPIRED'
  | 'INSUFFICIENT_FUNDS'
  | 'INCORRECT_CVC'
  | 'PAYMENT_AUTH_REQUIRED'
  | 'PAYMENT_PROCESSOR_ERROR'
  | 'INTERNAL_ERROR';
```

### 1.3: Add Helper Function (Before Deno.serve)

```typescript
/**
 * Map Stripe error to user-friendly error response
 * ONLY used when ENABLE_STRUCTURED_TRIAL_ERRORS is true
 */
function mapStripeErrorToUserError(
  stripeError: any,
  phase: string,
  correlationId: string
): TrialCreationErrorResponse {
  const message = stripeError.message?.toLowerCase() || '';
  
  // Card not supported
  if (message.includes('does not support this type of purchase')) {
    return {
      success: false,
      errorCode: 'CARD_NOT_SUPPORTED',
      userMessage: 'This card was declined by your bank. Please try a different card or contact your bank.',
      debugMessage: stripeError.message,
      correlationId,
      phase,
      retryable: true,
      suggestedAction: 'Try a different payment method',
      // Legacy fields
      error: stripeError.message,
      message: stripeError.message
    };
  }
  
  // Generic card declined
  if (message.includes('card_declined') || message.includes('declined')) {
    return {
      success: false,
      errorCode: 'CARD_DECLINED',
      userMessage: 'Your card was declined. Please try a different card.',
      debugMessage: stripeError.message,
      correlationId,
      phase,
      retryable: true,
      suggestedAction: 'Try a different payment method',
      error: stripeError.message,
      message: stripeError.message
    };
  }
  
  // Insufficient funds
  if (message.includes('insufficient') || message.includes('funds')) {
    return {
      success: false,
      errorCode: 'INSUFFICIENT_FUNDS',
      userMessage: 'Your card was declined due to insufficient funds. Please try a different card.',
      debugMessage: stripeError.message,
      correlationId,
      phase,
      retryable: true,
      suggestedAction: 'Try a different payment method',
      error: stripeError.message,
      message: stripeError.message
    };
  }
  
  // Expired card
  if (message.includes('expired')) {
    return {
      success: false,
      errorCode: 'CARD_EXPIRED',
      userMessage: 'Your card has expired. Please use a valid card.',
      debugMessage: stripeError.message,
      correlationId,
      phase,
      retryable: true,
      suggestedAction: 'Update your payment method',
      error: stripeError.message,
      message: stripeError.message
    };
  }
  
  // Incorrect CVC
  if (message.includes('cvc') || message.includes('security code')) {
    return {
      success: false,
      errorCode: 'INCORRECT_CVC',
      userMessage: 'The security code (CVC) was incorrect. Please check and try again.',
      debugMessage: stripeError.message,
      correlationId,
      phase,
      retryable: true,
      suggestedAction: 'Verify your card security code',
      error: stripeError.message,
      message: stripeError.message
    };
  }
  
  // Fallback
  return {
    success: false,
    errorCode: 'PAYMENT_PROCESSOR_ERROR',
    userMessage: 'We could not process your payment. Please try again or use a different card.',
    debugMessage: stripeError.message,
    correlationId,
    phase,
    retryable: true,
    suggestedAction: 'Try again or contact support',
    error: stripeError.message,
    message: stripeError.message
  };
}
```

### 1.4: Update Stripe Payment Method Error Handling (Line ~664-676)

**BEFORE (Current):**
```typescript
} catch (e: any) {
  throw new Error(`Stripe Payment Method Attach Failed: ${e.message}`);
}
```

**AFTER (Minimal wrapper):**
```typescript
} catch (e: any) {
  // ALWAYS log full technical details (unchanged)
  logError("Stripe payment method attach failed", {
    ...baseLogOptions,
    accountId: currentAccountId,
    error: e,
    context: { 
      phase,
      customerId: customer.id,
      paymentMethodId: data.paymentMethodId 
    }
  });
  
  // Return structured error if flag enabled, otherwise preserve legacy behavior
  if (ENABLE_STRUCTURED_TRIAL_ERRORS) {
    const errorResponse = mapStripeErrorToUserError(e, phase, correlationId);
    return new Response(JSON.stringify(errorResponse), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } else {
    // Legacy behavior - throw error as before
    throw new Error(`Stripe Payment Method Attach Failed: ${e.message}`);
  }
}
```

### 1.5: Update Stripe Subscription Error Handling (Line ~679-701)

**BEFORE (Current):**
```typescript
} catch (e: any) {
  throw new Error(`Stripe Subscription Create Failed: ${e.message}`);
}
```

**AFTER (Minimal wrapper):**
```typescript
} catch (e: any) {
  // ALWAYS log full technical details (unchanged)
  logError("Stripe subscription creation failed", {
    ...baseLogOptions,
    accountId: currentAccountId,
    error: e,
    context: { phase, customerId: customer.id }
  });
  
  // Return structured error if flag enabled, otherwise preserve legacy behavior
  if (ENABLE_STRUCTURED_TRIAL_ERRORS) {
    const errorResponse = mapStripeErrorToUserError(e, phase, correlationId);
    return new Response(JSON.stringify(errorResponse), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } else {
    // Legacy behavior - throw error as before
    throw new Error(`Stripe Subscription Create Failed: ${e.message}`);
  }
}
```

### 1.6: Update Global Error Handler (Bottom of function)

**BEFORE (Current):**
```typescript
} catch (error: any) {
  logError("Trial creation failed", {
    ...baseLogOptions,
    accountId: currentAccountId,
    context: { phase },
    error: error
  });

  // Cleanup and return error...
}
```

**AFTER (Add structured response option):**
```typescript
} catch (error: any) {
  // ALWAYS log full error (unchanged)
  logError("Trial creation failed", {
    ...baseLogOptions,
    accountId: currentAccountId,
    context: { phase },
    error: error
  });

  // Cleanup Stripe resources (unchanged)
  if (stripe && (stripeCustomerId || stripeSubscriptionId)) {
    await cleanupStripeResources(stripe, stripeCustomerId, stripeSubscriptionId, baseLogOptions);
  }

  // Return structured error if flag enabled
  if (ENABLE_STRUCTURED_TRIAL_ERRORS) {
    const errorResponse: TrialCreationErrorResponse = {
      success: false,
      errorCode: 'INTERNAL_ERROR',
      userMessage: 'We hit a snag while creating your trial. Please try again in a moment.',
      debugMessage: error.message,
      correlationId,
      phase,
      retryable: true,
      suggestedAction: 'Try again or contact support if the issue persists',
      error: error.message,
      message: error.message
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } else {
    // Legacy behavior - return existing error format
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        phase
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
}
```

### Summary of Backend Changes
- **Lines added:** ~150
- **Lines modified:** ~20 (only error catch blocks)
- **Lines removed:** 0
- **Core logic changed:** NONE
- **Reversibility:** Set `ENABLE_STRUCTURED_TRIAL_ERRORS=false`

---

## Phase 2: Frontend - Defensive Updates

### 2.1: Add Shared Error Utility

Create `src/lib/errors.ts`:

```typescript
/**
 * Error handling utilities for RingSnap
 * Defensive - handles both legacy and structured error formats
 */

export interface AppError {
  code: string;
  userMessage: string;
  debugMessage?: string;
  retryable: boolean;
  suggestedAction?: string;
}

/**
 * Extract user-friendly error from backend response
 * DEFENSIVE: Handles both old and new error formats
 */
export function extractUserError(error: any): AppError {
  // New structured error response
  if (error?.errorCode && error?.userMessage) {
    return {
      code: error.errorCode,
      userMessage: error.userMessage,
      debugMessage: error.debugMessage,
      retryable: error.retryable ?? false,
      suggestedAction: error.suggestedAction
    };
  }
  
  // Legacy error format (error.error or error.message)
  const errorMessage = error?.error || error?.message || 'An unexpected error occurred';
  
  // Try to make legacy errors more user-friendly
  if (errorMessage.toLowerCase().includes('card') && errorMessage.toLowerCase().includes('declined')) {
    return {
      code: 'CARD_DECLINED',
      userMessage: 'Your card was declined. Please try a different card.',
      debugMessage: errorMessage,
      retryable: true,
      suggestedAction: 'Try a different payment method'
    };
  }
  
  if (errorMessage.toLowerCase().includes('insufficient funds')) {
    return {
      code: 'INSUFFICIENT_FUNDS',
      userMessage: 'Your card was declined due to insufficient funds. Please try a different card.',
      debugMessage: errorMessage,
      retryable: true,
      suggestedAction: 'Try a different payment method'
    };
  }
  
  // Generic fallback
  return {
    code: 'UNKNOWN_ERROR',
    userMessage: 'We could not process your card. Please check the details and try again.',
    debugMessage: errorMessage,
    retryable: true,
    suggestedAction: 'Try again or contact support'
  };
}

/**
 * Log error details for debugging
 */
export function logClientError(context: string, error: any, metadata?: Record<string, any>) {
  console.error(`[${context}]`, {
    error,
    metadata,
    timestamp: new Date().toISOString()
  });
}
```

### 2.2: Update OnboardingChat.tsx (Line ~836-894)

**BEFORE (Current):**
```typescript
if (createTrialError || !result?.success) {
  throw new Error(
    result?.error || result?.message || createTrialError?.message || "Failed to create account"
  );
}
```

**AFTER (Defensive):**
```typescript
if (createTrialError || !result?.success) {
  // Use shared error utility (handles both old and new formats)
  const errorPayload = result || createTrialError;
  const appError = extractUserError(errorPayload);
  
  // Log technical details for debugging
  logClientError('Trial Creation', appError, {
    email: leadData.email,
    correlationId: errorPayload?.correlationId,
    phase: errorPayload?.phase
  });
  
  // Show user-friendly message
  if (appError.retryable) {
    setStep("payment");
    setIsProcessing(false);
    
    addMessage(
      "assistant",
      <div className="space-y-2 text-red-600">
        <p>{appError.userMessage}</p>
        {appError.suggestedAction && (
          <p className="text-sm text-muted-foreground">{appError.suggestedAction}</p>
        )}
      </div>
    );
    return;
  }
  
  // Non-retryable error - throw as before
  throw new Error(appError.userMessage);
}
```

### 2.3: Similar Updates for Other Signup Flows

Apply the same defensive pattern to:
- `src/components/onboarding/SelfServeTrialFlow.tsx`
- `src/components/onboarding/SalesGuidedTrialFlow.tsx`
- `src/components/onboarding/SalesGuidedTrialFlowEmbedded.tsx`
- `src/pages/AISignup.tsx`
- `src/components/SalesSignupForm.tsx`

**Pattern:**
```typescript
import { extractUserError, logClientError } from '@/lib/errors';

// In error handling:
const appError = extractUserError(result || error);
logClientError('Context', appError, { /* metadata */ });

if (appError.retryable) {
  // Show error, allow retry
} else {
  // Show error, redirect or block
}
```

---

## Phase 3: Testing Protocol

### 3.1: Regression Testing (Flag OFF)

**Environment:** `ENABLE_STRUCTURED_TRIAL_ERRORS=false` (or unset)

**Test 1: Success Path**
- Card: `4242424242424242`
- Expected: Trial created successfully
- Verify: Response matches baseline
- Verify: Account, Stripe subscription, Vapi provisioning all succeed

**Test 2: Declined Card**
- Card: `4000000000000002`
- Expected: Error response matches baseline
- Verify: No provisioning occurs
- Verify: Stripe resources cleaned up

**Result:** MUST match baseline exactly

### 3.2: Enhanced Testing (Flag ON)

**Environment:** `ENABLE_STRUCTURED_TRIAL_ERRORS=true`

**Test 1: Success Path**
- Card: `4242424242424242`
- Expected: Trial created successfully (same as baseline)
- Verify: Response has `success: true`
- Verify: All provisioning succeeds

**Test 2: Declined Card**
- Card: `4000000000000002`
- Expected: Structured error response
- Verify:
  ```json
  {
    "success": false,
    "errorCode": "CARD_DECLINED",
    "userMessage": "Your card was declined. Please try a different card.",
    "retryable": true,
    "suggestedAction": "Try a different payment method"
  }
  ```
- Verify: Frontend shows user-friendly message
- Verify: User can retry

**Test 3: Unsupported Card**
- Card: Test card that triggers "does not support" error
- Expected: Structured error with `CARD_NOT_SUPPORTED`
- Verify: User message is clear and actionable

**Test 4: Insufficient Funds**
- Card: `4000000000009995`
- Expected: Structured error with `INSUFFICIENT_FUNDS`

**Test 5: Expired Card**
- Card: `4000000000000069`
- Expected: Structured error with `CARD_EXPIRED`

### 3.3: Acceptance Criteria

✅ **With flag OFF:**
- Behavior identical to baseline
- No regressions
- All provisioning works

✅ **With flag ON:**
- Success path unchanged
- Error path returns structured errors
- Frontend shows user-friendly messages
- User can retry payment errors
- All technical details logged
- No stack traces in UI

---

## Phase 4: Deployment Strategy

### 4.1: Initial Deployment (Flag OFF)

1. Deploy backend changes with `ENABLE_STRUCTURED_TRIAL_ERRORS=false`
2. Deploy frontend changes (defensive, handles both formats)
3. Monitor for 24 hours
4. Verify no regressions

### 4.2: Enable Feature (Flag ON)

1. Set `ENABLE_STRUCTURED_TRIAL_ERRORS=true` in Supabase environment
2. Monitor signup success rate
3. Monitor error logs
4. Collect user feedback

### 4.3: Rollback (If Needed)

**Immediate rollback:**
```bash
# In Supabase dashboard or CLI
supabase secrets set ENABLE_STRUCTURED_TRIAL_ERRORS=false
```

**Full rollback:**
```bash
git revert <commit-hash>
# Redeploy
```

---

## Phase 5: Documentation

### 5.1: Create Baseline Document

`docs/ERROR_HANDLING_BASELINE.md` - Capture current behavior

### 5.2: Update Error Codes Reference

`docs/ERROR_CODES.md` - Already created

### 5.3: Create Rollback Guide

`docs/ERROR_HANDLING_ROLLBACK.md`:
```markdown
# Error Handling Rollback Guide

## Immediate Rollback (No Code Deploy)

Set environment variable:
```bash
ENABLE_STRUCTURED_TRIAL_ERRORS=false
```

This reverts to legacy error behavior immediately.

## Full Rollback (Code Revert)

```bash
git revert <commit-hash>
supabase functions deploy create-trial
# Deploy frontend via Vercel
```

## Monitoring After Rollback

- Watch signup success rate
- Check error logs
- Verify provisioning works
```

---

## Summary of Changes

### Backend (`create-trial/index.ts`)
- **Added:** Feature flag (1 line)
- **Added:** Type definitions (~30 lines)
- **Added:** Helper function (~100 lines)
- **Modified:** 3 catch blocks (~20 lines each)
- **Total:** ~200 lines added, ~60 lines modified, 0 removed
- **Risk:** LOW (all changes are additive and feature-flagged)

### Frontend
- **Added:** `src/lib/errors.ts` (~80 lines)
- **Modified:** 6 signup flow components (~20 lines each)
- **Total:** ~200 lines added/modified
- **Risk:** LOW (defensive, handles both formats)

### Total Effort
- Backend: 2-3 hours
- Frontend: 2-3 hours
- Testing: 3-4 hours
- Documentation: 1-2 hours
- **Total: 8-12 hours**

---

## Risk Mitigation Checklist

- ✅ Feature flag for easy rollback
- ✅ Baseline testing before changes
- ✅ No changes to core provisioning logic
- ✅ Backward compatible error responses
- ✅ Defensive frontend implementation
- ✅ Comprehensive test plan
- ✅ Clear rollback procedure
- ✅ Monitoring strategy

---

**Status:** Ready for implementation  
**Next Step:** Capture baseline behavior  
**Approval Required:** Yes (high-risk changes to critical flow)

