/**
 * Tests for ProvisioningStatus redirect logic
 * Verifies strict provisioning_status='completed' check and legacy fallback
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

// Mock Supabase
const mockSupabaseSelect = vi.fn();
const mockSupabaseFrom = vi.fn(() => ({
    select: mockSupabaseSelect,
}));

vi.mock('@/integrations/supabase/client', () => ({
    supabase: {
        auth: {
            getSession: vi.fn().mockResolvedValue({
                data: { session: { user: { id: 'test-user' } } },
                error: null,
            }),
        },
        from: mockSupabaseFrom,
    },
}));

// Mock Sentry
vi.mock('@sentry/react', () => ({
    addBreadcrumb: vi.fn(),
    captureException: vi.fn(),
}));

// Helper to mock account data
function mockAccount(data: Record<string, unknown>) {
    mockSupabaseSelect.mockImplementation((fields: string) => {
        if (fields.includes('account_id')) {
            // Profile query
            return {
                eq: () => ({
                    single: () => Promise.resolve({
                        data: { account_id: 'test-account' },
                        error: null,
                    }),
                }),
            };
        }
        if (fields.includes('provisioning_status')) {
            // Account query
            return {
                eq: () => ({
                    single: () => Promise.resolve({
                        data: {
                            provisioning_status: data.provisioning_status || 'pending',
                            vapi_phone_number: data.vapi_phone_number || null,
                            vapi_assistant_id: data.vapi_assistant_id || null,
                        },
                        error: null,
                    }),
                }),
            };
        }
        if (fields.includes('activated_at')) {
            // Phone numbers query
            return {
                eq: () => ({
                    eq: () => ({
                        single: () => Promise.resolve({
                            data: data.phoneRecord || null,
                            error: null,
                        }),
                    }),
                }),
            };
        }
        return { eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) };
    });
}

describe('ProvisioningStatus redirect logic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('redirects when provisioning_status is completed', async () => {
        mockAccount({
            provisioning_status: 'completed',
            vapi_phone_number: '+15551234567',
            vapi_assistant_id: 'asst_123',
        });

        // Import component after mocks are set up
        const { ProvisioningStatus } = await import('@/pages/ProvisioningStatus');
        render(
            <BrowserRouter>
                <ProvisioningStatus />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(
                expect.stringMatching(/\/(activation|dashboard)/),
                expect.objectContaining({ replace: true })
            );
        });
    });

    it('does NOT redirect when only vapi_phone_number exists (status still pending)', async () => {
        mockAccount({
            provisioning_status: 'pending',
            vapi_phone_number: '+15551234567',
            vapi_assistant_id: 'asst_123',
        });

        const { ProvisioningStatus } = await import('@/pages/ProvisioningStatus');
        render(
            <BrowserRouter>
                <ProvisioningStatus />
            </BrowserRouter>
        );

        // Wait for polling to happen
        await vi.advanceTimersByTimeAsync(6000);

        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('redirects via legacy fallback when phone_numbers has active primary with activated_at', async () => {
        mockAccount({
            provisioning_status: 'pending',
            vapi_phone_number: null,
            phoneRecord: {
                phone_number: '+15551234567',
                status: 'active',
                is_primary: true,
                activated_at: '2025-12-21T00:00:00Z',
            },
        });

        const { ProvisioningStatus } = await import('@/pages/ProvisioningStatus');
        render(
            <BrowserRouter>
                <ProvisioningStatus />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalled();
        });
    });

    it('does NOT redirect when phone_numbers is active but activated_at is null', async () => {
        mockAccount({
            provisioning_status: 'pending',
            vapi_phone_number: null,
            phoneRecord: {
                phone_number: '+15551234567',
                status: 'active',
                is_primary: true,
                activated_at: null, // Missing!
            },
        });

        const { ProvisioningStatus } = await import('@/pages/ProvisioningStatus');
        render(
            <BrowserRouter>
                <ProvisioningStatus />
            </BrowserRouter>
        );

        // Wait for polling
        await vi.advanceTimersByTimeAsync(6000);

        expect(mockNavigate).not.toHaveBeenCalled();
    });
});
