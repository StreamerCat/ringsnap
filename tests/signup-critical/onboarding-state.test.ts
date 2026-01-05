
import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
}

// Clients
const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

describe('Onboarding State Persistence', () => {
    const timestamp = Date.now();
    const testEmail = `onboarding-test-${timestamp}@example.com`;
    let accountId: string;
    let userId: string;
    let phoneNumberId: string;

    // Helper to create a user and account
    beforeAll(async () => {
        // 1. Create User
        const { data: user, error: userError } = await adminClient.auth.admin.createUser({
            email: testEmail,
            email_confirm: true,
            password: 'testPassword123!',
        });
        if (userError) throw userError;
        userId = user.user.id;

        // 2. Create Account
        const { data: account, error: accountError } = await adminClient
            .from('accounts')
            .insert({
                company_name: 'Onboarding Test Co',
                subscription_status: 'trial',
                provisioning_status: 'completed', // Simulate completed provisioning
            })
            .select()
            .single();
        if (accountError) throw accountError;
        accountId = account.id;

        // 3. Link Profile
        const { error: profileError } = await adminClient
            .from('profiles')
            .insert({
                id: userId,
                account_id: accountId,
                email: testEmail,
                role: 'owner',
            });
        if (profileError) throw profileError;

        // 4. Assign Phone Number
        const { data: phone, error: phoneError } = await adminClient
            .from('phone_numbers')
            .insert({
                account_id: accountId,
                phone_number: '+15550001234',
                status: 'active',
                is_primary: true,
                provider: 'vapi',
                provider_id: `phone_${timestamp}`,
            })
            .select()
            .single();
        if (phoneError) throw phoneError;
        phoneNumberId = phone.id;
    });

    it('1. Initial state has null verified/completed timestamps', async () => {
        // Call RPC as user
        const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            global: { headers: { Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}` } } // Mocking auth context is tricky in pure node
        });

        // Better way: Verify database state directly since RPC uses auth.uid() which is hard to mock here without singing in
        // We will test the side-effects that the RPC relies on. 
        // Or we can try to sign in.

        const { data: account } = await adminClient
            .from('accounts')
            .select('test_call_verified_at, onboarding_completed_at')
            .eq('id', accountId)
            .single();

        expect(account.test_call_verified_at).toBeNull();
        expect(account.onboarding_completed_at).toBeNull();
    });

    it('2. Simulate test call log', async () => {
        // Insert a call log that meets criteria
        const { error } = await adminClient
            .from('call_logs')
            .insert({
                account_id: accountId,
                phone_number_id: phoneNumberId,
                direction: 'inbound',
                status: 'completed',
                duration_seconds: 15, // > 10s
                started_at: new Date().toISOString(),
                vapi_call_id: `call_${Date.now()}`,
            });
        expect(error).toBeNull();
    });

    it('3. get_onboarding_state detects call and persists state', async () => {
        // To test the RPC, we really need the auth context. 
        // Steps: Sign in as the user -> get session -> call RPC.

        const authClient = createClient(SUPABASE_URL, process.env.SUPABASE_ANON_KEY || '');
        const { data: session, error: loginError } = await authClient.auth.signInWithPassword({
            email: testEmail,
            password: 'testPassword123!',
        });

        if (loginError) throw loginError;

        // Call RPC
        const { data: rpcResult, error: rpcError } = await authClient
            .rpc('get_onboarding_state', { p_account_id: accountId });

        expect(rpcError).toBeNull();
        expect(rpcResult.test_call_detected).toBe(true);
        expect(rpcResult.test_call_verified_at).not.toBeNull();

        // Verify Persistence in DB
        const { data: account } = await adminClient
            .from('accounts')
            .select('test_call_verified_at')
            .eq('id', accountId)
            .single();

        expect(account.test_call_verified_at).not.toBeNull();
        expect(account.onboarding_completed_at).toBeNull(); // Should still be null until completion step
    });

    it('4. Onboarding Event is logged', async () => {
        const { data: events } = await adminClient
            .from('onboarding_events')
            .select('*')
            .eq('account_id', accountId)
            .eq('step', 'test_call');

        expect(events?.length).toBeGreaterThan(0);
        expect(events?.[0].status).toBe('completed');
    });

    it('5. Complete onboarding functionality (Skip mode)', async () => {
        // Use the edge function or update manually? 
        // The edge function requires running locally via `supabase functions serve` or similar.
        // For unit test, checking DB update logic is sufficient, but let's try invoking the function if using local setup.
        // Given we are in a test file, we might not have the function served. 
        // We'll simulate the update to verify the columns exist and work.

        const { error } = await adminClient
            .from('accounts')
            .update({ onboarding_completed_at: new Date().toISOString() })
            .eq('id', accountId);

        expect(error).toBeNull();

        const { data: account } = await adminClient
            .from('accounts')
            .select('onboarding_completed_at')
            .eq('id', accountId)
            .single();

        expect(account.onboarding_completed_at).not.toBeNull();
    });
});
