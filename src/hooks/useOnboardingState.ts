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
    forwarding_confirmed: boolean;
    forwarding_verify_started_at: string | null;
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

    // Set up polling for state changes (every 5 seconds while waiting for provisioning/test call)
    useEffect(() => {
        if (!state || state.recommended_next_step === 'complete') {
            return;
        }

        const pollInterval = setInterval(() => {
            refreshState();
        }, 5000);

        return () => clearInterval(pollInterval);
    }, [state?.recommended_next_step, refreshState]);

    return {
        state,
        loading,
        error,
        refreshState,
        trackEvent,
    };
}
