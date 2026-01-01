# RingSnap LLM-Native Logging

## Overview

RingSnap uses **structured, single-line JSON logs** designed for LLM consumption and debugging. Every log event includes trace IDs for end-to-end correlation from the web app through Edge Functions.

## Core Principles

1. **Single-line JSON**: All logs must be valid single-line JSON (no multi-line logs)
2. **Trace Propagation**: Every request carries a `trace_id` from frontend to backend
3. **Step-level Instrumentation**: Critical flows log discrete steps with start/end/duration
4. **Safe by Default**: Automatically redact secrets, mask PII (email/phone)
5. **LLM-Friendly**: Logs optimized for Claude to debug issues efficiently

## Log Event Schema

### Standard Fields

Every log event MUST include:

```typescript
{
  "timestamp": "2026-01-01T12:34:56.789Z",  // ISO 8601 UTC timestamp
  "level": "info",                           // debug | info | warn | error
  "event_type": "step_start",                // step_start | step_end | info | error
  "trace_id": "uuid-v4",                     // End-to-end correlation ID
  "function_name": "create-trial",           // Edge Function or component name
  "step": "validate_input",                  // Step identifier (snake_case)
  "message": "Validating trial input",       // Human-readable description
  "account_id": "uuid",                      // Optional: account context
  "user_id": "uuid"                          // Optional: user context
}
```

### Step Start Event

```typescript
{
  "event_type": "step_start",
  "step": "create_stripe_customer",
  "message": "Creating Stripe customer",
  "context": {
    "email": "us***@example.com",           // Masked email
    "idempotency_key": "idem_abc123"
  }
}
```

### Step End Event

```typescript
{
  "event_type": "step_end",
  "step": "create_stripe_customer",
  "message": "Stripe customer created",
  "duration_ms": 1234,                      // Step duration
  "result": "success",                       // success | failure | partial
  "context": {
    "stripe_customer_id": "cus_xxx",
    "created": true
  }
}
```

### Error Event

```typescript
{
  "event_type": "error",
  "step": "attach_payment_method",
  "message": "Payment method attachment failed",
  "error": {
    "name": "StripeCardError",
    "message": "Your card was declined",
    "code": "card_declined",
    "decline_code": "insufficient_funds"
  },
  "context": {
    "payment_method_id": "pm_xxx",
    "reason_code": "CARD_DECLINED_INSUFFICIENT_FUNDS"
  }
}
```

## Step Naming Conventions

### Format

Use **snake_case** for all step names:
- `validate_input`
- `create_stripe_customer`
- `provision_phone_number`
- `check_pool_eligibility`

### Naming Pattern

`<verb>_<noun>` or `<verb>_<noun>_<qualifier>`

Examples:
- ✅ `validate_phone_format`
- ✅ `create_user_account`
- ✅ `query_available_numbers`
- ✅ `send_welcome_email`
- ❌ `validation` (too vague)
- ❌ `checkPhoneFormat` (camelCase)
- ❌ `phone-validation` (kebab-case)

## Redaction and Masking Rules

### Automatic Redaction

The logger automatically redacts these fields:

```typescript
const REDACTED_KEYS = [
  'password',
  'token',
  'secret',
  'api_key',
  'apiKey',
  'apikey',
  'bearer',
  'authorization',
  'stripe_secret_key',
  'twilio_auth_token',
  'vapi_api_key',
  'supabase_service_key'
];
```

**Example:**
```typescript
// Input
{ stripe_secret_key: "sk_live_abc123" }

// Output
{ stripe_secret_key: "[REDACTED]" }
```

### Email Masking (`maskEmailForLogs`)

⚠️ **FOR LOGS ONLY** - Do NOT use in database writes, API payloads, or operational code.

Emails are masked to show first 2 characters and domain:

```typescript
maskEmailForLogs("user@example.com")  // => "us***@example.com"
maskEmailForLogs("a@test.co")          // => "a***@test.co"
```

### Phone Masking (`maskPhoneForLogs`)

⚠️ **FOR LOGS ONLY** - Do NOT use in database writes, API payloads, or operational code.

Phone numbers are masked to show **ONLY last 4 digits**:

