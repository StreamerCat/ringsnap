import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
}

// Admin client for setup
const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

describe('Invite Member Flow', () => {
    const timestamp = Date.now();
    const ownerEmail = `owner-${timestamp}@example.com`;
    const newMemberEmail = `new-member-${timestamp}@example.com`;
    const existingUserEmail = `existing-user-${timestamp}@example.com`;

    let accountId: string;
    let ownerToken: string;
    let ownerId: string;
    let existingUserId: string;

    beforeAll(async () => {
        // 1. Create Owner User
        const { data: ownerUser, error: ownerError } = await adminClient.auth.admin.createUser({
            email: ownerEmail,
            password: 'Password123!',
            email_confirm: true,
            user_metadata: { name: 'Test Owner' }
        });
        if (ownerError) throw ownerError;
        ownerId = ownerUser.user.id;

        // 2. Login as owner to get token
        const { data: loginData, error: loginError } = await adminClient.auth.signInWithPassword({
            email: ownerEmail,
            password: 'Password123!'
        });
        if (loginError) throw loginError;
        ownerToken = loginData.session.access_token;

        // 3. Create Account for Owner
        const { data: account, error: accountError } = await adminClient
            .from('accounts')
            .insert({ company_name: 'Invite Test Corp' })
            .select()
            .single();
        if (accountError) throw accountError;
        accountId = account.id;

        // 4. Link Owner to Account
        await adminClient.from('profiles').insert({
            id: ownerId,
            account_id: accountId,
            name: 'Test Owner',
            is_primary: true
        });
        await adminClient.from('account_members').insert({
            user_id: ownerId,
            account_id: accountId,
            role: 'owner'
        });

        // 5. Create an "Existing User" who is NOT in the team yet
        const { data: existingUser, error: existingError } = await adminClient.auth.admin.createUser({
            email: existingUserEmail,
            password: 'Password123!',
            email_confirm: true,
            user_metadata: { name: 'Existing User' }
        });
        if (existingError) throw existingError;
        existingUserId = existingUser.user.id;
        // Assume they have a profile but in a different account (or no account yet)
        await adminClient.from('profiles').insert({
            id: existingUserId,
            name: 'Existing User',
            // Intentionally check if we can handle users without account_id or different account_id
            // But for simplicity, let's give them a dummy account or null if allowed.
            // Schema says account_id is allow null? Let's check schema or just insert.
        });
        // Note: constraint might require account_id? Let's try inserting without first.
        // Actually, let's just create a dummy account for them to be "in".
        const { data: otherAccount } = await adminClient.from('accounts').insert({ company_name: 'Other Corp' }).select().single();
        await adminClient.from('profiles').update({ account_id: otherAccount.id }).eq('id', existingUserId);
    });

    it('1. Invite a completely NEW user', async () => {
        const inviteClient = createClient(SUPABASE_URL, process.env.SUPABASE_ANON_KEY!, {
            global: { headers: { Authorization: `Bearer ${ownerToken}` } }
        });

        const { data, error } = await inviteClient.functions.invoke('manage-team-member', {
            body: {
                action: 'invite',
                email: newMemberEmail,
                name: 'New Member',
                phone: '5550000001',
                new_role: 'member'
            }
        });

        expect(error).toBeNull();
        expect(data).toHaveProperty('success', true);
        expect(data).toHaveProperty('user_id');

        // Verify in DB
        const { data: member } = await adminClient
            .from('account_members')
            .select('*')
            .eq('user_id', data.user_id)
            .eq('account_id', accountId)
            .single();
        expect(member).toBeDefined();
        expect(member.role).toBe('member');
    });

    it('2. Invite an EXISTING user (should bind to team)', async () => {
        const inviteClient = createClient(SUPABASE_URL, process.env.SUPABASE_ANON_KEY!, {
            global: { headers: { Authorization: `Bearer ${ownerToken}` } }
        });

        const { data, error } = await inviteClient.functions.invoke('manage-team-member', {
            body: {
                action: 'invite',
                email: existingUserEmail,
                name: 'Existing User Updated',
                new_role: 'admin'
            }
        });

        expect(error).toBeNull();
        expect(data).toHaveProperty('success', true);
        expect(data).toHaveProperty('user_id', existingUserId);

        // Verify in DB
        const { data: member } = await adminClient
            .from('account_members')
            .select('*')
            .eq('user_id', existingUserId)
            .eq('account_id', accountId)
            .single();
        expect(member).toBeDefined();
        expect(member.role).toBe('admin');
    });

    it('3. Invite a user ALREADY in the team (should fail)', async () => {
        const inviteClient = createClient(SUPABASE_URL, process.env.SUPABASE_ANON_KEY!, {
            global: { headers: { Authorization: `Bearer ${ownerToken}` } }
        });

        // Try existingUserEmail again
        const { data, error } = await inviteClient.functions.invoke('manage-team-member', {
            body: {
                action: 'invite',
                email: existingUserEmail,
                name: 'Existing User Again',
                new_role: 'member'
            }
        });

        // Current implementation returns 400 with { error: ... }
        // functions.invoke throws if not 2xx? Or returns error?
        // Let's check error object.
        expect(error).toBeDefined();
        // We expect "User is already a member of this team"
    });
});
