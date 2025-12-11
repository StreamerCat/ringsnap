# Feature: Shared Demo Bundle for Test Signups (ZIP 99999)

## Summary
Implements a robust "Test Mode" for signups using a **Shared Demo Bundle** approach. When a user signs up with ZIP `99999`, the system bypasses real Twilio/Vapi provisioning and instead assigns a set of pre-provisioned, real resources (Demo Twilio Number + Demo Vapi Assistant).

This ensures test signups are fast, free (no Stripe/Twilio charges), and result in a fully functional dashboard/phone state without polluting the production environment with mock data that causes runtime errors.

## Key Changes

### 1. `create-trial` Edge Function
- **Test Mode Logic**: Detects ZIP `99999` (or `billing_test_mode=true`).
- **Demo Bundle Integration**: reads `RINGSNAP_DEMO_*` env vars to get real resource IDs.
- **DB Mirroring**: Inserts all required database rows (`phone_numbers`, `vapi_assistants`) and updates `accounts` to exactly match the shape of a successful LIVE provisioning.
- **Safety**: Throws a hard error if demo bundle env vars are missing (prevents "fake success" states).

### 2. Database Schema
- Added `accounts.billing_test_mode` (DEFAULT FALSE)
- Added `phone_numbers.is_test_number` (DEFAULT FALSE)
- Added `vapi_assistants.is_test_assistant` (DEFAULT FALSE)
- *Migration included: `supabase/migrations/20251211000001_add_test_mode_columns.sql`*

### 3. Provisioning Logic
- `provision-vapi` now includes a safety check to EARLY EXIT if it encounters a test account, preventing accidental API calls to Twilio/Vapi.

## How to Test

1. **Apply Migration**: Run the SQL in `supabase/migrations/20251211000001_add_test_mode_columns.sql`.
2. **Set Secrets**: Ensure `RINGSNAP_DEMO_TWILIO_NUMBER`, `RINGSNAP_DEMO_TWILIO_PHONE_SID`, `RINGSNAP_DEMO_VAPI_PHONE_ID`, and `RINGSNAP_DEMO_VAPI_ASSISTANT_ID` are set.
3. **Run Signup**:
   - Go to Signup page.
   - Enter `99999` as ZIP Code.
   - Complete signup.
   - **Expect**: Immediate success, "Ready" status page, and the dashboard showing the Demo Twilio Number.

## Live Safety
- Live signups (non-99999 ZIP) continue to use the existing `create-trial` logic, enforcing `billing_test_mode=false` and executing real Twilio/Vapi provisioning paths.
