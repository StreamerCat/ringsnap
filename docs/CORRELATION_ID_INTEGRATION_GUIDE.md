# Correlation ID Integration Guide

**Date**: 2025-11-20
**Phase**: Phase 3 - Frontend Observability

---

## Overview

This guide shows how to integrate the correlation ID utility into RingSnap's signup flows for end-to-end request traceability.

The correlation ID utility (`src/lib/correlationId.ts`) provides:
- UUID generation for correlation IDs
- Session storage for multi-step flows
- Automatic header injection for API requests
- React hooks for component integration

---

## Quick Start

### 1. Import the Utility

```typescript
import {
  generateCorrelationId,
  withCorrelationId,
  startSignupFlow,
  endSignupFlow,
  logCorrelation,
} from '@/lib/correlationId';
```

### 2. Start a Signup Flow

At the beginning of your signup process (e.g., when user lands on signup page):

```typescript
useEffect(() => {
  const correlationId = startSignupFlow();
  console.log('Signup flow started with correlation ID:', correlationId);
}, []);
```

### 3. Add Correlation ID to API Requests

When making API calls to Supabase Edge Functions:

```typescript
const response = await fetch('/api/create-trial', {
  method: 'POST',
  headers: withCorrelationId({
    'Content-Type': 'application/json',
  }),
  body: JSON.stringify(signupData),
});
```

### 4. End Signup Flow

After successful signup (e.g., when redirecting to dashboard):

```typescript
endSignupFlow();
```

---

## Integration Examples

### Example 1: Free Trial Signup Form

**File**: `src/components/FreeTrialSignupForm.tsx`

```typescript
import { useState, useEffect } from 'react';
import {
  startSignupFlow,
  endSignupFlow,
  withCorrelationId,
  logCorrelation,
} from '@/lib/correlationId';

export function FreeTrialSignupForm() {
  const [correlationId, setCorrelationId] = useState<string>('');

  useEffect(() => {
    // Start signup flow and store correlation ID
    const id = startSignupFlow();
    setCorrelationId(id);
  }, []);

  const handleSubmit = async (formData) => {
    logCorrelation('submit_free_trial_form', correlationId);

    try {
      const response = await fetch('/api/create-trial', {
        method: 'POST',
        headers: withCorrelationId({
          'Content-Type': 'application/json',
        }, correlationId), // Use stored correlation ID
        body: JSON.stringify({
          ...formData,
          signup_channel: 'self_service',
        }),
      });

      const data = await response.json();

      if (data.success) {
        logCorrelation('signup_success', correlationId);
        endSignupFlow(); // Clear correlation ID
        router.push('/dashboard');
      } else {
        logCorrelation('signup_failed', correlationId);
        setError(data.error);
      }
    } catch (error) {
      logCorrelation('signup_error', correlationId);
      console.error('Signup failed:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  );
}
```

---

### Example 2: Sales Signup Wizard (Multi-Step)

**File**: `src/components/wizard/SalesSignupWizard.tsx`

```typescript
import { useState, useEffect } from 'react';
import { startSignupFlow, getCorrelationId, withCorrelationId } from '@/lib/correlationId';

export function SalesSignupWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [correlationId, setCorrelationId] = useState<string>('');

  useEffect(() => {
    // Start signup flow once when wizard mounts
    const id = startSignupFlow();
    setCorrelationId(id);
  }, []);

  const handleStepSubmit = async (stepData) => {
    // Use same correlation ID for all steps
    const response = await fetch('/api/save-step', {
      method: 'POST',
      headers: withCorrelationId({
        'Content-Type': 'application/json',
      }, correlationId),
      body: JSON.stringify({
        step: currentStep,
        data: stepData,
      }),
    });

    if (response.ok) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleFinalSubmit = async (finalData) => {
    const response = await fetch('/api/create-trial', {
      method: 'POST',
      headers: withCorrelationId({
        'Content-Type': 'application/json',
      }, correlationId), // Same correlation ID throughout entire flow
      body: JSON.stringify({
        ...finalData,
        signup_channel: 'sales_guided',
        sales_rep_id: currentUser.id,
      }),
    });

    // Handle response...
  };

  return (
    <div>
      {/* Multi-step wizard UI */}
    </div>
  );
}
```

---

### Example 3: React Context Provider

For app-wide correlation ID management:

**File**: `src/contexts/CorrelationIdContext.tsx`

```typescript
import { createContext, useContext, ReactNode } from 'react';
import { useCorrelationId, CorrelationIdContextValue } from '@/lib/correlationId';

const CorrelationIdContext = createContext<CorrelationIdContextValue | null>(null);

export function CorrelationIdProvider({ children }: { children: ReactNode }) {
  const [correlationId, refreshCorrelationId, clearCorrelationId] = useCorrelationId(true);

  return (
    <CorrelationIdContext.Provider
      value={{ correlationId, refreshCorrelationId, clearCorrelationId }}
    >
      {children}
    </CorrelationIdContext.Provider>
  );
}

export function useCorrelationIdContext() {
  const context = useContext(CorrelationIdContext);
  if (!context) {
    throw new Error('useCorrelationIdContext must be used within CorrelationIdProvider');
  }
  return context;
}
```

**Usage in app**:

```typescript
// src/App.tsx or src/main.tsx
import { CorrelationIdProvider } from '@/contexts/CorrelationIdContext';

function App() {
  return (
    <CorrelationIdProvider>
      <Router>
        {/* Your app routes */}
      </Router>
    </CorrelationIdProvider>
  );
}
```

