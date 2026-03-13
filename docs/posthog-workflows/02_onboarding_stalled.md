# Workflow: onboarding_stalled

**Status: INACTIVE — requires PostHog UI configuration to activate**

## Signal Type

`onboarding_stalled`

## Crew Target

`onboarding_crew`

## Description

Fires per-user when a trial has been activated but the user has not reached
`first_value_reached` (test call detected) within 24 hours of activation.
This is the highest-value re-engagement signal for reducing churn before
it starts.

## Trigger Specification

| Condition | Value |
|-----------|-------|
| Trigger event | `trial_activated` occurred for user |
| Window | > 24 hours since `trial_activated` |
| Negative condition | `first_value_reached` has NOT occurred for same distinct_id |
| Dedup window | 30 minutes (posthog-signal) + recommend 24h PostHog dedup per user |
| Rate limit | Max 20 signals of this type per hour |

**Expected max daily fires:** ~10 (one per stalled user per 24h)

## PostHog UI Setup (Deferred)

1. Create a Workflow in PostHog → Workflows
2. Trigger type: **Behavioral cohort alert** (user entered cohort)
3. Cohort definition:
   - `trial_activated` performed > 24 hours ago
   - `first_value_reached` NOT performed in last 48 hours
4. Destination: Webhook → `https://your-project.supabase.co/functions/v1/posthog-signal`
5. Headers: `x-posthog-secret: <POSTHOG_SIGNAL_SECRET>`
6. Body template:

```json
{
  "signal_type": "onboarding_stalled",
  "crew_target": "onboarding_crew",
  "entity_id": "{{distinct_id}}",
  "entity_type": "user",
  "payload": {
    "user_id": "{{distinct_id}}",
    "hours_since_activation": "{{hours_since_trial_activated}}",
    "onboarding_step_last_completed": "{{last_onboarding_step_completed}}"
  }
}
```

## Payload Shape

```typescript
{
  user_id: string;                       // PostHog distinct_id / Supabase user_id
  hours_since_activation: number;        // hours since trial_activated
  onboarding_step_last_completed: string | null; // last onboarding_step_completed step_name
}
```

## Onboarding Crew Actions (Planned)

- Identify last completed onboarding step
- Send targeted in-app nudge or email with specific next-step guidance
- Optionally schedule a follow-up check in 24h
- Log outcome to crew_events for conversion tracking
