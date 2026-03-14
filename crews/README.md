# RingSnap CrewAI Signal Consumer

Polls the `posthog_signals` Supabase table for pending signals from PostHog
workflows and routes them to the appropriate CrewAI crew.

## Architecture

```
PostHog threshold crossed
  → PostHog workflow fires webhook
    → POST /functions/v1/posthog-signal  (Supabase Edge Function)
      → dedup + rate limit
        → INSERT posthog_signals (status='pending')
          → THIS SCRIPT polls every 15 min
            → routes to crew by crew_target
              → writes crew_events record
                → marks posthog_signals.status='completed'
```

## Setup

### 1. Install dependencies

```bash
cd crews
pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp ../.env.example .env
# Edit .env and set:
#   SUPABASE_URL=https://your-project.supabase.co
#   SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### 3. Run the consumer

```bash
python posthog_signal_consumer.py
```

The consumer polls every 15 minutes. In Phase 1 all crews are stubbed — signals
are acknowledged without execution until actual crew classes are wired.

## Wiring a Crew

In `posthog_signal_consumer.py`, replace `None` in `CREW_ROUTER` with the crew
class instance:

```python
from crews.recovery_crew import RecoveryCrew

CREW_ROUTER = {
    "recovery_crew": RecoveryCrew(),
    ...
}
```

Each crew must implement a `kickoff(inputs: dict) -> dict` method.

## Signal Types and Their Crews

| Signal Type | Crew Target | Trigger |
|-------------|-------------|---------|
| `checkout_failed_spike` | `recovery_crew` | Checkout conversion drops |
| `onboarding_stalled` | `onboarding_crew` | Trial > 24h without first_value_reached |
| `lead_gone_cold` | `recovery_crew` | lead_qualified without checkout_started |
| `conversion_rate_anomaly` | `founder_reporting_crew` | 7-day rolling rate drops >20% |
| `high_cogs_pattern` | `abuse_detection_crew` | >5 long calls in 7 days per account |

See `docs/posthog-workflows/` for full trigger specs.

## Important Notes

- **Do not reduce the poll interval below 15 minutes** in Phase 1.
- PostHog workflows are **inactive by default** — they require PostHog UI
  configuration to activate. See `docs/posthog-workflows/` for setup steps.
- The `posthog-signal` Edge Function validates `x-posthog-secret`; set this
  as a Supabase secret before deploying.