**Usage in components**:

```typescript
import { useCorrelationIdContext } from '@/contexts/CorrelationIdContext';

function SignupButton() {
  const { correlationId } = useCorrelationIdContext();

  const handleClick = async () => {
    await fetch('/api/endpoint', {
      headers: withCorrelationId({}, correlationId),
    });
  };

  return <button onClick={handleClick}>Sign Up</button>;
}
```

---

### Example 4: Supabase Client Integration

For Supabase client requests:

```typescript
import { createClient } from '@supabase/supabase-js';
import { withCorrelationId, getCorrelationId } from '@/lib/correlationId';

// Create Supabase client with custom fetch that includes correlation ID
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    global: {
      fetch: (input, init) => {
        const correlationId = getCorrelationId(true);
        const headers = withCorrelationId(init?.headers, correlationId);

        return fetch(input, {
          ...init,
          headers,
        });
      },
    },
  }
);

export default supabase;
```

---

## API

### Core Functions

#### `generateCorrelationId(): string`
Generates a new UUID v4 correlation ID.

#### `getCorrelationId(persist?: boolean): string`
Gets or generates a correlation ID. If `persist` is true, stores it in session storage.

#### `storeCorrelationId(correlationId: string): void`
Stores correlation ID in session storage.

#### `getStoredCorrelationId(): string | null`
Retrieves correlation ID from session storage.

#### `clearCorrelationId(): void`
Clears correlation ID from session storage.

#### `withCorrelationId(headers?: HeadersInit, correlationId?: string): HeadersInit`
Adds correlation ID to headers object.

### Flow Helpers

#### `startSignupFlow(): string`
Clears previous correlation ID and generates a new one for signup flow.

#### `endSignupFlow(): void`
Clears correlation ID after signup completion.

### Debugging

#### `logCorrelation(action: string, correlationId?: string): void`
Logs correlation ID with action for debugging.

---

## Best Practices

### 1. **One ID Per Flow**
Generate one correlation ID at the start of a user flow (signup, checkout, etc.) and reuse it for all requests in that flow.

```typescript
// ✅ Good
const correlationId = startSignupFlow();
await step1(correlationId);
await step2(correlationId);
await step3(correlationId);

// ❌ Bad
await step1(generateCorrelationId()); // Different ID
await step2(generateCorrelationId()); // Different ID
await step3(generateCorrelationId()); // Different ID
```

### 2. **Clear After Completion**
Always clear correlation ID after flow completion to avoid mixing with new flows.

```typescript
try {
  const result = await completeSignup();
  if (result.success) {
    endSignupFlow(); // Clear ID
    router.push('/dashboard');
  }
} catch (error) {
  // Keep ID for debugging failed flows
  console.error('Flow failed with correlation ID:', getCorrelationId());
}
```

### 3. **Log Key Events**
Use `logCorrelation()` to log important events in the flow.

```typescript
logCorrelation('form_validation_passed');
logCorrelation('payment_method_attached');
logCorrelation('account_created');
logCorrelation('email_sent');
```

### 4. **Persist for Multi-Step Flows**
Use `getCorrelationId(true)` to persist correlation ID across page navigations in multi-step flows.

```typescript
// Step 1 page
const correlationId = getCorrelationId(true); // Persists in sessionStorage

// Step 2 page (after navigation)
const correlationId = getCorrelationId(true); // Returns same ID
```

---

## Testing

### Manual Testing

1. Open browser DevTools → Network tab
2. Start a signup flow
3. Check request headers for `x-correlation-id`
4. Verify same ID is used across multiple requests
5. Check backend logs for matching correlation IDs

### Console Debugging

```typescript
// Enable verbose logging
import { logCorrelation } from '@/lib/correlationId';

// Log at each step
logCorrelation('step_1_started');
logCorrelation('step_1_api_call');
logCorrelation('step_1_completed');
```

---

## Troubleshooting

### Issue: Correlation ID Not Appearing in Headers

**Cause**: Headers not being passed correctly.

**Solution**: Ensure `withCorrelationId()` is called:

```typescript
// ✅ Correct
headers: withCorrelationId({ 'Content-Type': 'application/json' })

// ❌ Missing
headers: { 'Content-Type': 'application/json' }
```

### Issue: Different IDs Across Requests

**Cause**: Generating new ID for each request instead of reusing.

**Solution**: Store correlation ID in component state:

```typescript
const [correlationId] = useState(() => startSignupFlow());

// Use same correlationId for all requests
```

### Issue: Correlation ID Persists Across Sessions

**Cause**: Not clearing after flow completion.

**Solution**: Call `endSignupFlow()` or `clearCorrelationId()`:

```typescript
if (signupSuccess) {
  endSignupFlow(); // Clears sessionStorage
  router.push('/dashboard');
}
```

---

## Backend Integration

The correlation ID is automatically extracted by backend functions using `extractCorrelationId(req)` from `_shared/logging.ts`.

No changes needed on backend - it's already integrated in Phase 2.

---

## Next Steps

1. ✅ Integrate correlation ID in `FreeTrialSignupForm.tsx`
2. ✅ Integrate correlation ID in `SalesSignupWizard.tsx`
3. ✅ Create `CorrelationIdProvider` context
4. ✅ Test end-to-end correlation across signup flow
5. ✅ Monitor Supabase logs for correlation ID traces

---

**Status**: ✅ Complete
**Phase**: Phase 3 - Frontend Observability
**Related**: `src/lib/correlationId.ts`, Phase 2 backend logging
