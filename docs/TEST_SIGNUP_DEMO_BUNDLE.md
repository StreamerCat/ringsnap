# Test Signup Demo Bundle

## Overview

Test signups (ZIP 99999) use a **shared demo bundle** - a set of real, pre-provisioned resources that all test accounts share. This allows testing the complete signup flow without purchasing new Twilio numbers or creating new Vapi assistants.

## Demo Bundle Resources

| Resource | Description |
|----------|-------------|
| Twilio Number | A real phone number purchased once |
| Vapi Phone | That number imported into Vapi |
| Vapi Assistant | A shared demo assistant |

## Required Environment Variables

Set these in Supabase Edge Function secrets:

```bash
npx supabase secrets set \
  RINGSNAP_DEMO_TWILIO_NUMBER="+18554360110" \
  RINGSNAP_DEMO_TWILIO_PHONE_SID="PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  RINGSNAP_DEMO_VAPI_PHONE_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" \
  RINGSNAP_DEMO_VAPI_ASSISTANT_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" \
  --project-ref rmyvvbqnccpfeyowidrq
```

## How It Works

### Test Signup Flow (ZIP 99999)

1. User enters ZIP `99999` in billing modal
2. Stripe billing is skipped
3. `create-trial` detects `isTestMode = true`
4. Instead of calling Twilio/Vapi APIs:
   - Inserts `phone_numbers` row with demo bundle number
   - Inserts `vapi_assistants` row with demo bundle assistant ID
   - Updates `accounts` row with demo bundle IDs
   - Calls `update_provisioning_lifecycle` with status "completed"
   - Updates `profiles` with `onboarding_status = "active"`
5. Status page polls and sees "completed" → shows "Ready"
6. Dashboard displays demo number and assistant

### Live Signup Flow (Any Other ZIP)

Completely unchanged:
- Stripe billing runs normally
- Twilio number is purchased
- Vapi phone is imported
- Vapi assistant is created
- Same DB writes as before

## Database Columns

| Table | Column | Description |
|-------|--------|-------------|
| `accounts` | `billing_test_mode` | `TRUE` for test signups |
| `phone_numbers` | `is_test_number` | `TRUE` for demo bundle numbers |
| `vapi_assistants` | `is_test_assistant` | `TRUE` for demo bundle assistants |

All columns have `DEFAULT FALSE` so existing rows are unaffected.

## Provisioning the Demo Bundle (One-Time Setup)

### 1. Purchase Twilio Number

```bash
# Via Twilio Console or API
twilio phone-numbers:buy:local --area-code=855
```

Note the:
- Phone number (E.164 format): `+18554360110`
- Phone SID: `PNxxxxxxxxx...`

### 2. Import into Vapi

Create a phone in Vapi that uses the Twilio number:
- Go to Vapi Dashboard → Phones → Add Phone
- Select Twilio credentials
- Enter the phone number
- Note the Vapi Phone ID

### 3. Create Demo Assistant

Create an assistant in Vapi:
- Go to Vapi Dashboard → Assistants → Create
- Configure with demo prompts
- Note the Vapi Assistant ID

### 4. Set Environment Variables

```bash
npx supabase secrets set \
  RINGSNAP_DEMO_TWILIO_NUMBER="+18554360110" \
  RINGSNAP_DEMO_TWILIO_PHONE_SID="PNxxxxx..." \
  RINGSNAP_DEMO_VAPI_PHONE_ID="uuid" \
  RINGSNAP_DEMO_VAPI_ASSISTANT_ID="uuid" \
  --project-ref rmyvvbqnccpfeyowidrq
```

## Verification

### Test Signup

1. Go to https://getringsnap.com/start
2. Complete onboarding
3. Enter ZIP `99999` at billing
4. Check:
   - Status page shows "Ready" with demo number
   - Dashboard shows demo number + assistant
   - No Twilio/Vapi errors in logs
   - Database shows `billing_test_mode = TRUE`

### Live Signup

1. Use any real ZIP (e.g., `80525`)
2. Verify normal flow unchanged:
   - Stripe charges
   - Real Twilio number
   - Real Vapi assistant

## Fallback Behavior

If demo bundle env vars are not configured:
- Code logs a warning
- Falls back to mock values (`+15005550006`, fake IDs)
- Status page still shows "Ready"
- Number won't be callable (but UI works)
