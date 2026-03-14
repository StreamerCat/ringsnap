# PostHog + CrewAI Integration

## Signal Flow

```
PostHog threshold crossed
  │
  ▼
PostHog Workflow fires webhook (INACTIVE until PostHog UI configured)
  │
  ▼  POST /functions/v1/posthog-signal
     Headers: x-posthog-secret: <POSTHOG_SIGNAL_SECRET>
     Body: { signal_type, crew_target, entity_id, entity_type, payload }
  │
  ▼
posthog-signal Edge Function (Deno)
  ├── Validates x-posthog-secret header
  ├── Validates required fields: signal_type, crew_target, payload
  ├── Dedup check: same dedup_key within 30 min? → return {deduplicated: true}
  ├── Rate limit: >20 same signal_type per hour? → return 429
  └── INSERT posthog_signals (status='pending')
  │
  ▼
posthog_signals table (Supabase)
  status: pending → processing → completed | failed
  │
  ▼
posthog_signal_consumer.py (CrewAI Python process)
  Polls every 15 minutes (900 seconds)
  ├── SELECT * FROM posthog_signals WHERE status='pending' ORDER BY created_at LIMIT 50
  ├── For each signal:
  │   ├── UPDATE posthog_signals SET status='processing'
  │   ├── INSERT crew_events (status='running', signal_id=signal.id)
  │   ├── Route to crew by crew_target
  │   ├── UPDATE crew_events (status='completed'|'failed', output_payload, completed_at)
  │   └── UPDATE posthog_signals (status='completed', processed_at, crew_event_id)
  │
  ▼
crew_events table (Supabase)
  Records crew execution inputs, outputs, timing, and status
```

**PostHog is measurement only. CrewAI is action only. They never talk directly.**
Supabase is the durable buffer between them.

---

## Workflow → Crew Mapping

| Signal Type | Crew Target | Why |
|-------------|-------------|-----|
| `checkout_failed_spike` | `recovery_crew` | Conversion drop affects revenue immediately; recovery crew alerts founder + investigates |
| `onboarding_stalled` | `onboarding_crew` | Per-user re-engagement; onboarding crew sends targeted nudge with step-specific guidance |
| `lead_gone_cold` | `recovery_crew` | Warm inbound lead didn't convert; recovery crew triggers follow-up sequence |
| `conversion_rate_anomaly` | `founder_reporting_crew` | Strategic signal; founder crew generates weekly briefing with hypotheses |
| `high_cogs_pattern` | `abuse_detection_crew` | High-spend account; abuse crew determines misuse vs. heavy user, routes to ops or upsell |

---

## posthog_signals Table Schema

```sql
CREATE TABLE public.posthog_signals (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  signal_type     text        NOT NULL,
  entity_id       text,
  entity_type     text,
  payload         jsonb       NOT NULL DEFAULT '{}',
  crew_target     text        NOT NULL,
  status          text        NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  processed_at    timestamptz,
  crew_event_id   uuid        REFERENCES public.crew_events(id),
  dedup_key       text        GENERATED ALWAYS AS
                  (signal_type || ':' || coalesce(entity_id, '')) STORED
);
```

### Status Lifecycle

```
pending
  │  (consumer picks up signal)
  ▼
processing
  │  (crew finishes or errors)
  ▼
completed  ──OR──  failed
```

A signal stuck in `processing` for > 30 minutes indicates a consumer crash.
The consumer marks `processing` signals as `failed` on restart (future
improvement — Phase 2).

---

## crew_events Table Schema

```sql
CREATE TABLE public.crew_events (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  crew_target     text        NOT NULL,
  input_payload   jsonb       NOT NULL DEFAULT '{}',
  output_payload  jsonb,
  status          text        NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  started_at      timestamptz,
  completed_at    timestamptz,
  error_message   text,
  account_id      uuid,
  signal_id       uuid        REFERENCES public.posthog_signals(id)
);
```

---

## 15-Minute Polling Cadence

The consumer is set to `POLL_INTERVAL_SECONDS = 900` (15 minutes).

