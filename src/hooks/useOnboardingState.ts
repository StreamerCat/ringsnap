
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type OnboardingState = {
    provisioning_status: string;
    has_active_primary_number: boolean;
    primary_phone_number_id: string | null;
    primary_phone_number: string | null;
    activated_at: string | null;
    test_call_detected: boolean;
    forwarding_confirmed: boolean;
    forwarding_verify_started_at: string | null;
    recommended_next_step: 'provisioning' | 'test_call' | 'forwarding' | 'verify' | 'complete';
};

export const useOnboardingState = (accountId: string | null) => {
    const [state, setState] = useState<OnboardingState | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const fetchState = useCallback(async () => {
        if (!accountId) return;

        try {
            setLoading(true);
            const { data, error } = await supabase
                .rpc('get_onboarding_state', { p_account_id: accountId });

            if (error) throw error;

            // Cast the JSONB response to our type
            setState(data as unknown as OnboardingState);
            setError(null);
        } catch (err) {
            console.error('Error fetching onboarding state:', err);
            setError(err as Error);
        } finally {
            setLoading(false);
        }
    }, [accountId]);

    useEffect(() => {
        fetchState();
    }, [fetchState]);

    const trackEvent = useCallback(async (eventName: string, metadata: any = {}) => {
        try {
            await supabase.rpc('track_onboarding_event', {
                p_event_name: eventName,
                p_metadata: metadata
            });
        } catch (err) {
            // Fail silently as per requirements
            console.warn('Failed to track onboarding event:', err);
        }
    }, []);

    return {
        state,
        loading,
        error,
        refreshState: fetchState,
        trackEvent
    };
};
