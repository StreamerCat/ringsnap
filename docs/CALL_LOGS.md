# Call Logs System Documentation

## Overview

Real-time call logging from Vapi to dashboard with outcome tracking (Booked, Lead, Other).

## Timing Targets

| Event | Target |
|-------|--------|
| Call starts | Row appears in 1-3 seconds |
| Call ends | Row updates in 3-15 seconds |
| Dashboard | Updates without manual refresh |

## Dashboard Update Strategy

### Realtime Subscription
- Subscribes to `postgres_changes` on `call_logs` table
- Listens to both `INSERT` and `UPDATE` events
- Merges incoming data directly into state (no full reload)

### Burst Polling (for test call UX)
- First 60 seconds: polls every 5 seconds
- After 60 seconds: polls every 30 seconds
- Pauses when tab is hidden (visibility API)
- Immediate refresh when tab becomes visible

---

## Outcome Detection

### Outcome Values
| Outcome | Meaning |
|---------|---------|
| `booked` | Appointment was scheduled |
| `lead` | Caller name and phone captured, no appointment |
| `other` | Neither of the above |

### How Outcomes Are Determined

**Booked Detection:**
1. `analysis.structuredData.booked === true` or `appointmentBooked === true`
2. Tool call named `schedule*`, `book*`, `appointment*`, or `calendar*` that returned success
3. `analysis.successEvaluation === true` with appointment evidence

**Lead Detection:**
- `caller_name` is present AND `from_number` is present
- Only set when call ends (`end-of-call-report`)

### Caller Name Extraction
Sources checked in order:
1. `customer.name` field
2. `analysis.structuredData.callerName` or `.customerName` or `.name`
3. Tool call arguments containing `.customerName` or `.name`

### Reason Extraction
1. `analysis.structuredData.reason` or `.callReason` or `.intent`
2. Summary field if ≤200 characters

---

## Webhook Events

We handle only two events:

| Event | Action |
|-------|--------|
| `call-started` | Create minimal row with `status: in_progress` |
| `end-of-call-report` | Update row with duration, transcript, outcome, etc. |

### Minimal vs Full Record
- `call-started`: Only creates `account_id`, `vapi_call_id`, `from_number`, `to_number`, `started_at`, `status`
- `end-of-call-report`: Adds `ended_at`, `duration_seconds`, `transcript`, `summary`, `cost`, `outcome`, `booked`, `lead_captured`, `appointment_start/end`

This prevents null overwrites when the end-of-call arrives before call-started is processed.

---

## Data Retention

| Field | Retention |
|-------|-----------|
| `raw_payload` | Nulled after 7 days |
| `transcript` | Nulled after 30 days |

Job: `call-logs-cleanup` runs daily.

---

## Debugging

### Check webhook inbox for failures
```sql
SELECT * FROM call_webhook_inbox 
WHERE resolved = false 
ORDER BY received_at DESC;
```

### Check call logs for an account
```sql
SELECT id, status, outcome, booked, lead_captured, caller_name, created_at
FROM call_logs 
WHERE account_id = '<uuid>'
ORDER BY created_at DESC
LIMIT 20;
```

### Phone number identity view
```sql
SELECT * FROM phone_number_identity 
WHERE vapi_phone_id = '<provider_phone_id>';
```

---

## Database Schema

### call_logs columns (outcome-related)
```sql
caller_name TEXT          -- Extracted from transcript/tool calls
reason TEXT               -- Why they called
outcome TEXT              -- booked, lead, other
booked BOOLEAN            -- True if appointment scheduled
lead_captured BOOLEAN     -- True if name+phone captured
appointment_start TIMESTAMPTZ
appointment_end TIMESTAMPTZ
```

### Indexes
- `idx_call_logs_outcome` - Filter by outcome
- `idx_call_logs_leads` - Find leads needing follow-up
- `idx_call_logs_booked` - Find booked appointments
