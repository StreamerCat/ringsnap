# Twilio Test Mode (ZIP 99999)

## Overview

Test mode allows running complete signups without incurring real Twilio or Vapi costs. When a user enters ZIP code `99999` during signup, the system:

1. **Skips Stripe billing** - No real charges
2. **Skips Twilio provisioning** - No real phone numbers purchased
3. **Skips Vapi assistant creation** - No real AI assistants created
4. **Mocks all provisioning data** - Account appears fully provisioned with test data

## How It Works

### Detection

Test mode is triggered when:
- User enters `99999` as their billing ZIP code
- This sets `isTestMode = true` in `create-trial`

### What Happens

#### In `create-trial`:

```
if (isTestMode) {
  // Mock provisioning - NO real API calls
  - Write mock phone number: +15005550006
  - Write mock assistant ID: test-assistant-mock-{timestamp}
  - Write mock phone ID: test-phone-mock-{timestamp}
  - Mark provisioning as "completed" immediately
  - Skip enqueuing provisioning job
  - Skip calling provision-vapi
}
```

#### In `provision-vapi` (safety net):

```
if (zip_code === "99999") {
  // Early exit - no Twilio/Vapi calls
  - Mark job as "completed"
  - Return immediately
}
```

## Test Data Values

| Field | Test Value |
|-------|------------|
| Phone Number | `+15005550006` (Twilio magic test number) |
| Vapi Assistant ID | `test-assistant-mock-{timestamp}` |
| Vapi Phone ID | `test-phone-mock-{timestamp}` |
| Provisioning Status | `completed` |
| Phone Status | `active` |

## Identifying Test Accounts

Test accounts can be identified by:
1. `zip_code === "99999"` on the account
2. `vapi_phone_number === "+15005550006"`
3. `vapi_assistant_id` starting with `test-assistant-mock-`

## Live vs Test Behavior

| Feature | Test Mode (ZIP 99999) | Live Mode (Normal ZIP) |
|---------|----------------------|------------------------|
| Stripe | Bypassed | Real charges |
| Twilio | Mocked | Real provisioning |
| Vapi | Mocked | Real assistant |
| Phone Number | `+15005550006` | Real E.164 number |
| Provisioning Time | Instant | ~10-30 seconds |

## Testing Instructions

1. Go to signup: https://getringsnap.com/start
2. Enter any test data for name/email
3. Complete onboarding chat
4. At billing, enter ZIP: `99999`
5. Card details can be left empty or use test card
6. Submit - should transition to "Ready" immediately

## Logs to Verify

Search Supabase logs for:
- `TEST MODE: Mocking provisioning`
- `TEST MODE: Mock provisioning completed`
- `TEST MODE: Skipping Twilio/Vapi provisioning entirely`

No logs should show:
- Twilio API calls
- Vapi API calls
- Phone number purchase attempts

## Rollback

Test mode is additive and conditional. To disable:
1. Remove the `isTestMode` check in `create-trial`
2. Remove the early exit in `provision-vapi`
3. Redeploy both functions
