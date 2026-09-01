/**
 * useOnboardingGuard Hook
 * 
 * Single source of truth for onboarding route guard logic.
 * Rule: If onboarding_completed_at IS NULL, redirect to /activation.
 * 
 * Uses kill switch: featureFlags.onboardingGuardEnabled
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { featureFlags } from '@/lib/featureFlags';

interface OnboardingGuardState {
    isLoading: boolean;
    isOnboardingComplete: boolean;
    accountId: string | null;
    onboardingCompletedAt: string | null;
}

interface UseOnboardingGuardOptions {
    /** If true, redirect to /activation when onboarding is incomplete */
    redirectToActivation?: boolean;
    /** If true, redirect to /dashboard when onboarding is complete */
    redirectToDashboard?: boolean;
}

export function useOnboardingGuard(options: UseOnboardingGuardOptions = {}): OnboardingGuardState {
    const navigate = useNavigate();
    const { redirectToActivation = false, redirectToDashboard = false } = options;

    const [state, setState] = useState<OnboardingGuardState>({
        isLoading: true,
        isOnboardingComplete: false,
        accountId: null,
        onboardingCompletedAt: null,
    });

    const checkOnboardingStatus = useCallback(async () => {
        try {
            // Skip guard entirely if kill switch is disabled
            if (!featureFlags.onboardingGuardEnabled) {
                setState({
                    isLoading: false,
                    isOnboardingComplete: true, // Treat as complete when guard disabled
                    accountId: null,
                    onboardingCompletedAt: null,
                });
                return;
            }

            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setState(s => ({ ...s, isLoading: false }));
                return;
            }

            // Get profile with account
            const { data: profile } = await supabase
                .from('profiles')
                .select('account_id')
                .eq('id', user.id)
                .single();

            if (!profile?.account_id) {
                setState(s => ({ ...s, isLoading: false }));
                return;
            }

            // Get account onboarding state
            const { data: account } = await supabase
                .from('accounts')
                .select('onboarding_completed_at, provisioning_status')
                .eq('id', profile.account_id)
                .single();

            const isComplete = !!account?.onboarding_completed_at;

            // A phone number must actually be provisioned before there's
            // anything for the user to do in /activation (test call,
            // forwarding). While provisioning is pending/paused (or failed),
            // send them into the dashboard instead — it already renders
            // ProvisioningBanner / AgentActivationPending for those states.
            // Forcing /activation here would trap the user: it has no real
            // number to test against, and its own "skip"/"continue" actions
            // never set onboarding_completed_at, so they'd just bounce back.
            const hasProvisionedNumber = account?.provisioning_status === 'completed'
                || account?.provisioning_status === 'active';

            setState({
                isLoading: false,
                isOnboardingComplete: isComplete,
                accountId: profile.account_id,
                onboardingCompletedAt: account?.onboarding_completed_at || null,
            });

            // Handle redirects based on options
            if (redirectToActivation && !isComplete && hasProvisionedNumber && featureFlags.onboardingGuardEnabled) {
                navigate('/activation', { replace: true });
            }

            if (redirectToDashboard && isComplete) {
                navigate('/dashboard', { replace: true });
            }
        } catch (error) {
            console.error('[useOnboardingGuard] Error checking status:', error);
            setState(s => ({ ...s, isLoading: false }));
        }
    }, [navigate, redirectToActivation, redirectToDashboard]);

    useEffect(() => {
        checkOnboardingStatus();
    }, [checkOnboardingStatus]);

    return state;
}
