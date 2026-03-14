# Workflow: high_cogs_pattern

**Status: INACTIVE — requires PostHog UI configuration to activate**

## Signal Type

`high_cogs_pattern`

## Crew Target

`abuse_detection_crew`

## Description

Fires when a single account accumulates more than 5 long-duration calls
(> 180 seconds each) within a 7-day window. Long calls are expensive
(high COGS) and may indicate misuse, runaway AI, or a legitimate heavy
user requiring tier review.

## Trigger Specification

| Condition | Value |
|-----------|-------|
| Event | `call_ended` with `cogs_bucket = 'long'` (duration > 180s) |
| Window | 7 days rolling |
| Threshold | > 5 long calls per account in window |
| Entity | account_id (per-account dedup) |
| Dedup window | 30 minutes (posthog-signal) |
| Rate limit | Max 20 signals of this type per hour |

**Expected max daily fires:** ~5

## COGS Bucket Definitions

Defined in `supabase/functions/vapi-webhook/index.ts`:

| Bucket | Duration |
|--------|----------|
| `short` | < 60 seconds |
| `medium` | 60–179 seconds |
| `long` | ≥ 180 seconds |

## PostHog UI Setup (Deferred)

1. Create a Workflow in PostHog → Workflows
2. Trigger type: **Per-group threshold alert** (group type: account)
3. Filter: events where `call_ended.cogs_bucket = 'long'`
4. Window: 7 days rolling
5. Condition: count > 5 per account group
6. Destination: Webhook → `https://your-project.supabase.co/functions/v1/posthog-signal`
7. Headers: `x-posthog-secret: <POSTHOG_SIGNAL_SECRET>`
8. Body template:

```json
{
  "signal_type": "high_cogs_pattern",
  "crew_target": "abuse_detection_crew",
  "entity_id": "{{account_id}}",
  "entity_type": "account",
  "payload": {
    "account_id": "{{account_id}}",
    "long_call_count": "{{long_call_count}}",
    "period_days": 7
  }
}
```

## Payload Shape

```typescript
{
  account_id: string;     // Supabase account UUID
  long_call_count: number; // number of long calls in the 7-day window
  period_days: number;    // always 7 in Phase 1
}
```

## Abuse Detection Crew Actions (Planned)

- Look up account plan and usage history
- Determine: legitimate heavy user vs. abuse pattern
- If abuse: flag account for review, alert ops team
- If heavy user: trigger upsell flow for higher-tier plan
- Log determination and recommended action to crew_events
