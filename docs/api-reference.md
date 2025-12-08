# API Reference

## Edge Functions

### `sync-assistant-config`

Updates the system prompt (template) for the account's Vapi assistant and persists it to the database.

**URL:** `/functions/v1/sync-assistant-config`
**Method:** `POST`
**Auth:** Requires valid Supabase JWT (`Authorization: Bearer ...`). User must be `owner` or `admin`.

**Request Body:**
```json
{
  "template_body": "You are a helpful assistant for Plumbing Co..."
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "synced_to_vapi": true // false if no Vapi ID is linked yet
}
```

### `create-trial` (Updated)

Creates a new trial account, user, and membership.

**Updated Behavior:**
- Now inserts into `account_members` with role `owner`.
- Deprecated `user_roles` table is no longer used.

### `provision-vapi` (Updated Worker)

**Updated Behavior:**
- Stores phone number with `provider='vapi'` and `provider_id`.
- Uses `assistant_templates` table for initial configuration.

## Database Tables

### `assistant_templates`
- **Source of Truth** for the AI prompt.
- Columns: `account_id`, `trade`, `template_body`, `is_default`, `source`.

### `phone_numbers`
- **Telephony Provider Agnostic**.
- Columns: `provider` (vapi/twilio), `provider_id`.

### `call_logs`
- **Generic Call History**.
- Columns: `provider`, `provider_call_id`, `recording_url`.
