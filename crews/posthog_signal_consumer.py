"""
PostHog Signal Consumer for RingSnap CrewAI Integration

Polls the posthog_signals table for pending signals and routes them to the
appropriate CrewAI crew based on the crew_target field.

Architecture:
  PostHog workflow → posthog-signal Edge Function → posthog_signals table
    → THIS SCRIPT polls (max every 15 min) → routes to crew → writes crew_events

IMPORTANT: Do not tighten the polling interval below 15 minutes in Phase 1.
Expected daily signal volume is ≤ 34; current rate limit is 20/signal_type/hour.
"""

import os
import time
from datetime import datetime, timezone

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

# Phase 1: 15-minute polling interval. Do not reduce below 900 seconds.
POLL_INTERVAL_SECONDS = 900

# Map crew_target values to crew implementations.
# Stub entries (None) are placeholders — wire actual CrewAI crew classes here
# as they are built. The consumer handles None stubs gracefully.
CREW_ROUTER: dict = {
    "recovery_crew": None,          # stub — wire RecoveryCrew class here
    "onboarding_crew": None,        # stub — wire OnboardingCrew class here
    "founder_reporting_crew": None, # stub — wire FounderReportingCrew class here
    "abuse_detection_crew": None,   # stub — wire AbuseDetectionCrew class here
}


def route_signal(signal: dict) -> dict | None:
    """
    Route a signal to the appropriate CrewAI crew.

    Returns a result dict to store as output_payload in crew_events,
    or None if routing fails (crew not registered).

    When a real crew is wired:
        crew = CREW_ROUTER[crew_target]
        result = crew.kickoff(inputs=signal["payload"])
        return {"status": "completed", "output": result}
    """
    crew_target = signal["crew_target"]
    crew = CREW_ROUTER.get(crew_target)

    if crew is None:
        print(f"[SignalConsumer] Stub route: no crew registered for '{crew_target}' — acknowledging signal")
        return {
            "stub": True,
            "crew_target": crew_target,
            "note": "Crew not yet wired. Signal acknowledged without execution.",
        }

    # When actual crew classes are wired:
    # return crew.kickoff(inputs=signal["payload"])
    return None


def process_pending_signals(supabase_client) -> int:
    """
    Fetch and process all pending signals in FIFO order.

    Returns the number of signals processed.
    """
    result = (
        supabase_client.table("posthog_signals")
        .select("*")
        .eq("status", "pending")
        .order("created_at")
        .limit(50)
        .execute()
    )

    signals = result.data or []
    now_iso = datetime.now(timezone.utc).isoformat()
    print(f"[SignalConsumer] {len(signals)} pending signal(s) at {now_iso}")

    processed = 0
    for signal in signals:
        signal_id = signal["id"]
        crew_target = signal["crew_target"]

        try:
            # 1. Mark signal as processing (prevents double-pick-up if consumer restarts)
            supabase_client.table("posthog_signals").update(
                {"status": "processing"}
            ).eq("id", signal_id).execute()

            # 2. Create crew_event record (running)
            crew_event_result = (
                supabase_client.table("crew_events")
                .insert(
                    {
                        "crew_target": crew_target,
                        "input_payload": signal["payload"],
                        "status": "running",
                        "started_at": datetime.now(timezone.utc).isoformat(),
                        "signal_id": signal_id,
                        "account_id": signal.get("entity_id")
                        if signal.get("entity_type") == "account"
                        else None,
                    }
                )
                .execute()
            )
            crew_event_id = crew_event_result.data[0]["id"]

            # 3. Route to crew
            outcome = route_signal(signal)
            completed_at = datetime.now(timezone.utc).isoformat()

            # 4. Update crew_event with outcome
            crew_status = "completed" if outcome is not None else "failed"
            supabase_client.table("crew_events").update(
                {
                    "status": crew_status,
                    "output_payload": outcome,
                    "completed_at": completed_at,
                    "error_message": None if outcome is not None else "route_signal returned None",
                }
            ).eq("id", crew_event_id).execute()

            # 5. Mark signal as completed and link to crew_event
            supabase_client.table("posthog_signals").update(
                {
                    "status": "completed",
                    "processed_at": completed_at,
                    "crew_event_id": crew_event_id,
                }
            ).eq("id", signal_id).execute()

            print(
                f"[SignalConsumer] Processed signal {signal_id} "
                f"(type={signal['signal_type']}, crew={crew_target}, "
                f"crew_event={crew_event_id}, status={crew_status})"
            )
            processed += 1

        except Exception as exc:  # pylint: disable=broad-except
            print(f"[SignalConsumer] Error processing signal {signal_id}: {exc}")
            try:
                supabase_client.table("posthog_signals").update(
                    {"status": "failed"}
                ).eq("id", signal_id).execute()
            except Exception:  # pylint: disable=broad-except
                pass  # Best-effort status update; don't mask original error

    return processed


def main() -> None:
    print(
        f"[SignalConsumer] Starting RingSnap PostHog Signal Consumer. "
        f"Poll interval: {POLL_INTERVAL_SECONDS}s ({POLL_INTERVAL_SECONDS // 60} min). "
        f"Registered crews: {[k for k, v in CREW_ROUTER.items() if v is not None]} "
        f"(stubs: {[k for k, v in CREW_ROUTER.items() if v is None]})"
    )

    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    while True:
        try:
            process_pending_signals(client)
        except Exception as exc:  # pylint: disable=broad-except
            print(f"[SignalConsumer] Unexpected error in poll loop: {exc}")

        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
