---
icon: hand-wave
layout:
  width: default
  title:
    visible: true
  description:
    visible: false
  tableOfContents:
    visible: true
  outline:
    visible: true
  pagination:
    visible: true
  metadata:
    visible: true
metaLinks:
  alternates:
    - https://app.gitbook.com/s/yE16Xb3IemPxJWydtPOj/
---

# Welcome

Welcome to the GitBook starter template! Here you'll get an overview of all the amazing features GitBook offers to help you build beautiful, interactive documentation.

You'll see some of the best parts of GitBook in action — and find help on how you can turn this template into your own.

### Jump right in

<table data-view="cards"><thead><tr><th></th><th></th><th></th><th data-hidden data-card-cover data-type="files"></th><th data-hidden></th><th data-hidden data-card-target data-type="content-ref"></th></tr></thead><tbody><tr><td><h4><i class="fa-bolt">:bolt:</i></h4></td><td><strong>Quickstart</strong></td><td>Create your first site</td><td></td><td></td><td><a href="getting-started/quickstart.md">quickstart.md</a></td></tr><tr><td><h4><i class="fa-leaf">:leaf:</i></h4></td><td><strong>Editor basics</strong></td><td>Learn the basics of GitBook</td><td></td><td></td><td><a href="https://github.com/GitbookIO/gitbook-templates/blob/main/product-docs/broken-reference/README.md">https://github.com/GitbookIO/gitbook-templates/blob/main/product-docs/broken-reference/README.md</a></td></tr><tr><td><h4><i class="fa-globe-pointer">:globe-pointer:</i></h4></td><td><strong>Publish your docs</strong></td><td>Share your docs online</td><td></td><td></td><td><a href="getting-started/publish-your-docs.md">publish-your-docs.md</a></td></tr></tbody></table>

## Vapi Chat Widget Setup

To enable the Vapi Chat widget locally, create or update your `.env` file with:

```env
VITE_VAPI_PUBLIC_KEY="your-public-key"
VITE_VAPI_WIDGET_ASSISTANT_ID="your-assistant-id"
```

The widget automatically hides on login/signup pages and injects user context when logged in.

## Provisioning E2E & Monitoring Agent

A dedicated agent script is available to validate the end-to-end provisioning flow (Phone Number purchase, Vapi Assistant creation, and DB updates).

### Prerequisites

1. Ensure the latest migrations are applied (`supabase migration up`).
   - Specifically `20251230000030_add_provisioning_test_config.sql`.
2. Required Environment Variables (must be set in your shell or `.env`):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

### Running Tests (Mock Mode - Default)

Run against your local or remote database without incurring costs.

```bash
npm run test:provisioning:e2e
```

This runs 3 tests:

1. **Happy Path**: Simulates successful provisioning.
2. **Retry Logic**: Simulates a transient failure (network error) and verifies retry success.
3. **Pool Allocation**: Verifies that an available number is reused instead of purchasing a new one.

### Running Tests (Live Mode - CAUTION)

To run against real Twilio/Vapi APIs (incurs costs):

```bash
RUN_LIVE_PROVISIONING_TESTS=true npm run test:provisioning:e2e
```

### Safety Guardrails

- Tests create accounts with names starting with `E2E Test`.
- MOCK mode prevents external API calls via the `mock_provider` config.
