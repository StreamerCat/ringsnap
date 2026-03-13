# Workflow: lead_gone_cold

**Status: INACTIVE — requires PostHog UI configuration to activate**

## Signal Type

`lead_gone_cold`

## Crew Target

`recovery_crew`

## Description

Fires when a call was qualified as a booking (`lead_qualified`) but the caller
has not proceeded to checkout within 2 hours. This captures warm leads who
expressed purchase intent via a call but didn't convert.

## Trigger Specification

| Condition | Value |
|-----------|-------|
| Trigger event | `lead_qualified` fired (call.booked = true in Vapi webhook) |
| Window | `checkout_started` NOT fired within 2 hours of `lead_qualified` for same call_id |
| Entity | Per call_id (distinct entity dedup) |
| Dedup window | 30 minutes (posthog-signal) |
| Rate limit | Max 20 signals of this type per hour |

**Expected max daily fires:** ~15

## PostHog UI Setup (Deferred)

1. Create a Workflow in PostHog → Workflows
2. Trigger type: **Funnel drop-off alert**
3. Funnel: `lead_qualified` → `checkout_started` within 2 hours
4. Alert condition: drop-off at step 2 (checkout_started not completed)
5. Destination: Webhook → `https://your-project.supabase.co/functions/v1/posthog-signal`
6. Headers: `x-posthog-secret: <POSTHOG_SIGNAL_SECRET>`
7. Body template:

```json
{
  "signal_type": "lead_gone_cold",
  "crew_target": "recovery_crew",
  "entity_id": "{{call_id}}",
  "entity_type": "call",
  "payload": {
    "call_id": "{{call_id}}",
    "user_id": "{{distinct_id}}",
    "plan_key": "{{plan_key}}"
  }
}
```

## Payload Shape

```typescript
{
  call_id: string;      // Vapi call ID from call_ended/lead_qualified event
  user_id: string;      // PostHog distinct_id / account_id
  plan_key: string | null; // plan discussed during call (if known)
}
```

## Recovery Crew Actions (Planned)

- Identify caller's phone number from Vapi call record
- Draft personalized follow-up SMS or email referencing the call
- Trigger RingSnap follow-up sequence if configured
- Log outcome to crew_events
