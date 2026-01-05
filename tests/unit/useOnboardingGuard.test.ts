
import { renderHook, act } from '@testing-library/react';
import { useOnboardingGuard } from '../../src/hooks/useOnboardingGuard';
import { supabase } from '../../src/integrations/supabase/client';
import { featureFlags } from '../../src/lib/featureFlags';
import { useNavigate } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mocks
vi.mock('../../src/integrations/supabase/client', () => ({
    supabase: {
        auth: {
            getUser: vi.fn(),
        },
        from: vi.fn(),
    },
}));

vi.mock('../../src/lib/featureFlags', () => ({
    featureFlags: {
        onboardingGuardEnabled: true,
    },
}));

vi.mock('react-router-dom', () => ({
    useNavigate: vi.fn(),
}));

describe('useOnboardingGuard', () => {
    const navigateMock = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        (useNavigate as any).mockReturnValue(navigateMock);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should redirect to /activation if onboarding is incomplete and guard is enabled', async () => {
        // Mock user and profile
        (supabase.auth.getUser as any).mockResolvedValue({ data: { user: { id: 'user123' } } });

        // Mock chain: from('profiles').select()...
        const singleAccountMock = vi.fn();
        const eqAccountMock = vi.fn().mockReturnValue({ single: singleAccountMock });
        const selectAccountMock = vi.fn().mockReturnValue({ eq: eqAccountMock });
        const fromAccountMock = vi.fn().mockReturnValue({ select: selectAccountMock });

        // Mock chain: from('profiles')...
        const singleProfileMock = vi.fn().mockResolvedValue({ data: { account_id: 'acc123' } });
        const eqProfileMock = vi.fn().mockReturnValue({ single: singleProfileMock });
        const selectProfileMock = vi.fn().mockReturnValue({ eq: eqProfileMock });
        const fromProfileMock = vi.fn().mockReturnValue({ select: selectProfileMock });

        // Setup from implementation
        (supabase.from as any).mockImplementation((table: string) => {
            if (table === 'profiles') return { select: selectProfileMock };
            if (table === 'accounts') return { select: selectAccountMock };
            return {};
        });

        // Mock incomplete account
        singleAccountMock.mockResolvedValue({ data: { onboarding_completed_at: null } });

        const { waitForNextUpdate } = renderHook(() =>
            useOnboardingGuard({ redirectToActivation: true })
        );

        await waitForNextUpdate();

        expect(navigateMock).toHaveBeenCalledWith('/activation', { replace: true });
    });

    it('should NOT redirect if guard is disabled', async () => {
        // Disable guard
        (featureFlags as any).onboardingGuardEnabled = false;

        renderHook(() => useOnboardingGuard({ redirectToActivation: true }));

        // Should behave as if complete immediately or just loading false
        // Implementation: if (!featureFlags.onboardingGuardEnabled) { ... isOnboardingComplete: true ... }

        expect(navigateMock).not.toHaveBeenCalled();
    });

    it('should redirect to /dashboard if onboarding is complete', async () => {
        // Re-enable guard
        (featureFlags as any).onboardingGuardEnabled = true;

        (supabase.auth.getUser as any).mockResolvedValue({ data: { user: { id: 'user123' } } });

        // Mock profile -> account
        const singleProfileMock = vi.fn().mockResolvedValue({ data: { account_id: 'acc123' } });
        const eqProfileMock = vi.fn().mockReturnValue({ single: singleProfileMock });
        const selectProfileMock = vi.fn().mockReturnValue({ eq: eqProfileMock });

        // Mock complete account
        const singleAccountMock = vi.fn().mockResolvedValue({ data: { onboarding_completed_at: '2025-01-01T00:00:00Z' } });
        const eqAccountMock = vi.fn().mockReturnValue({ single: singleAccountMock });
        const selectAccountMock = vi.fn().mockReturnValue({ eq: eqAccountMock });

        (supabase.from as any).mockImplementation((table: string) => {
            if (table === 'profiles') return { select: selectProfileMock };
            if (table === 'accounts') return { select: selectAccountMock };
            return {};
        });

        const { waitForNextUpdate } = renderHook(() =>
            useOnboardingGuard({ redirectToDashboard: true })
        );

        await waitForNextUpdate();

        expect(navigateMock).toHaveBeenCalledWith('/dashboard', { replace: true });
    });
});