**Why 15 minutes in Phase 1:**
- Expected daily signal volume is ≤ 34 signals/day across all 5 workflows
- All 5 PostHog workflows are inactive by default; real-time response is not required
- Avoids unnecessary Supabase read costs during zero-signal periods
- Supabase free tier: 500MB database, 2M row reads/month — 15-min polling uses ~100 reads/day

**When to reduce the interval:**
- After wiring actual crew implementations
- When `onboarding_stalled` fires volume justifies faster response (< 1-hour SLA)
- Phase 2 recommendation: switch to Supabase Realtime or pg_notify instead of polling

---

## Payload Shapes for All 5 Workflows

See `docs/posthog-workflows/` for complete specs. Summary:

```typescript
// checkout_failed_spike
{ total_started: number; completion_rate: number; window_start: string; window_end: string }

// onboarding_stalled
{ user_id: string; hours_since_activation: number; onboarding_step_last_completed: string | null }

// lead_gone_cold
{ call_id: string; user_id: string; plan_key: string | null }

// conversion_rate_anomaly
{ current_rate: number; prior_rate: number; delta_pct: number; period_start: string; period_end: string }

// high_cogs_pattern
{ account_id: string; long_call_count: number; period_days: 7 }
```

---

## PostHog API Access for CrewAI

For `founder_reporting_crew` scheduled digests, CrewAI can query PostHog
directly using the PostHog API:

```python
import requests

POSTHOG_API_KEY = os.environ["POSTHOG_API_KEY"]  # Server-side key
POSTHOG_PROJECT_ID = os.environ["POSTHOG_PROJECT_ID"]

def query_posthog(hogql: str) -> dict:
    """Run a HogQL query against PostHog's query API."""
    resp = requests.post(
        f"https://us.posthog.com/api/projects/{POSTHOG_PROJECT_ID}/query",
        headers={"Authorization": f"Bearer {POSTHOG_API_KEY}"},
        json={"query": {"kind": "HogQLQuery", "query": hogql}},
    )
    resp.raise_for_status()
    return resp.json()
```

SQL templates in `docs/posthog-queries/` can be used as `hogql` inputs.

---

## What Is NOT Yet Wired

As of Phase 1 implementation:

1. **Actual crew implementations** — all `CREW_ROUTER` entries are `None` stubs.
   Signals are acknowledged but not executed. Set `output_payload.stub = true`.

2. **PostHog workflows are inactive** — none of the 5 triggers have been
   configured in PostHog UI. The posthog-signal Edge Function is deployed and
   ready, but will receive zero traffic until workflows are activated.

3. **Stripe + Vapi warehouse connections** — documented in `posthog-warehouse.md`
   but require PostHog UI to connect as data sources.

4. **Consumer restart handling** — signals stuck in `processing` after a crash
   are not automatically recovered in Phase 1.

5. **Authentication for CrewAI → Supabase** — currently uses `SUPABASE_SERVICE_ROLE_KEY`
   directly. Phase 2 should use a scoped role.

---

## Next Integration Steps

1. **Activate PostHog project** — create project, copy `VITE_POSTHOG_KEY` to env
2. **Verify events flowing** — check PostHog Live Events for `page_viewed`,
   `form_started` in local dev (set VITE_POSTHOG_KEY in .env.local)
3. **Run DB migrations** — apply `20260313000001_crew_events.sql` and
   `20260313000002_posthog_signals.sql` via Supabase dashboard
4. **Deploy posthog-signal Edge Function** — `supabase functions deploy posthog-signal`
5. **Set Supabase secrets**:
   ```
   supabase secrets set POSTHOG_SIGNAL_SECRET=<random-32-chars>
   supabase secrets set POSTHOG_API_KEY=phx_...
   ```
6. **Wire first crew** — implement `RecoveryCrew` and update `CREW_ROUTER`
7. **Activate `onboarding_stalled` workflow** in PostHog UI (highest value, Phase 2)
8. **Reduce poll interval** once crews are wired and signal volume justifies it
