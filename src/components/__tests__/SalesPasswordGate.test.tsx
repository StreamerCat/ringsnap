import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SalesPasswordGate } from '../SalesPasswordGate';

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), maybeSingle: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: { getSession: mocks.getSession },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }) }),
} }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/lib/auth/session', () => ({ signOutUser: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  window.history.replaceState({}, '', '/sales');
  mocks.getSession.mockResolvedValue({ data: { session: null } });
  mocks.maybeSingle.mockResolvedValue({ data: null });
});

describe('Sales access control', () => {
  it('ignores browser-controlled bot bypass flags', async () => {
    sessionStorage.setItem('ringsnap_bot_access_granted', 'true');
    window.history.replaceState({}, '', '/sales?bot_access=old-browser-secret');
    render(<SalesPasswordGate><p>Private sales content</p></SalesPasswordGate>);
    await screen.findByLabelText('Email');
    expect(screen.queryByText('Private sales content')).not.toBeInTheDocument();
  });

  it.each(['sales', 'platform_admin', 'platform_owner'])('preserves legitimate %s access', async role => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'staff' } } } });
    mocks.maybeSingle.mockResolvedValue({ data: { role } });
    render(<SalesPasswordGate><p>Private sales content</p></SalesPasswordGate>);
    await waitFor(() => expect(screen.getByText('Private sales content')).toBeVisible());
  });

  it('denies a signed-in user without a staff role', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'customer' } } } });
    render(<SalesPasswordGate><p>Private sales content</p></SalesPasswordGate>);
    await screen.findByLabelText('Email');
    expect(screen.queryByText('Private sales content')).not.toBeInTheDocument();
  });
});
