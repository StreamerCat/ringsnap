# Error Handling + UX Hardening Specification

**Created:** 2025-12-11  
**Status:** Planning  
**Risk Level:** 🔴 High (touches critical signup flow)  
**Assigned Agents:**
- @planner-agent (coordination)
- @signup-flow-agent (create-trial modifications)
- @api-agent (error contract implementation)
- @frontend-experience-agent (UI error handling)
- @data-contract-agent (error response schemas)
- @flow-observability-agent (logging improvements)
- @test-agent (validation)

---

## Problem Statement

### Current State
Users encountering payment errors during trial signup see generic "technical error" messages that:
- Don't explain what went wrong
- Don't provide clear next steps
- Expose raw Stripe error messages or stack traces
- Leave users confused and unable to complete signup

### Example Error Log
```json
{
  "phase": "stripe_payment_method",
  "error": {
    "message": "Stripe Payment Method Attach Failed: Your card does not support this type of purchase.",
    "name": "Error",
    "stack": "Error: Stripe Payment Method Attach Failed..."
  }
}
```

### Current Frontend Behavior
```typescript
// OnboardingChat.tsx line 836-840
if (createTrialError || !result?.success) {
  throw new Error(
    result?.error || result?.message || createTrialError?.message || "Failed to create account"
  );
}
```

This throws raw error messages to users, resulting in confusing UX.

---

## Solution Design

### Part 1: Structured Error Contract

#### Error Response Schema
```typescript
interface TrialCreationErrorResponse {
  success: false;
  errorCode: ErrorCode;
  userMessage: string;
  debugMessage?: string;  // Technical details, never shown to user
  correlationId: string;
  phase?: string;  // Where the error occurred
  retryable: boolean;  // Can user retry?
  suggestedAction?: string;  // What should user do?
}

type ErrorCode =
  // Payment errors
  | 'CARD_DECLINED'
  | 'CARD_NOT_SUPPORTED'
  | 'CARD_EXPIRED'
  | 'INSUFFICIENT_FUNDS'
  | 'INCORRECT_CVC'
  | 'PAYMENT_AUTH_REQUIRED'
  | 'PAYMENT_PROCESSOR_ERROR'
  // Account errors
  | 'ACCOUNT_EXISTS'
  | 'INVALID_EMAIL'
  | 'INVALID_PHONE'
  | 'RATE_LIMIT_EXCEEDED'
  // System errors
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'VALIDATION_ERROR';
```

#### Success Response Schema (for reference)
```typescript
interface TrialCreationSuccessResponse {
  success: true;
  email: string;
  password: string;
  accountId: string;
  userId: string;
}
```

### Part 2: Stripe Error Mapping

Create a mapping function in `create-trial` edge function:

```typescript
function mapStripeErrorToUserError(stripeError: any, phase: string): TrialCreationErrorResponse {
  const message = stripeError.message?.toLowerCase() || '';
  
  // Card not supported
  if (message.includes('does not support this type of purchase')) {
    return {
      success: false,
      errorCode: 'CARD_NOT_SUPPORTED',
      userMessage: 'This card was declined by your bank. Please try a different card or contact your bank.',
      debugMessage: stripeError.message,
      correlationId: getCurrentCorrelationId(),
      phase,
      retryable: true,
      suggestedAction: 'Try a different payment method'
    };
  }
  
  // Generic card declined
  if (message.includes('card_declined') || message.includes('declined')) {
    return {
      success: false,
      errorCode: 'CARD_DECLINED',
      userMessage: 'Your card was declined. Please try a different card.',
      debugMessage: stripeError.message,
      correlationId: getCurrentCorrelationId(),
      phase,
      retryable: true,
      suggestedAction: 'Try a different payment method'
    };
  }
  
  // Insufficient funds
  if (message.includes('insufficient') || message.includes('funds')) {
    return {
      success: false,
      errorCode: 'INSUFFICIENT_FUNDS',
      userMessage: 'Your card was declined due to insufficient funds. Please try a different card.',
      debugMessage: stripeError.message,
      correlationId: getCurrentCorrelationId(),
      phase,
      retryable: true,
      suggestedAction: 'Try a different payment method'
    };
  }
  
  // Expired card
  if (message.includes('expired')) {
    return {
      success: false,
      errorCode: 'CARD_EXPIRED',
      userMessage: 'Your card has expired. Please use a valid card.',
      debugMessage: stripeError.message,
      correlationId: getCurrentCorrelationId(),
      phase,
      retryable: true,
      suggestedAction: 'Update your payment method'
    };
  }
  
  // Incorrect CVC
  if (message.includes('cvc') || message.includes('security code')) {
    return {
      success: false,
      errorCode: 'INCORRECT_CVC',
      userMessage: 'The security code (CVC) was incorrect. Please check and try again.',
      debugMessage: stripeError.message,
      correlationId: getCurrentCorrelationId(),
      phase,
      retryable: true,
      suggestedAction: 'Verify your card security code'
    };
  }
  
  // Authentication required
  if (message.includes('authentication') || message.includes('3d secure')) {
    return {
      success: false,
      errorCode: 'PAYMENT_AUTH_REQUIRED',
      userMessage: 'Your card requires additional verification. Please try a different card.',
      debugMessage: stripeError.message,
      correlationId: getCurrentCorrelationId(),
      phase,
      retryable: true,
      suggestedAction: 'Try a different payment method'
    };
  }
  
  // Fallback for payment errors
  return {
    success: false,
    errorCode: 'PAYMENT_PROCESSOR_ERROR',
    userMessage: 'We could not process your payment. Please try again or use a different card.',
    debugMessage: stripeError.message,
    correlationId: getCurrentCorrelationId(),
    phase,
    retryable: true,
    suggestedAction: 'Try again or contact support'
  };
}
```

