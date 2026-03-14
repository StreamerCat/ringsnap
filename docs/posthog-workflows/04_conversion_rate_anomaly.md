# Workflow: conversion_rate_anomaly

**Status: INACTIVE — requires PostHog UI configuration to activate**

## Signal Type

`conversion_rate_anomaly`

## Crew Target

`founder_reporting_crew`

## Description

Fires once per day when the 7-day rolling `trial_activated / checkout_started`
conversion rate drops more than 20% relative to the prior 7-day period. This is
a founder-level signal for strategic GTM review.

## Trigger Specification

| Condition | Value |
|-----------|-------|
| Metric | `trial_activated` / `checkout_started` (7-day rolling) |
| Comparison | vs. prior 7-day period |
| Threshold | Current rate drops > 20% vs prior period |
| Schedule | Daily check (not real-time) |
| Dedup window | 30 minutes (posthog-signal) — effectively once per day |
| Rate limit | Max 20 signals of this type per hour (effectively 1/day) |

**Expected max daily fires:** 1 (daily digest signal)

## PostHog UI Setup (Deferred)

1. Create a Workflow in PostHog → Workflows
2. Trigger type: **Scheduled metric alert**
3. Schedule: Daily at 09:00 UTC
4. Metric A: `trial_activated` count, last 7 days
5. Metric B: `checkout_started` count, last 7 days
6. Derived: ratio A/B compared to same ratio in prior 7 days
7. Condition: relative drop > 20%
8. Destination: Webhook → `https://your-project.supabase.co/functions/v1/posthog-signal`
9. Headers: `x-posthog-secret: <POSTHOG_SIGNAL_SECRET>`
10. Body template:

```json
{
  "signal_type": "conversion_rate_anomaly",
  "crew_target": "founder_reporting_crew",
  "entity_id": null,
  "entity_type": null,
  "payload": {
    "current_rate": "{{current_conversion_rate}}",
    "prior_rate": "{{prior_conversion_rate}}",
    "delta_pct": "{{delta_percentage}}",
    "period_start": "{{period_start}}",
    "period_end": "{{period_end}}"
  }
}
```

## Payload Shape

```typescript
{
  current_rate: number;   // trial_activated / checkout_started, last 7 days (0–1)
  prior_rate: number;     // same ratio, prior 7 days (0–1)
  delta_pct: number;      // (current - prior) / prior * 100 (negative = drop)
  period_start: string;   // ISO 8601
  period_end: string;     // ISO 8601
}
```

## Founder Reporting Crew Actions (Planned)

- Pull full funnel snapshot from PostHog data warehouse
- Identify which funnel step saw the biggest drop (form_started → form_submitted → checkout_started → trial_activated)
- Generate founder briefing with top 3 hypotheses and recommended actions
- Post to Slack #founders channel
