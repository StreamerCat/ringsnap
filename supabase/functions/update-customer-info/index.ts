import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?target=deno";

const FUNCTION_NAME = "update-customer-info";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Allowed roles that can update customer info
const ALLOWED_ROLES = ['platform_owner', 'platform_admin', 'sales'];

// Allowed fields that can be updated (safe fields only)
const ALLOWED_ACCOUNT_FIELDS = ['company_name', 'website', 'sales_notes'];
const ALLOWED_PROFILE_FIELDS = ['name', 'email', 'phone'];

serve(async (req) => {
    const requestId = crypto.randomUUID();

    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        // 1. Validate Authorization header
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: 'Missing authorization header' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 2. Create Supabase client with user's token (to respect RLS for auth check)
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } }
        });

        // Get authenticated user
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
        if (userError || !user) {
            console.error(`[${FUNCTION_NAME}] Auth error:`, userError);
            return new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        console.log(`[${FUNCTION_NAME}] request_id=${requestId} user_id=${user.id}`);

        // 3. Parse request body
        const { accountId, updates } = await req.json();

        if (!accountId) {
            return new Response(
                JSON.stringify({ error: 'accountId is required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 4. Check user's staff role
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

        const { data: staffRole, error: roleError } = await supabaseAdmin
            .from('staff_roles')
            .select('role')
            .eq('user_id', user.id)
            .single();

        if (roleError && roleError.code !== 'PGRST116') {
            console.error(`[${FUNCTION_NAME}] Failed to check staff role:`, roleError);
            return new Response(
                JSON.stringify({ error: 'Failed to verify permissions' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const userRole = staffRole?.role;
        if (!userRole || !ALLOWED_ROLES.includes(userRole)) {
            console.log(`[${FUNCTION_NAME}] Access denied for role: ${userRole}`);
            return new Response(
                JSON.stringify({ error: 'Access denied. Only sales and admin staff can update customer info.' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 5. For sales role, verify they are attributed to this account
        if (userRole === 'sales') {
            // Get the caller's profile name
            const { data: callerProfile, error: profileError } = await supabaseAdmin
                .from('profiles')
                .select('name')
                .eq('id', user.id)
                .single();

            if (profileError || !callerProfile?.name) {
                console.error(`[${FUNCTION_NAME}] Failed to get caller profile:`, profileError);
                return new Response(
                    JSON.stringify({ error: 'Failed to verify your profile' }),
                    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // Get the account's sales_rep_name
            const { data: account, error: accountError } = await supabaseAdmin
                .from('accounts')
                .select('sales_rep_name')
                .eq('id', accountId)
                .single();

            if (accountError) {
                console.error(`[${FUNCTION_NAME}] Failed to get account:`, accountError);
                return new Response(
                    JSON.stringify({ error: 'Account not found' }),
                    { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // Check attribution matches
            if (account.sales_rep_name !== callerProfile.name) {
                console.log(`[${FUNCTION_NAME}] Attribution mismatch: account.sales_rep_name=${account.sales_rep_name}, caller.name=${callerProfile.name}`);
                return new Response(
                    JSON.stringify({ error: 'You can only update accounts attributed to you.' }),
                    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }
        }

        // 6. Build update objects with only allowed fields
        const accountUpdates: Record<string, any> = {};
        const profileUpdates: Record<string, any> = {};

        if (updates.account) {
            for (const field of ALLOWED_ACCOUNT_FIELDS) {
                if (updates.account[field] !== undefined) {
                    accountUpdates[field] = updates.account[field];
                }
            }
        }

        if (updates.primaryContact) {
            for (const field of ALLOWED_PROFILE_FIELDS) {
                if (updates.primaryContact[field] !== undefined) {
                    profileUpdates[field] = updates.primaryContact[field];
                }
            }
        }

        // Check if there's anything to update
        if (Object.keys(accountUpdates).length === 0 && Object.keys(profileUpdates).length === 0) {
            return new Response(
                JSON.stringify({ error: 'No valid fields to update' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        console.log(`[${FUNCTION_NAME}] Updating account ${accountId}:`, { accountUpdates, profileUpdates });

        // 7. Perform updates
        const results: Record<string, any> = {};

        if (Object.keys(accountUpdates).length > 0) {
            const { error: updateError } = await supabaseAdmin
                .from('accounts')
                .update(accountUpdates)
                .eq('id', accountId);

            if (updateError) {
                console.error(`[${FUNCTION_NAME}] Failed to update account:`, updateError);
                return new Response(
                    JSON.stringify({ error: 'Failed to update account information' }),
                    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }
            results.accountUpdated = true;
        }

        if (Object.keys(profileUpdates).length > 0) {
            // Update primary contact profile
            const { error: profileUpdateError } = await supabaseAdmin
                .from('profiles')
                .update(profileUpdates)
                .eq('account_id', accountId)
                .eq('is_primary', true);

            if (profileUpdateError) {
                console.error(`[${FUNCTION_NAME}] Failed to update profile:`, profileUpdateError);
                return new Response(
                    JSON.stringify({ error: 'Failed to update primary contact information' }),
                    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }
            results.profileUpdated = true;
        }

        console.log(`[${FUNCTION_NAME}] Successfully updated customer info for account ${accountId}`);

        return new Response(
            JSON.stringify({
                success: true,
                requestId,
                ...results
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error: any) {
        console.error(`[${FUNCTION_NAME}] Unexpected error:`, error);
        return new Response(
            JSON.stringify({ error: 'An unexpected error occurred', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