### Part 3: Edge Function Updates

#### Changes to `create-trial/index.ts`

1. **Import and setup** (top of file):
```typescript
// Add error response types
type ErrorCode = 'CARD_DECLINED' | 'CARD_NOT_SUPPORTED' | /* ... */;

interface TrialCreationErrorResponse {
  success: false;
  errorCode: ErrorCode;
  userMessage: string;
  debugMessage?: string;
  correlationId: string;
  phase?: string;
  retryable: boolean;
  suggestedAction?: string;
}
```

2. **Update Stripe payment method phase** (around line 664-676):
```typescript
// Payment Method
phase = "stripe_payment_method";
try {
  await stripe.paymentMethods.attach(data.paymentMethodId, { customer: customer.id });
  await stripe.customers.update(customer.id, {
    invoice_settings: { default_payment_method: data.paymentMethodId }
  });
  logInfo("Payment method attached", {
    ...baseLogOptions,
    context: { customerId: customer.id },
  });
} catch (e: any) {
  // Log full technical details
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
  
  // Return user-friendly error
  const errorResponse = mapStripeErrorToUserError(e, phase);
  return new Response(JSON.stringify(errorResponse), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
```

3. **Update Stripe subscription phase** (around line 679-701):
```typescript
// Subscription
phase = "stripe_subscription";
try {
  const priceId = getStripePriceId(data.planType);
  subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: priceId }],
    trial_period_days: 3,
    payment_behavior: "default_incomplete",
    metadata: { source: data.source, plan_type: data.planType }
  }, { idempotencyKey: `${stripeIdempotencyPrefix}-subscription` });
  stripeSubscriptionId = subscription.id;
  logInfo("Stripe subscription created", {
    ...baseLogOptions,
    context: {
      subscriptionId: subscription.id,
      planType: data.planType,
      source: data.source,
      status: subscription.status,
    },
  });
} catch (e: any) {
  // Log full technical details
  logError("Stripe subscription creation failed", {
    ...baseLogOptions,
    accountId: currentAccountId,
    error: e,
    context: { phase, customerId: customer.id }
  });
  
  // Return user-friendly error
  const errorResponse = mapStripeErrorToUserError(e, phase);
  return new Response(JSON.stringify(errorResponse), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
```

4. **Update global error handler** (bottom of function, around line 1200+):
```typescript
} catch (error: any) {
  // Log full error with stack trace
  logError("Trial creation failed", {
    ...baseLogOptions,
    accountId: currentAccountId,
    context: { phase },
    error: error
  });

  // Cleanup Stripe resources if created
  if (stripe && (stripeCustomerId || stripeSubscriptionId)) {
    await cleanupStripeResources(stripe, stripeCustomerId, stripeSubscriptionId, baseLogOptions);
  }

  // Return user-friendly error
  const errorResponse: TrialCreationErrorResponse = {
    success: false,
    errorCode: 'INTERNAL_ERROR',
    userMessage: 'We hit a snag while creating your trial. Please try again in a moment.',
    debugMessage: error.message,
    correlationId,
    phase,
    retryable: true,
    suggestedAction: 'Try again or contact support if the issue persists'
  };

  return new Response(JSON.stringify(errorResponse), {
    status: 500,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
```

### Part 4: Frontend Updates

#### Changes to `OnboardingChat.tsx`

