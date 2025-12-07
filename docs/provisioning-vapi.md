# Vapi Provisioning & Lifecycle

This document describes the RingSnap phone number provisioning flow using Vapi, including smart area code selection, trial lifecycle, and cleanup.

## Overview

RingSnap creates a dedicated Vapi Assistant and a Vapi Phone Number for each new business trial.
- **Provider**: Vapi (Managed numbers)
- **Cost**: Free for development/trial (check Vapi pricing for production volume)
- **Strategy**: Assign a number matching the user's region (Area Code).

## Flow

1. **Signup**: `create-trial` creates the account and queues a `provision-vapi` job.
2. **Provisioning Worker (`provision-vapi`)**:
   - Checks idempotency (does assistant/phone already exist?).
   - **Assistant**: Creates a Vapi assistant with `gpt-4` and defined voice settings.
   - **Phone Number**:
     - Determines `areaCode` priority:
       1. **Onboarding Phone**: Extracts area code from user's verified phone.
       2. **Billing Zip**: Maps first 2 digits of zip to a major regional area code (e.g. 80xxx -> 303).
       3. **Fallback**: `DEFAULT_US_AREA_CODE` (Env Var, defaults to 303).
     - Calls Vapi `POST /phone-number` with `{ provider: 'vapi', areaCode }`.
     - **Retry**: If area code is unavailable (400/422), retries with random area code.
     - **Link**: Links the phone number to the created assistant.
   - **Persistence**:
     - Saves `vapi_assistant_id`, `vapi_phone_id`, `phone_number_e164`.
     - Calculates and saves `trial_expires_at` (+3 days) and `phone_retention_expires_at` (+10 days).

3. **Lifecycle Management (`manage-phone-lifecycle`)**:
   - Runs on a schedule (Cron).
   - **Trial Expiry**:
     - If `trial_expires_at < NOW` and **Subscription != active**:
     - Sets phone status to `disabled`. (UI should hide/block).
   - **Retention Expiry**:
     - If `phone_retention_expires_at < NOW` and **Subscription != active**:
     - Calls Vapi `DELETE /phone-number/:id` to release the number.
     - Sets DB status to `released`.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VAPI_API_KEY` | Vapi Private API Key | Required |
| `TRIAL_DAYS` | Duration of trial access | 3 |
| `TRIAL_PHONE_RETENTION_DAYS` | How long to keep number before releasing | 10 |
| `DEFAULT_US_AREA_CODE` | Fallback area code | 303 |

## Debugging

### Common Errors

- **`A phone number must either be a string...`**:
  - Caused by sending a malformed body to Vapi (e.g. passing a `phone` object when `provider: 'vapi'` is used, or in a PATCH request).
  - **Fix**: The `provision-vapi` function was updated to strictly send `{ provider: 'vapi', areaCode }` for creation, and `{ assistantId }` for linking.

- **Area Code Unavailable**:
  - Valid area code but Vapi has no stock.
  - **Behavior**: System automatically retries with no area code preference to get a random US number. Logs a warning.

### Manual Actions

- **Retry Provisioning**:
  - Reset `provisioning_jobs.status` to `queued` for the failed job ID.
  - Check `provisioning_logs` for detailed request/response traces.

## Database Schema

New columns in `phone_numbers`:
- `trial_expires_at` (timestamptz)
- `phone_retention_expires_at` (timestamptz)

Ensure migration `20251207144500_add_trial_retention_dates.sql` is applied.
