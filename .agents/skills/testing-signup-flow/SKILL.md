---
name: testing-signup-flow
description: Test the trial signup/onboarding chat flow end-to-end. Use when verifying changes to /start, /onboarding-chat, or the create-trial provisioning flow.
---

# Testing RingSnap Signup Flow

## Overview

The trial signup flow is: `/start` (lead capture) → `/onboarding-chat` (AI-guided chat) → `/setup/assistant` (provisioning) → `/activation` (success).

## Setup

No authentication required — the signup flow is public-facing.

### Preview Deployment

Use the Netlify deploy preview URL from the PR (format: `deploy-preview-{PR_NUMBER}--ringsnap.netlify.app`).

### Local Development

```bash
npm install
npm run dev  # Vite dev server on port 8080
```

Note: Without Supabase credentials in `.env`, the lead creation on `/start` will fail. For local testing of just the chat UI, you might need to manually navigate to `/onboarding-chat` with a mock lead_id.

## Flow Steps

### Step 1: Create a Lead (`/start`)

1. Navigate to `/start`
2. Enter a test name and email (e.g., `testflow@example.com`)
3. Click "Start My Free Trial"
4. Wait for redirect to `/onboarding-chat?lead_id=...`

### Step 2: Onboarding Chat (`/onboarding-chat`)

The chat has 4 visible steps (as of PR #559):

1. **Phone + Company** (combined) — enter 10-digit US phone + company name
2. **Trade** — click one of the trade buttons (Plumbing, HVAC, Electrical, etc.)
3. **Website + Hours** (combined) — optional website + required hours selection
4. **Payment** — card info + ZIP code

### Payment Bypass Mode

**ZIP code `99999` enables bypass mode** — skips Stripe card validation and uses a mock payment method ID (`pm_bypass_check_deploy`). This allows testing the full flow without real payment.

IMPORTANT: Bypass mode still calls the `create-trial` edge function and will create a real account in the database. Only use this on staging/preview environments where test data is acceptable.

## Key Assertions

### Consolidated Steps
- Step 1 shows TWO inputs (phone + company) in one form
- Step 3 shows website input + hours buttons in one form
- Progress bar shows "Step X of 4"

### Back Navigation
- Every step (except step 1) has a "Back" or "← Back" link
- Payment step has "← Go back" below the CTA button
- Clicking back should return to the previous step with the correct step counter

### Inline Validation (Step 1)
- Submitting empty form shows red error text BELOW inputs (not toasts)
- Phone error: "Enter a valid 10-digit US phone number"
- Company error: "Enter your company name"
- Errors clear as user types valid values

### Trial Messaging (Payment Step)
- Green banner: "3-Day Free Trial — No Charge Today"
- 3 bullet points: 15 real calls, cancel $0, no contracts
- CTA button text: "Start My Free Trial — $0 Today"
- Trust badges: SSL Secure + Stripe Secure Payment

### Disabled Continue (Website+Hours Step)
- "Continue" button is DISABLED until an hours option is selected
- Selecting an option highlights it with a checkmark and enables Continue

## Common Issues

- **Redirect back to `/start`**: The chat page requires a valid `lead_id` in the URL or localStorage. If testing locally without Supabase, the lead won't persist.
- **"Please start the signup process first" toast**: No lead_id found — start from `/start` instead.
- **Stripe elements not loading**: Preview needs the `VITE_STRIPE_PUBLISHABLE_KEY` env var. Netlify deploy previews have this configured.

## Devin Secrets Needed

- `SUPABASE_SERVICE_ROLE_KEY` — only needed if creating test accounts in the DB directly
- No secrets needed for basic UI testing on preview deployments