1. **Update error handling in handlePayment** (around line 836-894):
```typescript
if (createTrialError || !result?.success) {
  // Handle structured error response
  if (result && !result.success) {
    const errorResponse = result as TrialCreationErrorResponse;
    
    // Log technical details for debugging
    console.error('Trial creation failed:', {
      errorCode: errorResponse.errorCode,
      phase: errorResponse.phase,
      correlationId: errorResponse.correlationId,
      debugMessage: errorResponse.debugMessage
    });
    
    // Show user-friendly message
    let friendlyMessage = errorResponse.userMessage;
    let actionMessage = errorResponse.suggestedAction 
      ? `\n\n${errorResponse.suggestedAction}` 
      : '';
    
    // Stay on payment step for retryable errors
    if (errorResponse.retryable) {
      setStep("payment");
      setIsProcessing(false);
      
      addMessage(
        "assistant",
        <div className="space-y-2 text-red-600">
          <p>{friendlyMessage}</p>
          {actionMessage && (
            <p className="text-sm text-muted-foreground">{actionMessage}</p>
          )}
        </div>
      );
      return;
    }
  }
  
  // Fallback for unexpected errors
  throw new Error(
    result?.userMessage || 
    result?.error || 
    createTrialError?.message || 
    "Failed to create account"
  );
}
```

2. **Add type definitions** (top of file):
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
}
```

#### Similar updates needed for:
- `src/components/onboarding/SelfServeTrialFlow.tsx`
- `src/components/onboarding/SalesGuidedTrialFlow.tsx`
- `src/components/onboarding/SalesGuidedTrialFlowEmbedded.tsx`
- `src/pages/AISignup.tsx`
- `src/components/SalesSignupForm.tsx`

### Part 5: Shared Error Utility

Create `src/lib/errors.ts`:

```typescript
/**
 * Error handling utilities for RingSnap
 * Provides consistent error messaging and logging across the app
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
 */
export function extractUserError(error: any): AppError {
  // Structured error response from backend
  if (error?.errorCode && error?.userMessage) {
    return {
      code: error.errorCode,
      userMessage: error.userMessage,
      debugMessage: error.debugMessage,
      retryable: error.retryable ?? false,
      suggestedAction: error.suggestedAction
    };
  }
  
  // Supabase function error
  if (error?.message) {
    return {
      code: 'UNKNOWN_ERROR',
      userMessage: 'Something went wrong. Please try again.',
      debugMessage: error.message,
      retryable: true,
      suggestedAction: 'Try again or contact support'
    };
  }
  
  // Fallback
  return {
    code: 'UNKNOWN_ERROR',
    userMessage: 'An unexpected error occurred. Please try again.',
    retryable: true,
    suggestedAction: 'Try again or contact support'
  };
}

/**
 * Log error details for debugging (client-side)
 */
export function logClientError(context: string, error: any, metadata?: Record<string, any>) {
  console.error(`[${context}]`, {
    error,
    metadata,
    timestamp: new Date().toISOString()
  });
}

/**
 * Default error messages by category
 */
