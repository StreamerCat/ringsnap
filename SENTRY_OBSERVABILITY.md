# Sentry Observability Setup for RingSnap

This document describes the minimal, best-practice Sentry observability implementation for RingSnap's money-critical flows.

## Overview

- **Frontend**: React + Vite with low-noise error tracking and session replay on errors only
- **Backend**: Supabase Edge Functions (Deno) with request-safe error capture
- **Critical Flows Instrumented**: Trial signup, provisioning, billing, webhooks

## Architecture

### Frontend (React + Vite)

**Location**: `src/main.tsx`

**Configuration**:
- ✅ Low noise: 3% trace sampling, 0% session replay, 100% error replay
- ✅ Redaction: Removes email, phone, token, secret, authorization, card data
- ✅ Error filtering: Ignores AbortError, NetworkError, browser extensions
- ✅ Release tagging: Uses `VITE_SENTRY_RELEASE` from Netlify build
- ✅ Environment-aware: Reads DSN from env var or hardcoded fallback

**Source Maps**:
- Enabled in `vite.config.ts` with `sourcemap: true`
- Upload via Netlify Sentry Plugin (see Netlify Setup below)

### Backend (Supabase Edge Functions)

**Location**: `supabase/functions/_shared/sentry.ts`

**Key Features**:
- ✅ **Request-scoped** error capture (no global state leakage)
- ✅ **Correlation ID** linkage with structured logs
- ✅ **Automatic redaction** of sensitive fields
- ✅ **Rich context tags**: region, execution_id, accountId, userId
- ✅ **Flush behavior**: 5-second timeout to ensure events sent before function exit
- ✅ **External service tracking**: Stripe, Vapi, Twilio IDs in context

## Instrumenting Edge Functions

### Pattern 1: New Functions (Recommended)

Use `withSentryEdge` wrapper for automatic error capture:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentryEdge, captureEdgeError, SentryEdgeContext } from "../_shared/sentry.ts";
import { extractCorrelationId, logInfo, logError } from "../_shared/logging.ts";

