# Call Logs System Documentation

This document describes the call logging pipeline for RingSnap.

## Canonical Naming

| Canonical Name | Description | Example |
|----------------|-------------|---------|
| `e164_number` | Phone number in E.164 format | `+19705551234` |
| `provider` | Telephony/agent platform | `vapi` |
| `provider_phone_number_id` | Vapi phoneNumber.id | `pn_abc123` |
| `provider_call_id` | Vapi call.id | `call_xyz789` |
| `provider_assistant_id` | Vapi assistant.id | `asst_def456` |

## Database Tables

### `call_logs`
Stores all call records. Key columns:
- `vapi_call_id` (TEXT, UNIQUE) - Primary upsert key
- `account_id` (UUID) - Links to accounts
- `phone_number_id` (UUID) - Links to phone_numbers
- `provider_call_id` (TEXT) - Same as vapi_call_id for now
- `from_number`, `to_number` - E.164 strings
- `started_at`, `ended_at`, `duration_seconds`
- `status` - completed, in-progress, ringing, failed
- `transcript`, `summary`, `recording_url`
- `raw_payload` (JSONB) - Nulled after 7 days

### `call_webhook_inbox`
Dead letter queue for failed webhooks. Check here when calls don't appear.
- `reason` - Why ingestion failed (missing_call_id, unmapped_account, upsert_failed, exception)
- `payload` - Full webhook payload for debugging
- `resolved` - Mark true after investigating

### `phone_numbers`
Canonical phone number table. Key columns:
- `provider_phone_number_id` - Vapi phoneNumber.id (new canonical)
- `vapi_phone_id` - Legacy column, still populated
- `e164_number` - Phone in E.164 format (new canonical)
- `phone_number` - Legacy column, still populated
- `twilio_phone_number_sid` - Twilio SID if available

## Webhook Mapping Logic

The vapi-webhook uses sequential lookups (not OR chains):

1. **Metadata** - Check `call.assistant.metadata.account_id`
2. **provider_phone_number_id** - `phone_numbers.provider_phone_number_id`
3. **vapi_phone_id** (legacy) - `phone_numbers.vapi_phone_id`
4. **e164_number** - `phone_numbers.e164_number`
5. **phone_number** (legacy) - `phone_numbers.phone_number`

If all methods fail, the webhook writes to `call_webhook_inbox` with reason "unmapped_account".

## Debugging Unmapped Calls

```sql
-- Check inbox for failures
SELECT * FROM call_webhook_inbox 
WHERE resolved = false 
ORDER BY received_at DESC 
LIMIT 20;

-- Find unmapped phone number
SELECT provider_phone_number_id, payload->'message'->'call'->'phoneNumber' 
FROM call_webhook_inbox 
WHERE reason = 'unmapped_account';

-- Check phone number identity view
SELECT * FROM phone_number_identity 
WHERE vapi_phone_id = 'pn_xxx';
```

## Retention Policy

| Field | Retention | Implementation |
|-------|-----------|----------------|
| `raw_payload` | 7 days | `call-logs-cleanup` job |
| `transcript` | 30 days | `call-logs-cleanup` job |

## Reconciliation

The `vapi-reconcile-calls` job runs every 15 minutes if `CALL_RECONCILE_ENABLED=true`.
- Fetches last 2 hours of calls from Vapi API
- Only processes numbers in our `phone_numbers` table
- Rate limited to 100 calls per run
- Writes failures to `call_webhook_inbox`

## Frontend Refresh

- **Realtime**: Subscribes to INSERT + UPDATE on `call_logs`
- **Polling Fallback**: 60-second interval refresh
- **RPCs**: `get_recent_calls(p_account_id, p_limit)`, `get_calls_today(p_account_id)`

## Test Webhook

```bash
# Post test payload
curl -X POST https://<project>.supabase.co/functions/v1/vapi-webhook \
  -H "Content-Type: application/json" \
  -H "x-vapi-secret: <secret>" \
  -d @fixtures/vapi-end-of-call-report.json
```