export const ERROR_MESSAGES = {
  PAYMENT: {
    GENERIC: 'We could not process your payment. Please try again or use a different card.',
    CARD_DECLINED: 'Your card was declined. Please try a different card.',
    NETWORK: 'We could not reach the payment processor. Please try again in a moment.'
  },
  ACCOUNT: {
    GENERIC: 'We could not create your account. Please try again.',
    EXISTS: 'An account with this email already exists. Please log in instead.'
  },
  SYSTEM: {
    GENERIC: 'Something went wrong. Please try again.',
    UNAVAILABLE: 'Our service is temporarily unavailable. Please try again in a few minutes.'
  }
} as const;
```

### Part 6: App-Wide Error Audit

#### Files to audit for generic error messages:
```bash
# Search for generic error patterns
grep -r "technical error" src/
grep -r "unknown error" src/
grep -r "something went wrong" src/
grep -r "error.message" src/
grep -r "JSON.stringify(error)" src/
```

#### Key areas to review:
1. **Authentication flows** (`src/pages/Login.tsx`, `src/pages/Signup.tsx`)
2. **Dashboard actions** (`src/components/dashboard/*`)
3. **Phone provisioning** (`src/components/dashboard/PhoneNumbersTab.tsx`)
4. **Settings updates** (`src/components/dashboard/SettingsTab.tsx`)
5. **Billing operations** (`src/components/dashboard/BillingTab.tsx`)

---

## Implementation Plan

### Phase 1: Create-Trial Error Handling (Priority 1)
**Agent:** @signup-flow-agent, @api-agent

1. Add error type definitions to `create-trial/index.ts`
2. Implement `mapStripeErrorToUserError()` function
3. Update Stripe payment method error handling
4. Update Stripe subscription error handling  
5. Update global error handler
6. Ensure all errors log full details server-side
7. Test with various Stripe test cards

**Acceptance Criteria:**
- ✅ Declined card shows: "Your card was declined. Please try a different card."
- ✅ Unsupported card shows: "This card was declined by your bank..."
- ✅ User stays on payment step with error message
- ✅ Supabase logs contain full error details + correlationId
- ✅ No raw Stripe errors exposed to frontend

### Phase 2: Frontend Error Handling (Priority 1)
**Agent:** @frontend-experience-agent

1. Create `src/lib/errors.ts` utility
2. Add error types to `OnboardingChat.tsx`
3. Update error handling in `handlePayment()`
4. Update `SelfServeTrialFlow.tsx`
5. Update `SalesGuidedTrialFlow.tsx`
6. Update `SalesGuidedTrialFlowEmbedded.tsx`
7. Update `AISignup.tsx`
8. Update `SalesSignupForm.tsx`

**Acceptance Criteria:**
- ✅ All signup flows use structured error responses
- ✅ User sees friendly message + suggested action
- ✅ User stays on payment step for retryable errors
- ✅ Console logs contain technical details for debugging
- ✅ No stack traces or raw errors in UI

### Phase 3: App-Wide Error Audit (Priority 2)
**Agent:** @frontend-experience-agent

1. Audit all components for generic error messages
2. Create list of files needing updates
3. Prioritize by user impact (signup > dashboard > settings)
4. Update high-priority flows first

**Acceptance Criteria:**
- ✅ Catalog of all error messages created
- ✅ Priority list established
- ✅ High-impact flows updated

### Phase 4: Testing & Validation (Priority 1)
**Agent:** @test-agent

1. Test with Stripe test cards:
   - `4000000000000002` (declined)
   - `4000000000009995` (insufficient funds)
   - `4000000000000069` (expired)
   - `4000000000000127` (incorrect CVC)
2. Verify error messages are user-friendly
3. Verify logs contain technical details
4. Test retry flow
5. Test non-payment errors (rate limit, account exists)

**Acceptance Criteria:**
- ✅ All test cards produce appropriate user messages
- ✅ Users can retry after fixing card issues
- ✅ Logs are detailed and queryable
- ✅ No technical details leak to UI

### Phase 5: Documentation (Priority 3)
**Agent:** @docs-agent

1. Create `docs/ERROR_HANDLING.md`
2. Document error contract
3. Document error codes
4. Document frontend patterns
5. Add examples

---

## Risk Assessment

### High Risk Areas
1. **Signup flow changes** - Could break trial creation
2. **Error response format** - Frontend must handle both old and new formats during transition
3. **Stripe cleanup** - Ensure resources are cleaned up on error

### Mitigation Strategies
1. **Incremental rollout** - Deploy backend first, then frontend
2. **Backward compatibility** - Frontend handles both error formats
3. **Extensive testing** - Use Stripe test cards for all scenarios
4. **Monitoring** - Watch error logs after deployment
5. **Rollback plan** - Keep previous version ready

### Testing Strategy
1. **Unit tests** - Test error mapping functions
2. **Integration tests** - Test full signup flow with errors
3. **Manual testing** - Test with real Stripe test cards
4. **Staging deployment** - Test in staging before production

---

## Rollback Plan

If issues arise:

1. **Backend rollback:**
   ```bash
   # Revert create-trial function
   git revert <commit-hash>
   supabase functions deploy create-trial
   ```

2. **Frontend rollback:**
   ```bash
   # Revert frontend changes
   git revert <commit-hash>
   npm run build
   # Deploy via Vercel
   ```

3. **Monitoring:**
   - Watch Supabase edge function logs
   - Monitor signup success rate
   - Check for increased error rates

---

## Success Metrics

### User Experience
- ✅ Users see clear, actionable error messages
- ✅ Users can retry after fixing issues
- ✅ No technical jargon or stack traces in UI
- ✅ Signup completion rate improves

### Developer Experience
- ✅ Errors are easy to debug from logs
- ✅ Correlation IDs link frontend to backend
- ✅ Error patterns are consistent across app
- ✅ New developers can follow error handling patterns

### Technical
- ✅ All errors have structured logging
- ✅ Error codes are stable and documented
- ✅ Retryable vs non-retryable errors are clear
- ✅ No data leakage in error messages

---

## Next Steps

1. **Get approval** for high-risk changes to signup flow
2. **Assign agents** to each phase
3. **Create feature branch** `feature/error-handling-ux`
4. **Implement Phase 1** (create-trial backend)
5. **Test thoroughly** with Stripe test cards
6. **Deploy to staging**
7. **Implement Phase 2** (frontend)
8. **Final testing**
9. **Deploy to production**
10. **Monitor and iterate**

---

**Maintained By:** RingSnap Engineering Team  
**Last Updated:** 2025-12-11  
**Status:** Awaiting Approval
