# Fix: Call Logging Pipeline Overhaul

## Summary

Complete fix of the call logging pipeline from Vapi webhook to dashboard display. Calls now reliably populate in `call_logs` and appear on dashboards.

## Problem

- Webhook was not successfully parsing or storing real calls from Vapi
- Inconsistent naming across codebase (`vapi_id`, `vapi_phone_id`, `vapi_call_id`, etc.)
- Account mapping used fragile OR-based phone matching that silently failed
- No visibility into failed webhooks
- Dashboards depended solely on Realtime (missing calls if subscription failed)

## Solution

### Database Changes
- **New table**: `call_webhook_inbox` - Dead letter queue for failed webhooks
- **New columns**: `provider_phone_number_id`, `e164_number`, `twilio_phone_number_sid` in `phone_numbers`
- **New view**: `phone_number_identity` for debugging

### Webhook Rewrite (`vapi-webhook`)
- Robust payload normalization matching Vapi event shape
- Sequential account mapping (not OR chains):
  1. `provider_phone_number_id`
  2. `vapi_phone_id` (legacy fallback)
  3. `e164_number`
  4. `phone_number` (legacy fallback)
- **Always** writes to `call_webhook_inbox` on any failure
- Creates minimal call record even without `ended_at`

### New Edge Functions
- **`vapi-reconcile-calls`**: Feature-flagged job to backfill missing calls from Vapi API
- **`call-logs-cleanup`**: Data retention (7d raw_payload, 30d transcript)

### Frontend
- CustomerDashboard now subscribes to both INSERT + UPDATE events
- 60-second polling fallback in case Realtime misses events

## Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/20251217000001_call_webhook_inbox.sql` | New dead letter inbox table |
| `supabase/migrations/20251217000002_standardize_phone_identifiers.sql` | Canonical phone columns + backfill |
| `supabase/functions/vapi-webhook/index.ts` | Complete rewrite |
| `supabase/functions/vapi-reconcile-calls/index.ts` | New reconciliation job |
| `supabase/functions/call-logs-cleanup/index.ts` | New retention job |
| `src/pages/CustomerDashboard.tsx` | UPDATE listener + polling |
| `docs/CALL_LOGS.md` | Documentation |
| `fixtures/vapi-end-of-call-report.json` | Test payload |

## Deployment Notes

Edge functions already deployed. Migrations already applied via SQL Editor.

To enable reconciliation (optional):
```
CALL_RECONCILE_ENABLED=true
```

## Testing

1. Make a real call to a RingSnap number
2. Verify call appears in `call_logs` within 60 seconds
3. If missing, check `call_webhook_inbox` for reason
4. Dashboard should show call without manual refresh

## Backward Compatibility

All changes are additive. Legacy columns preserved:
- `vapi_phone_id` still populated
- `phone_number` still populated
- `vapi_call_id` still used as upsert key

Signup/provisioning flows unchanged.