serve(withSentryEdge({ functionName: "my-function" }, async (req, ctx) => {
  // Extract correlation ID for structured logging
  const correlationId = ctx.correlationId;
  const baseLog = { functionName: ctx.functionName, correlationId };

  logInfo("Function started", baseLog);

  try {
    // Your business logic here
    const result = await doSomething();

    // Add accountId/userId to context for Sentry tagging
    ctx.accountId = result.accountId;
    ctx.userId = result.userId;

    logInfo("Function completed", { ...baseLog, accountId: ctx.accountId });

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    logError("Function failed", { ...baseLog, error });

    // Capture to Sentry with context
    await captureEdgeError(error, ctx, {
      step: "business_logic",
      // Additional context (will be redacted automatically)
    });

    return new Response(JSON.stringify({ error: "Internal error" }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
}));
```

### Pattern 2: Existing Functions (Legacy Compatible)

Existing functions using `initSentry()` and `captureError()` continue to work with deprecation warnings:

```typescript
import { initSentry, captureError } from "../_shared/sentry.ts";

serve(async (req) => {
  const requestId = crypto.randomUUID();

  // Legacy API - still works but logs deprecation warning
  initSentry("my-function", { correlationId: requestId });

  try {
    // Your logic
  } catch (error) {
    await captureError(error, { phase: "processing" });
    throw error;
  }
});
```

**Migration**: Convert to `withSentryEdge` pattern when refactoring functions.

## Logging + Sentry Correlation

Every Sentry error includes `correlation_id` in extra context, matching your structured logs:

**Search Supabase Logs by Correlation ID**:
```bash
supabase functions logs stripe-webhook | grep "abc-123-correlation-id"
```

**Search Sentry by Correlation ID**:
In Sentry UI, search: `extra.correlation_id:"abc-123-correlation-id"`

## Error Capture Rules

### ✅ Capture These

- **Unexpected exceptions** in try/catch blocks
- **External API failures** (Stripe, Vapi, Twilio) with:
  - Response status code
  - Service-specific IDs (customer_id, subscription_id, assistant_id)
  - Redacted response bodies
- **Validation failures** that indicate bugs (not expected user errors)

### ❌ Don't Capture These

- Expected validation errors (missing fields, invalid format)
- User-triggered errors (wrong password, duplicate email)
- 4xx responses from known, intentional checks

## Context Tags on Every Event

Automatically included:

- `function_name`: Edge function name
- `environment`: production/staging/development
- `region`: Supabase region (e.g., us-east-1)
- `execution_id`: Unique Supabase execution ID
- `account_id`: RingSnap account ID (if known)
- `user_id`: User ID (if known)

Additional context (not indexed, for debugging):

- `correlation_id`: Matches structured logs
- `stripe_customer_id`, `stripe_subscription_id`, `stripe_invoice_id`, `stripe_event_id`, `stripe_event_type`
- `vapi_assistant_id`, `vapi_phone_number_id`, `vapi_call_id`
- `twilio_sid`

## Redaction

Sensitive fields are automatically removed before sending to Sentry:

- email, phone, token, secret, authorization, cookie
- transcript, raw_audio, card, password, ssn
- api_key, apikey

**Manual redaction** for external API responses:
```typescript
import { redact } from "../_shared/sentry.ts";

const stripeResponse = await stripe.customers.retrieve(customerId);
const redactedResponse = redact(stripeResponse);

await captureEdgeError(error, ctx, {
  stripe_response: redactedResponse,
});
```

## Critical Functions Instrumented

Based on revenue impact, the following functions are instrumented:

### Signup & Onboarding
- ✅ `create-trial/index.ts` - Primary signup flow
- ✅ `finalize-trial/index.ts` - Two-step signup completion
- ✅ `complete-onboarding/index.ts` - Onboarding completion

### Provisioning
- ✅ `provision-vapi/index.ts` - Async Vapi provisioning worker (CRITICAL)
- ✅ `provision-phone-number/index.ts` - Phone number provisioning
- ✅ `provision-account/index.ts` - Account provisioning orchestrator

### Billing & Subscriptions
- ✅ `stripe-webhook/index.ts` - Stripe webhook handler (CRITICAL)
- ✅ `create-billing-portal-session/index.ts` - Billing portal access
- ✅ `create-upgrade-checkout/index.ts` - Plan upgrades
- ✅ `cancel-subscription/index.ts` - Subscription cancellation

### Analytics & Reporting
- ✅ `sync-usage/index.ts` - Vapi usage tracking (CRITICAL - triggers trial upgrades)

## Netlify Setup for Source Maps

### Option 1: Netlify Sentry Plugin (Recommended)

Install the plugin:
```bash
netlify plugins:install netlify-plugin-sentry
```

Update `netlify.toml`:
```toml
[[plugins]]
  package = "netlify-plugin-sentry"
  [plugins.inputs]
    sentryOrg = "your-sentry-org"
    sentryProject = "ringsnap-frontend"
    sentryAuthToken = "${SENTRY_AUTH_TOKEN}"  # Set as Netlify env var
```

Set environment variable in Netlify UI:
- `SENTRY_AUTH_TOKEN`: Create in Sentry → Settings → Auth Tokens

### Option 2: Manual Upload with Sentry CLI

Add to `package.json`:
```json
{
  "scripts": {
    "build": "vite build && sentry-cli sourcemaps upload --release=$COMMIT_REF ./dist"
  }
}
```

Install Sentry CLI:
```bash
npm install --save-dev @sentry/cli
```

Set environment variables in Netlify:
- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

## Verification Checklist

### ✅ Frontend

1. **Trigger an error** (open DevTools console):
   ```javascript
   throw new Error("Test Sentry frontend");
   ```

2. **Check Sentry UI**:
   - Error appears in Issues
   - Environment = production/staging
   - Release tag is present
   - Stack trace is readable (source maps working)
   - No sensitive data (check user/extra context)

3. **Verify redaction**:
   ```javascript
   Sentry.captureException(new Error("Test"), {
     extra: { email: "test@example.com", phone: "+1234567890" }
   });
   ```
   Check Sentry - email/phone should be `[REDACTED]`

### ✅ Edge Functions

1. **Trigger an error in a test function**:

   Create `supabase/functions/sentry-test/index.ts`:
   ```typescript
   import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
   import { withSentryEdge, captureEdgeError } from "../_shared/sentry.ts";

   serve(withSentryEdge({ functionName: "sentry-test" }, async (req, ctx) => {
     ctx.accountId = "test-account-123";
     ctx.userId = "test-user-456";

     throw new Error("Intentional test error for Sentry");
   }));
   ```

   Deploy and invoke:
   ```bash
   supabase functions deploy sentry-test
   curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/sentry-test
   ```

2. **Check Sentry UI**:
   - Error appears in Issues
   - Tags include:
     - `function_name: sentry-test`
     - `environment: production`
     - `region: us-east-1` (or your region)
     - `account_id: test-account-123`
     - `user_id: test-user-456`
   - Extra context includes `correlation_id`

3. **Verify correlationId linkage**:
   - Copy `correlation_id` from Sentry event
   - Search Supabase logs:
     ```bash
     supabase functions logs sentry-test | grep "<correlation-id>"
     ```
   - Should see structured log entries with matching correlationId

4. **Verify redaction**:
   ```typescript
   await captureEdgeError(new Error("Test"), ctx, {
     customer_email: "user@example.com",
     phone_number: "+1234567890",
     stripe_secret_key: "sk_live_abc123",
   });
   ```
   Check Sentry - all should be `[REDACTED]`

5. **Verify no cross-request leakage**:
   - Make 2 concurrent requests with different accountIds
   - Check both Sentry events - each should have correct accountId, no mixing

## Recommended Sentry Alert Rules

Create these alerts in Sentry → Alerts → Create Alert Rule:

### 1. Critical Function Errors (High Priority)

**Conditions**:
- Event type: Error
- Tags: `function_name` is any of:
  - `create-trial`
  - `provision-vapi`
  - `stripe-webhook`
  - `sync-usage`
- Environment: `production`

**Trigger**: When event count >= 3 in 5 minutes

**Actions**:
- Send to Slack #alerts channel
- Send to PagerDuty (critical)

### 2. Billing Flow Errors

**Conditions**:
- Event type: Error
- Tags: `function_name` is any of:
  - `create-upgrade-checkout`
  - `stripe-webhook`
  - `cancel-subscription`
- Environment: `production`

**Trigger**: When event count >= 2 in 10 minutes

**Actions**:
- Send to Slack #billing-alerts
- Email to billing team

### 3. Provisioning Failures

**Conditions**:
- Event type: Error
- Tags: `function_name` is any of:
  - `provision-vapi`
  - `provision-phone-number`
- Environment: `production`

**Trigger**: When error rate > 10% of requests in 10 minutes

**Actions**:
- Send to Slack #ops-alerts
- Email to on-call engineer

### 4. High Error Rate (Any Function)

**Conditions**:
- Event type: Error
- Environment: `production`

**Trigger**: When error rate > 5% of requests in 15 minutes

**Actions**:
- Send to Slack #engineering-alerts
- Create PagerDuty incident

### 5. Regression Detection

**Conditions**:
- Event type: Error
- Tags: `function_name` exists
- Environment: `production`

**Trigger**: When new issue is created (first-time error)

**Actions**:
- Send to Slack #new-errors
- Assign to on-call engineer

## Alert Filters

To reduce noise, all alerts should:
- Filter out known non-actionable errors (already in `ignoreErrors`)
- Only fire for `environment: production` (not staging/dev)
- Use rate-based triggers (not single events) to avoid false positives

## Maintenance

### Adding New Functions

When creating new Edge Functions, use the `withSentryEdge` pattern (see "Pattern 1" above).

### Updating Context Fields

To track new external services, update `SentryEdgeContext` interface in `supabase/functions/_shared/sentry.ts`:

```typescript
export interface SentryEdgeContext {
  // ... existing fields

  // Add new service
  new_service_id?: string;
}
```

Then add to `captureEdgeError`:
```typescript
if (ctx.new_service_id) extra.new_service_id = ctx.new_service_id;
```

### Reviewing Sentry Issues

**Weekly Review**:
1. Check "Issues" dashboard for trends
2. Triage new issues:
   - Real bug → Create GitHub issue, assign
   - Expected behavior → Add to `ignoreErrors`
   - Noise → Add to `beforeSend` filter
3. Check alert fatigue - adjust thresholds if needed

## Cost Optimization

Current configuration targets **minimal noise** and **low storage costs**:

- Frontend: 3% trace sampling, 0% session replay (error-only)
- Backend: Error-only capture (no performance tracing)
- Estimated monthly events: ~1,000-5,000 errors + ~10,000 transactions

**Sentry Pricing Estimate**:
- Team Plan: $26/month per member
- Errors: Included up to 50K/month
- Transactions: Included up to 100K/month
- Session Replay: Pay-per-replay (only on errors)

**If costs increase**:
1. Lower `tracesSampleRate` further (e.g., 0.01 = 1%)
2. Add more filters to `ignoreErrors`
3. Review and remove noisy alerts

## Troubleshooting

### Events Not Appearing in Sentry

1. Check DSN is set correctly:
   - Frontend: `VITE_SENTRY_DSN` env var or hardcoded
   - Backend: `SENTRY_DSN` in Supabase secrets

2. Check network (Edge Functions):
   ```bash
   curl -X POST https://o4510524163096576.ingest.us.sentry.io/api/YOUR_PROJECT_ID/store/ \
     -H "Content-Type: application/json" \
     -d '{"message":"test"}'
   ```

3. Check logs for Sentry errors:
   ```bash
   supabase functions logs my-function | grep "\[Sentry\]"
   ```

### Source Maps Not Working

1. Verify source maps are generated:
   ```bash
   ls dist/**/*.js.map
   ```

2. Check Netlify plugin is installed:
   ```bash
   netlify plugins:list
   ```

3. Check Sentry release matches:
   - Frontend: `VITE_SENTRY_RELEASE` should equal `COMMIT_REF`
   - Sentry: Check Releases tab for matching version

### correlationId Not Matching Logs

1. Verify header extraction order in both:
   - `sentry.ts`: `x-correlation-id`, `x-request-id`, `requestid`
   - `logging.ts`: Same order

2. Check caller is setting header:
   ```typescript
   fetch("/api/function", {
     headers: { "x-correlation-id": crypto.randomUUID() }
   });
   ```

---

**Last Updated**: 2025-12-15
**Maintained By**: RingSnap Engineering Team
**Owner**: @flow-observability-agent
