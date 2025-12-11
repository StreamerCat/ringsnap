# Twilio Test Mode (ZIP 99999) - Demo Bundle Approach

## Overview

Test mode (ZIP 99999) now uses a **Shared Demo Bundle** instead of mock provisioning.

This means:
- ✅ Real callable phone number
- ✅ Real Vapi assistant answering calls
- ✅ Same DB structure as live signups
- ✅ Status page and dashboard work identically
- ❌ No Twilio API calls for purchasing
- ❌ No Vapi API calls for creation

## How It Works

When a user enters ZIP `99999` at billing:

1. **Stripe is bypassed** (no charges)
2. **Account created** with `billing_test_mode = true`
3. **Phone number row created** using demo bundle values (not a new Twilio purchase)
4. **Assistant row created** using demo bundle values (not a new Vapi assistant)
5. **Provisioning marked complete** immediately
6. **Status page shows Ready** with real demo number

## Environment Variables

The demo bundle requires these Supabase secrets:

| Variable | Description |
|----------|-------------|
| `RINGSNAP_DEMO_TWILIO_NUMBER` | E.164 phone number (e.g., `+18554360110`) |
| `RINGSNAP_DEMO_TWILIO_PHONE_SID` | Twilio Phone Number SID |
| `RINGSNAP_DEMO_VAPI_PHONE_ID` | Vapi phone ID linked to the Twilio number |
| `RINGSNAP_DEMO_VAPI_ASSISTANT_ID` | Vapi assistant ID for demo calls |

### Setting Secrets

```bash
npx supabase secrets set \
  RINGSNAP_DEMO_TWILIO_NUMBER="+18554360110" \
  RINGSNAP_DEMO_TWILIO_PHONE_SID="PNxxxx..." \
  RINGSNAP_DEMO_VAPI_PHONE_ID="uuid" \
  RINGSNAP_DEMO_VAPI_ASSISTANT_ID="uuid" \
  --project-ref rmyvvbqnccpfeyowidrq
```

## Live vs Test Comparison

| Feature | Test Mode (ZIP 99999) | Live Mode |
|---------|----------------------|-----------|
| Stripe | Skipped | Charged |
| Twilio | Demo bundle (shared) | New purchase |
| Vapi | Demo bundle (shared) | New assistant |
| Phone callable | Yes (demo number) | Yes (own number) |
| DB structure | Same | Same |
| Status page | Shows Ready | Shows Ready |

## Files Changed

- `supabase/functions/create-trial/index.ts` - Demo bundle provisioning
- `supabase/functions/provision-vapi/index.ts` - Early exit for test accounts
- `supabase/migrations/20251211000001_add_test_mode_columns.sql` - New columns
- `docs/TEST_SIGNUP_DEMO_BUNDLE.md` - Setup guide

## Fallback

If demo bundle env vars are missing:
- Warning logged
- Falls back to mock values (`+15005550006`)
- UI still works
- Number won't be callable

See [docs/TEST_SIGNUP_DEMO_BUNDLE.md](./TEST_SIGNUP_DEMO_BUNDLE.md) for setup instructions.