```typescript
maskPhoneForLogs("+14155551234")       // => "***1234"
maskPhoneForLogs("415-555-1234")       // => "***1234"
maskPhoneForLogs("123")                // => "***"
maskPhoneForLogs(null)                 // => null
```

### Manual Redaction

For custom redaction:

```typescript
import { redact } from '../_shared/logging.ts';

const safeData = redact({
  customer_email: customerEmail,
  phone: customerPhone,
  internal_note: "sensitive info"
});
// Automatically masks email/phone, redacts blacklisted keys
```

### ⚠️ CRITICAL: When to Use Masked vs Raw Values

**Use MASKED values (`maskEmailForLogs`, `maskPhoneForLogs`):**
- ✅ In `stepStart()`, `stepEnd()`, `stepError()` context objects
- ✅ In frontend `logFrontendStep()` context
- ✅ In debug bundles and error reports
- ✅ Anywhere the value will appear in logs

**Use RAW (unmasked) values:**
- ✅ Database writes (`.insert()`, `.update()`)
- ✅ Stripe API calls (`stripe.customers.create()`, payment methods)
- ✅ Twilio SMS payloads (`To`, `From`, `Body`)
- ✅ Vapi API calls (phone number provisioning, assistant creation)
- ✅ Any external service integration
- ✅ Return values sent to the client/frontend

**Example - Correct Usage:**
```typescript
// ✅ CORRECT: Raw value to Stripe, masked value in logs
const customer = await stripe.customers.create({
  email: data.email,  // Raw email for Stripe
  phone: data.phone   // Raw phone for Stripe
});

stepEnd('create_stripe_customer', base, {
  email: maskEmailForLogs(data.email),  // Masked for logs
  customer_id: customer.id
}, startTime);
```

**Example - WRONG Usage:**
```typescript
// ❌ WRONG: Masked value to database
await supabase.from('accounts').insert({
  email: maskEmailForLogs(data.email),  // This breaks the account!
  phone: maskPhoneForLogs(data.phone)   // This breaks SMS/calling!
});
```

## Trace ID Propagation

### Frontend (Web App)

1. **Generate trace_id** at flow entry:
```typescript
import { generateCorrelationId } from '@/lib/correlationId';

const traceId = generateCorrelationId();
```

2. **Attach to all API/Edge Function requests**:
```typescript
const headers = {
  'x-rs-trace-id': traceId,
  'Content-Type': 'application/json'
};
```

3. **Store in error boundary context** for debug bundles.

### Edge Functions (Backend)

1. **Extract trace_id from header**:
```typescript
import { extractTraceId } from '../_shared/logging.ts';

const traceId = extractTraceId(req); // Falls back to generated UUID if missing
```

2. **Include in all log events**:
```typescript
import { stepStart, stepEnd } from '../_shared/logging.ts';

const base = { functionName: 'create-trial', traceId, accountId };

stepStart('validate_input', base, { email: maskEmailForLogs(email) });
// ... validation logic ...
stepEnd('validate_input', base, { valid: true }, startTime);
```

3. **Return trace_id in responses**:
```typescript
return new Response(JSON.stringify({
  success: true,
  trace_id: traceId,
  // ... other fields
}), {
  headers: { 'Content-Type': 'application/json' }
});
```

4. **Include trace_id in error responses**:
```typescript
return new Response(JSON.stringify({
  error: true,
  message: "Trial creation failed",
  trace_id: traceId,
  reason_code: "STRIPE_PAYMENT_FAILED"
}), {
  status: 400,
  headers: { 'Content-Type': 'application/json' }
});
```

## Critical Flow Instrumentation

### Phase 1 Instrumented Flows

#### 1. Trial Creation (`create-trial`)

**Steps:**
- `validate_input` - Zod schema validation
- `check_idempotency` - Duplicate request check
- `create_stripe_customer` - Stripe customer creation
- `attach_payment_method` - Payment method attachment
- `create_subscription` - Stripe subscription creation
- `create_account_atomic` - DB transaction for user + account + profile
- `link_lead` - Associate with lead if provided
- `enqueue_provisioning` - Queue async provisioning job
- `prepare_response` - Format final response

