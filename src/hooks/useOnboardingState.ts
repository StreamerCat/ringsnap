/**
 * Hook for server-side onboarding state management
 * 
 * Uses get_onboarding_state RPC for deterministic state computation
 * and track_onboarding_event for event tracking.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import * as Sentry from '@sentry/react';

export interface OnboardingState {
    provisioning_status: string | null;
    has_active_primary_number: boolean;
    primary_phone_number_id: string | null;
    primary_phone_number: string | null;
    activated_at: string | null;
    test_call_detected: boolean;
    test_call_verified_at: string | null;
    forwarding_confirmed: boolean;
    forwarding_verify_started_at: string | null;
    onboarding_completed_at: string | null;
    recommended_next_step: 'provisioning' | 'test_call' | 'forwarding' | 'complete';
}

interface UseOnboardingStateResult {
    state: OnboardingState | null;
    loading: boolean;
    error: Error | null;
    refreshState: () => Promise<void>;
    trackEvent: (eventName: string, metadata?: Record<string, unknown>) => Promise<boolean>;
}

export function useOnboardingState(accountId: string | null): UseOnboardingStateResult {
    const [state, setState] = useState<OnboardingState | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const refreshState = useCallback(async () => {
        if (!accountId) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const { data, error: rpcError } = await supabase.rpc('get_onboarding_state', {
                p_account_id: accountId,
            });

            if (rpcError) {
                throw new Error(rpcError.message);
            }

            if (data?.error) {
                throw new Error(data.error);
            }

            setState(data as OnboardingState);
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            setError(error);
            Sentry.captureException(error, {
                tags: { hook: 'useOnboardingState', action: 'refreshState' },
                extra: { accountId },
            });
        } finally {
            setLoading(false);
        }
    }, [accountId]);

    const trackEvent = useCallback(async (
        eventName: string,
        metadata: Record<string, unknown> = {}
    ): Promise<boolean> => {
        try {
            const { data, error: rpcError } = await supabase.rpc('track_onboarding_event', {
                p_event_name: eventName,
                p_metadata: metadata,
            });

            if (rpcError) {
                throw new Error(rpcError.message);
            }

            if (data?.error) {
                throw new Error(data.error);
            }

            return true;
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            Sentry.captureException(error, {
                tags: { hook: 'useOnboardingState', action: 'trackEvent' },
                extra: { eventName, metadata },
            });
            return false;
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        refreshState();
    }, [refreshState]);

    // Set up polling for state changes with backoff
    useEffect(() => {
        // Stop polling if completely finished or if we have a verified test call (RPC handles persistence, so we can relax)
        // Actually, we should poll until recommended_next_step advances or we are complete.
        if (!state) return;

        // Stop condition: Onboarding complete
        if (state.onboarding_completed_at) {
            return;
        }

        // Also stop if recommended_step is complete (though onboarding_completed_at is the ultimate source)
        if (state.recommended_next_step === 'complete') {
            return;
        }

        let timeoutId: ReturnType<typeof setTimeout>;
        let attempt = 0;

        const poll = async () => {
            // Adaptive backoff: 5s initially, then 10s after 12 attempts (1 min), capped at 15s
            const interval = attempt < 12 ? 5000 : (attempt < 24 ? 10000 : 15000);

            timeoutId = setTimeout(async () => {
                attempt++;
                await refreshState();
                // Schedule next poll
                poll();
            }, interval);
        };

        poll();

        return () => {
            if (timeoutId) clearTimeout(timeoutId);
        };
        // Re-run poll setup only if completion state changes, not on every state update to avoid reset backoff
        // However, if we put [state.onboarding_completed_at] it might not update frequently enough if we don't poll.
        // We rely on refreshState being stable.
        // Actually, simple interval with state check inside is safer for React hooks unless we use a ref.
    }, [state?.onboarding_completed_at, state?.recommended_next_step, refreshState]);

    // Track state transitions
    useEffect(() => {
        if (!state) return;

        // Example: Log when test call is first verified
        if (state.test_call_verified_at && !state.test_call_detected) {
            // This case might happen if we miss the exact transition frame, but RPC handles event verification.
            // Client-side logging is just for debugging visibility if needed.
            Sentry.addBreadcrumb({
                category: 'onboarding',
                message: 'Test call verified',
                level: 'info',
                data: { verified_at: state.test_call_verified_at }
            });
        }
    }, [state?.test_call_verified_at]);

    return {
        state,
        loading,
        error,
        refreshState,
        trackEvent,
    };
}
