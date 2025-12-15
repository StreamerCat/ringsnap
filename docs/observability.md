# Observability Guide

This document describes the error tracking and monitoring setup for RingSnap.

## Required Environment Variables

### Frontend (Vite)
```
# Set in Vercel/Netlify environment:
# (Sentry DSN is hardcoded in main.tsx for simplicity)
```

### Supabase Edge Functions
```bash
# Set via Supabase CLI:
supabase secrets set SENTRY_DSN="https://your-key@o123.ingest.sentry.io/456"
```

## What Is Captured

### Frontend (React)
- **Errors**: All uncaught exceptions and unhandled Promise rejections
- **Performance**: 2% of page loads (tracesSampleRate: 0.02)
- **Session Replay**: 10% of sessions, 100% of sessions with errors
- **Console Logging**: Errors and warnings

### Edge Functions
- **Errors**: Caught exceptions in critical functions
- **Tags**: functionName, environment, correlationId
- **Context**: accountId (if available), request details

## What Is Excluded (Privacy)
- Raw call transcripts
- Customer personal data beyond IDs
- API secrets and keys
- Full request/response payloads

## Covered Functions

Sentry error capture is enabled in these edge functions:
- `stripe-webhook`
- `create-upgrade-checkout`
- `create-trial`
- `provision-vapi`
- `cancel-subscription`
- `create-billing-portal-session`

## Verification

### Force a Test Error (Frontend)
Open browser console on any page and run:
```javascript
throw new Error("Test Sentry error from console");
```

### Force a Test Error (Edge Function)
Deploy with a forced error or check existing error logs in Sentry.

### Check Sentry Dashboard
1. Go to https://sentry.io
2. Select the RingSnap project
3. View Issues tab for captured errors
4. Verify tags include: `function_name`, `correlation_id`

## Running Playwright Tests

```bash
# Run all e2e tests
npm run test:e2e

# Run with browser UI
npm run test:e2e:ui

# Run with visible browser
npm run test:e2e:headed
```

## CI Integration

The Playwright tests can be added to CI via:
1. GitHub Actions workflow (add `.github/workflows/e2e.yml`)
2. Netlify build step (add to `netlify.toml`)

Example GitHub Action:
```yaml
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx playwright install chromium
      - run: npm run test:e2e
        env:
          PLAYWRIGHT_BASE_URL: ${{ secrets.STAGING_URL }}
```