**Reason Codes:**
- `VALIDATION_FAILED` - Input validation error
- `IDEMPOTENCY_DUPLICATE` - Duplicate request detected
- `STRIPE_CUSTOMER_FAILED` - Stripe customer creation failed
- `STRIPE_PAYMENT_FAILED` - Payment method or subscription failed
- `DB_ACCOUNT_FAILED` - Database account creation failed
- `PROVISIONING_ENQUEUE_FAILED` - Failed to start provisioning

#### 2. Phone Provisioning (`provision-phone-number`)

**Steps:**
- `validate_provisioning_input` - Input validation
- `check_pool_eligibility` - Determine if pool number available
- `select_from_pool` - Select pooled number (if eligible)
- `purchase_new_number` - Purchase from Twilio/Vapi (if not pooled)
- `attach_to_vapi` - Link phone to Vapi assistant
- `update_account_phone` - Update account record
- `mark_pool_number_used` - Mark pool number as assigned (if pooled)
- `generate_referral_code` - Create referral code
- `send_welcome_email` - Send onboarding email
- `update_status_ready` - Mark phone_number_status='ready'

**Reason Codes:**
- `POOL_NUMBER_SELECTED` - Used pool number
- `POOL_COOLDOWN_ACTIVE` - Pool number in cooldown period
- `POOL_EXHAUSTED` - No pool numbers available
- `TWILIO_PURCHASE_FAILED` - Twilio number purchase failed
- `VAPI_ATTACH_FAILED` - Failed to link to Vapi assistant

**Context:**
- `pool_action`: `"from_pool"` | `"purchased_new"` | `"pool_unavailable"`
- `phone_masked`: `"***1234"` (last 4 digits)
- `area_code`: `"415"`

#### 3. Appointment Booking (`booking-schedule`)

**Steps:**
- `validate_booking_input` - Input validation
- `load_account_preferences` - Load booking settings
- `parse_timezone` - Determine timezone
- `check_availability` - Query available slots (Phase 2)
- `detect_conflicts` - Check for scheduling conflicts (Phase 2)
- `create_appointment_record` - Insert appointment
- `send_sms_notification` - Send SMS to account owner (Phase 1)
- `enqueue_calendar_sync` - Queue calendar integration (Phase 2)

**Reason Codes:**
- `VALIDATION_FAILED` - Invalid input
- `NO_AVAILABILITY` - No slots available (Phase 2)
- `CONFLICT_DETECTED` - Scheduling conflict (Phase 2)
- `SMS_SEND_FAILED` - Failed to send SMS notification

**Context:**
- `timezone`: `"America/Los_Angeles"`
- `conflict_reason`: `"OVERLAPPING_APPOINTMENT"` | `"OUTSIDE_BUSINESS_HOURS"`
- `notification_method`: `"sms"` | `"calendar"` (Phase 2)

## Debug Bundle (Frontend)

When errors occur, users can copy a **Debug Bundle** to share with support or paste to Claude for debugging.

### Debug Bundle Format

```json
{
  "trace_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-01-01T12:34:56.789Z",
  "route": "/trial/signup",
  "action": "create_trial",
  "error": {
    "message": "Payment method attachment failed",
    "code": "card_declined",
    "reason_code": "STRIPE_PAYMENT_FAILED"
  },
  "user_agent": "Mozilla/5.0...",
  "recent_steps": [
    {
      "step": "validate_input",
      "timestamp": "2026-01-01T12:34:50.123Z",
      "duration_ms": 45,
      "result": "success"
    },
    {
      "step": "create_stripe_customer",
      "timestamp": "2026-01-01T12:34:51.456Z",
      "duration_ms": 1234,
      "result": "success"
    },
    {
      "step": "attach_payment_method",
      "timestamp": "2026-01-01T12:34:56.789Z",
      "result": "failure",
      "error": "card_declined"
    }
  ]
}
```

### Copying Debug Bundle

The frontend error UI includes a **"Copy Debug Bundle"** button that:
1. Collects trace_id, route, timestamp, error details
2. Fetches last 30 step logs from session storage (if available)
3. Sanitizes all PII (masks email/phone)
4. Formats as JSON
5. Copies to clipboard

