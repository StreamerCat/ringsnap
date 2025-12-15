# Sentry Quick Start for RingSnap

## How to Instrument a New Edge Function (2 Lines)

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentryEdge, captureEdgeError } from "../_shared/sentry.ts";

// Wrap your handler with withSentryEdge (Line 1)
serve(withSentryEdge({ functionName: "my-function" }, async (req, ctx) => {
  try {
    // Your business logic
    ctx.accountId = "acc_123"; // Optional: add context
    return new Response(JSON.stringify({ success: true }));
  } catch (error) {
    await captureEdgeError(error, ctx); // Line 2
    throw error;
  }
}));
```

That's it! Automatic error capture with correlation IDs, tags, and redaction.

## Verification Checklist

### Frontend (3 steps)

1. **Trigger test error**:
   ```javascript
   // In browser DevTools console
   throw new Error("Test frontend Sentry");
   ```

2. **Check Sentry**: Error appears with readable stack trace

3. **Verify redaction**: No emails, phone numbers, or tokens visible

### Edge Functions (3 steps)

1. **Deploy test function**:
   ```bash
   supabase functions deploy sentry-test
   ```

2. **Trigger test error**:
   ```bash
   curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/sentry-test \
     -H "Content-Type: application/json" \
     -d '{"testType": "error"}'
   ```

3. **Check Sentry**:
   - ✅ Error appears in Issues
   - ✅ Tags: `function_name`, `account_id`, `region`, `execution_id`
   - ✅ Extra context: `correlation_id`
   - ✅ No sensitive data (email, phone, tokens are `[REDACTED]`)

4. **Verify correlation ID linkage**:
   ```bash
   # Copy correlation_id from Sentry event
   supabase functions logs sentry-test | grep "<correlation-id>"
   # Should see matching log entries
   ```

## Critical Functions Already Instrumented

All money-critical flows are instrumented:

- ✅ `create-trial` - Trial signup
- ✅ `finalize-trial` - Signup completion
- ✅ `provision-vapi` - Vapi provisioning (async worker)
- ✅ `stripe-webhook` - Stripe webhooks (billing source of truth)
- ✅ `create-upgrade-checkout` - Plan upgrades
- ✅ `cancel-subscription` - Cancellations
- ✅ `sync-usage` - Usage tracking & trial upgrades

## Alert Rules (Copy to Sentry)

### 1. Critical Function Errors (P0)

```
Conditions:
  - Event type: Error
  - function_name in: create-trial, provision-vapi, stripe-webhook, sync-usage
  - environment: production

Trigger: >= 3 errors in 5 minutes

Actions: PagerDuty + Slack #critical-alerts
```

### 2. Billing Flow Errors (P1)

```
Conditions:
  - Event type: Error
  - function_name in: create-upgrade-checkout, stripe-webhook, cancel-subscription
  - environment: production

Trigger: >= 2 errors in 10 minutes

Actions: Slack #billing-alerts + Email billing team
```

### 3. High Error Rate (P1)

```
Conditions:
  - Event type: Error
  - environment: production

Trigger: Error rate > 5% in 15 minutes

Actions: Slack #engineering-alerts + PagerDuty
```

### 4. New Issue Detection (P2)

```
Conditions:
  - Event type: Error
  - environment: production
  - Is first-time error (new issue)

Trigger: Immediately

Actions: Slack #new-errors + Assign to on-call
```

## Netlify Source Map Setup (One-Time)

### Option 1: Plugin (Recommended)

```bash
netlify plugins:install netlify-plugin-sentry
```

Add to `netlify.toml`:
```toml
[[plugins]]
  package = "netlify-plugin-sentry"
  [plugins.inputs]
    sentryOrg = "your-org"
    sentryProject = "ringsnap-frontend"
    sentryAuthToken = "${SENTRY_AUTH_TOKEN}"
```

Set `SENTRY_AUTH_TOKEN` in Netlify UI (Settings → Environment Variables).

### Option 2: Manual CLI

```bash
npm install --save-dev @sentry/cli
```

Update `package.json`:
```json
{
  "scripts": {
    "build": "vite build && sentry-cli sourcemaps upload --release=$COMMIT_REF ./dist"
  }
}
```

Set env vars: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`.

## Troubleshooting

### Events not appearing?

1. Check DSN:
   - Frontend: `VITE_SENTRY_DSN` env var
   - Backend: `SENTRY_DSN` in Supabase secrets

2. Check logs:
   ```bash
   supabase functions logs my-function | grep "\[Sentry\]"
   ```

### Source maps not working?

1. Verify generated:
   ```bash
   ls dist/**/*.js.map
   ```

2. Check release matches:
   - Frontend release in Sentry UI should match `COMMIT_REF`

### correlationId not matching logs?

- Ensure header extraction order matches in `sentry.ts` and `logging.ts`
- Check caller sets `x-correlation-id` header

## Cost Estimate

Current configuration (low noise):
- Frontend: 3% trace sampling, error-only replay
- Backend: Error-only capture

**Estimated monthly**:
- ~1,000-5,000 errors
- ~10,000 transactions
- **Cost**: ~$26-52/month (Team Plan, 1-2 members)

## Full Documentation

See `SENTRY_OBSERVABILITY.md` for complete details on:
- Architecture
- Instrumentation patterns
- Logging + Sentry correlation
- Error capture rules
- Redaction
- Maintenance

---

**Questions?** Ask @flow-observability-agent or check Sentry documentation.
