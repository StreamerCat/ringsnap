# Workflow: checkout_failed_spike

**Status: INACTIVE — requires PostHog UI configuration to activate**

## Signal Type

`checkout_failed_spike`

## Crew Target

`recovery_crew`

## Description

Fires when the checkout conversion rate drops sharply within a rolling 1-hour
window — indicating a potential payment-flow breakage, Stripe issue, or pricing
confusion at scale.

## Trigger Specification

| Condition | Value |
|-----------|-------|
| Event window | 1 hour rolling |
| Minimum started count | `checkout_started` ≥ 5 in window |
| Conversion threshold | `checkout_completed` / `checkout_started` < 0.4 (< 40%) |
| Dedup window | 30 minutes (enforced by posthog-signal Edge Function) |
| Rate limit | Max 20 signals of this type per hour |

**Expected max daily fires:** ~3

## PostHog UI Setup (Deferred)

1. Create a Workflow in PostHog → Workflows
2. Trigger type: **Threshold alert**
3. Metric: `checkout_completed / checkout_started` rolling 1-hour ratio
4. Condition: ratio < 0.4 AND checkout_started count ≥ 5
5. Destination: Webhook → `https://your-project.supabase.co/functions/v1/posthog-signal`
6. Headers: `x-posthog-secret: <POSTHOG_SIGNAL_SECRET>`
7. Body template:

```json
{
  "signal_type": "checkout_failed_spike",
  "crew_target": "recovery_crew",
  "entity_id": null,
  "entity_type": null,
  "payload": {
    "total_started": "{{checkout_started_count}}",
    "completion_rate": "{{completion_rate}}",
    "window_start": "{{window_start}}",
    "window_end": "{{window_end}}"
  }
}
```

## Payload Shape

```typescript
{
  total_started: number;      // checkout_started count in window
  completion_rate: number;    // checkout_completed / checkout_started (0–1)
  window_start: string;       // ISO 8601 timestamp
  window_end: string;         // ISO 8601 timestamp
}
```

## Recovery Crew Actions (Planned)

- Alert founder via Slack with funnel snapshot
- Check Stripe dashboard for payment failures
- If pattern persists > 2 hours: draft customer re-engagement email
