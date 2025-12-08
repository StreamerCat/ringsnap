# Database Account Model & Telephony Architecture

## Status
**Date:** 2025-12-08
**State:** Happy State Implementation

## Overview
RingSnap's database model is designed to support:
1.  **Multi-user Accounts:** Initial signup creates an account owner, but the schema supports teams via `account_members`.
2.  **Provider-Agnostic Telephony:** While Vapi is the primary abstraction, `phone_numbers` and `call_logs` are designed to support direct Twilio or other integrations via `provider` columns.
3.  **Vapi Integration:** Vapi Templates and Assistant configurations are persisted in the DB (`assistant_templates`, `accounts`), ensuring the UI can manage them.

## Core Domain Models

### Accounts & Membership
- **`accounts`**: The tenant root. Holds `stripe_customer_id`, `stripe_subscription_id`, `vapi_assistant_id`.
- **`account_members`**: Links `auth.users` to `accounts` with a `role` ('owner', 'admin', 'member').
  - **Critical:** This is the source of truth for RLS policies.
- **`profiles`**: User-specific metadata (name, email, phone). Linked to `auth.users`.

### Telephony
- **`phone_numbers`**:
  - `id` (UUID): Internal ID.
  - `account_id` (UUID): Owner.
  - `phone_number` (Text): E.164 format.
  - `provider` (Text): 'vapi' or 'twilio'.
  - `provider_id` (Text): The external ID (e.g., Vapi Phone ID or Twilio SID).
  - `raw` (JSONB): Full provider metadata.
- **`call_logs`**:
  - `id` (UUID): Internal ID.
  - `account_id` (UUID): Owner.
  - `provider` (Text): 'vapi' or 'twilio'.
  - `provider_call_id` (Text): External Call SID.
  - `status`, `duration_seconds`, `recording_url`: Standardized call metrics.

### Vapi Configuration
- **`assistant_templates`**:
  - Stores the system-generated or custom-edited prompts.
  - Used by `provision-vapi` to configure the assistant.
  - RLS policies ensure only owners/admins can edit.

## Data Flow: Signup & Provisioning

1.  **Signup (`create-trial` Edge Function)**
    - Creates `auth.users`.
    - Creates `accounts` (Stripe Customer ID, Trial State).
    - Upserts `profiles`.
    - **Inserts `account_members` (Role: 'owner')**.
    - Enqueues job to `provisioning_jobs`.

2.  **Provisioning (`provision-vapi` Worker)**
    - Reads job.
    - Idempotency Check: Checks `vapi_assistants` and `phone_numbers`.
    - **Assistant:** Creates Vapi Assistant -> Updates `accounts.vapi_assistant_id`.
    - **Template:** Persists generated template to `assistant_templates`.
    - **Phone:** Provisions Number -> Inserts to `phone_numbers` (with `provider`='vapi').
    - Updates `accounts.phone_number_status` -> 'active'.

## Recent Changes (Migration: `20251208000001_fix_account_schema.sql`)
1.  **Fixed Membership:** Migrated away from deprecated `user_roles` to `account_members`.
2.  **Telephony Agnosticism:** Added `provider` and `provider_id` to `phone_numbers`.
3.  **Call Logs:** Created generic `call_logs` table.
4.  **Backfill:** Added logic to restore missing `account_members` for orphaned profiles.

## Verification
To verify the schema state:
1.  Check `account_members` has a row for your user.
2.  Check `phone_numbers` has `provider` = 'vapi'.
3.  Check `assistant_templates` has your trade-specifc prompt.

## Future Work
- **Team Invites:** Build UI/API to insert into `account_members` (schema is ready).
- **Direct Twilio:** Logic can now use `provider='twilio'` in `phone_numbers` without schema changes.