**User instruction:**
> "An error occurred. Please copy the debug bundle below and share it with support or paste it to Claude for analysis."

## Usage Examples

### Example 1: Edge Function Step Logging

```typescript
import { stepStart, stepEnd, stepError, extractTraceId, maskEmail } from '../_shared/logging.ts';

export default async function handler(req: Request) {
  const traceId = extractTraceId(req);
  const base = { functionName: 'create-trial', traceId };

  // Parse input
  const body = await req.json();
  const email = body.email;

  // Step 1: Validate
  const validateStart = Date.now();
  stepStart('validate_input', base, { email: maskEmailForLogs(email) });

  try {
    const validated = schema.parse(body);
    stepEnd('validate_input', base, { valid: true }, validateStart);
  } catch (err) {
    stepError('validate_input', base, err, { email: maskEmailForLogs(email) });
    return new Response(JSON.stringify({
      error: true,
      message: "Validation failed",
      trace_id: traceId,
      reason_code: "VALIDATION_FAILED"
    }), { status: 400 });
  }

  // Step 2: Create Stripe customer
  const stripeStart = Date.now();
  stepStart('create_stripe_customer', base, { email: maskEmailForLogs(email) });

  try {
    const customer = await stripe.customers.create({
      email,
      name: validated.name
    }, {
      idempotencyKey: `trial_${validated.idempotency_key}`
    });

    stepEnd('create_stripe_customer', base, {
      stripe_customer_id: customer.id
    }, stripeStart);

    return new Response(JSON.stringify({
      success: true,
      trace_id: traceId,
      customer_id: customer.id
    }));
  } catch (err) {
    stepError('create_stripe_customer', base, err, {
      email: maskEmailForLogs(email),
      reason_code: "STRIPE_CUSTOMER_FAILED"
    });

    return new Response(JSON.stringify({
      error: true,
      message: "Failed to create customer",
      trace_id: traceId,
      reason_code: "STRIPE_CUSTOMER_FAILED"
    }), { status: 500 });
  }
}
```

### Example 2: Frontend Trace Propagation

```typescript
import { generateCorrelationId } from '@/lib/correlationId';

async function createTrial(data: TrialData) {
  const traceId = generateCorrelationId();

  try {
    const response = await fetch('/api/create-trial', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-rs-trace-id': traceId
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Trial creation failed', {
        cause: {
          trace_id: result.trace_id || traceId,
          reason_code: result.reason_code
        }
      });
    }

    return result;
  } catch (error) {
    // Error boundary will capture and offer debug bundle
    console.error('Trial creation failed', {
      trace_id: traceId,
      error: error.message
    });
    throw error;
  }
}
```

## CI Guardrails

### Logging Coverage Check

A CI check ensures critical flows maintain logging coverage:

**Script:** `scripts/ci/logging-guardrail.ts`

**Rules:**
1. **No raw console.log** in critical directories (except logger module)
2. **Require step logging** in changed Edge Function files:
   - Must contain at least one `stepStart()` or `stepEnd()` call
   - Applies to files in `supabase/functions/` matching critical flow patterns

**Critical Flow Patterns:**
- `create-trial/**`
- `provision-phone-number/**`
- `booking-schedule/**`
- `vapi-tools-appointments/**`

**GitHub Actions Integration:**
```yaml
- name: Check Logging Coverage
  run: npm run ci:logging-guardrail
```

## Best Practices

### DO

✅ Use `stepStart()` and `stepEnd()` for all significant operations
✅ Include `duration_ms` for performance tracking
✅ Add `reason_code` for failures to enable aggregation
✅ Mask PII automatically using provided utilities
✅ Include trace_id in all error responses
✅ Keep step names consistent across the codebase
✅ Log both success and failure paths

### DON'T

❌ Use multi-line logs or unstructured console.log()
❌ Log raw email addresses or phone numbers
❌ Include secrets, tokens, or API keys in logs
❌ Create duplicate step names with different semantics
❌ Skip error logging to "keep logs clean"
❌ Forget to propagate trace_id through async operations

## Querying Logs

### Local Development

Logs are written to stdout in Edge Functions. Use `deno log` or `supabase functions log`:

```bash
# Tail logs for specific function
supabase functions log create-trial --tail

# Filter by trace_id
supabase functions log create-trial | grep "550e8400-e29b-41d4-a716-446655440000"

# Parse JSON logs with jq
supabase functions log create-trial | jq 'select(.step == "create_stripe_customer")'
```

### Production (Supabase Platform)

1. Navigate to **Supabase Dashboard → Edge Functions → Logs**
2. Select function (e.g., `create-trial`)
3. Search by trace_id: `"trace_id":"550e8400-..."`
4. Filter by step: `"step":"create_stripe_customer"`
5. Download logs for analysis

### LLM-Friendly Log Analysis

When pasting logs to Claude for debugging:

1. **Include trace_id** in your request
2. **Copy last 50-100 log lines** around the error
3. **Mention the user action** that triggered the issue
4. **Include debug bundle** if available from frontend

**Example prompt to Claude:**
> "Debug this trial creation failure. Trace ID: 550e8400-e29b-41d4-a716-446655440000. The user tried to create a trial but got a payment error. Here are the logs: [paste JSON logs]"

## Phase 2: Frontend Debug Bundle (✅ COMPLETED)

### Debug Bundle UI

The ErrorBoundary component now automatically captures and presents debug information when errors occur:

**Features:**
- **Automatic debug bundle creation** on React errors
- **One-click copy to clipboard** for easy sharing
- **Download as JSON file** for offline analysis
- **Automatic PII sanitization** (emails, phones masked)
- **Trace ID display** for backend log correlation
- **Step log collection** from session storage (last 30 steps)

**Components:**
- `src/lib/debugBundle.ts` - Debug bundle utilities
- `src/components/ErrorBoundary.tsx` - Enhanced error boundary with debug UI
- `src/hooks/useStepLogger.ts` - React hook for frontend step logging

**Usage Example:**
```tsx
import { useStepLogger } from '@/hooks/useStepLogger';

function TrialSignupForm() {
  const { logStepStart, logStepEnd, logStepError } = useStepLogger();

  const handleSubmit = async (data) => {
    logStepStart('submit_trial_form', { plan: data.planType });

    try {
      const response = await createTrial(data);
      logStepEnd('submit_trial_form', { account_id: response.accountId });
    } catch (error) {
      logStepError('submit_trial_form', error);
      throw error; // ErrorBoundary will catch and show debug bundle
    }
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

**Debug Bundle Format:**
```json
{
  "trace_id": "uuid",
  "timestamp": "ISO 8601",
  "route": "/trial/signup",
  "error": {
    "message": "Payment failed",
    "reason_code": "STRIPE_PAYMENT_FAILED",
    "stack": "..."
  },
  "user_agent": "...",
  "viewport": { "width": 1920, "height": 1080 },
  "network_status": "online",
  "recent_steps": [
    {
      "timestamp": "...",
      "step": "validate_input",
      "event_type": "step_end",
      "duration_ms": 45,
      "result": "success"
    },
    {
      "timestamp": "...",
      "step": "submit_trial_form",
      "event_type": "error",
      "error": "Payment method declined",
      "result": "failure"
    }
  ]
}
```

## Phase 3 Enhancements (Future)

- [ ] **Central Log Storage**: Stream logs to Datadog/Axiom for long-term retention
- [ ] **Sentry Tag Enrichment**: Automatically tag Sentry events with trace_id
- [ ] **Log Sampling**: Sample high-volume logs (keep 100% errors, 10% info)
- [ ] **Performance Budgets**: Alert when `duration_ms` exceeds thresholds
- [ ] **Correlation Dashboard**: Visualize trace propagation across services
- [ ] **Automated Log Analysis**: LLM-powered anomaly detection on step patterns

## Support

For questions about logging:
- **Documentation**: `/docs/logging.md` (this file)
- **Logger Source**: `/supabase/functions/_shared/logging.ts`
- **Examples**: See instrumented functions in `create-trial`, `provision-phone-number`, `booking-schedule`

---

**Last Updated**: 2026-01-01
**Version**: 2.0 (Phase 2: Frontend Debug Bundle Complete)
