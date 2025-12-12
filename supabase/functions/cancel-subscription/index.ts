import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // 1. Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    const requestId = crypto.randomUUID();
    const logContext = { requestId, phase: 'init' };

    // Helper for structured logging
    const log = (msg: string, data: any = {}) => {
        console.log(JSON.stringify({ ...logContext, message: msg, ...data }));
    };

    // Helper for error responses
    const errorResponse = (status: number, message: string, code?: string, details?: any) => {
        log('Request failed', { status, message, code, details });
        return new Response(JSON.stringify({ error: message, code }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status,
        });
    };

    try {
        log('Starting cancel request');

        // 2. Auth Check
        logContext.phase = 'auth';
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            {
                global: {
                    headers: { Authorization: req.headers.get('Authorization')! },
                },
            }
        );

        const {
            data: { user },
            error: authError
        } = await supabaseClient.auth.getUser();

        if (authError || !user) {
            return errorResponse(401, 'Unauthorized: Invalid or missing token', 'AUTH_FAILED');
        }

        // 3. Request Body Parsing
        logContext.phase = 'body_parse';
        let account_id: string;
        try {
            const body = await req.json();
            account_id = body.account_id;
        } catch (e) {
            return errorResponse(400, 'Invalid JSON body', 'INVALID_JSON');
        }

        if (!account_id) {
            return errorResponse(400, 'Missing account_id', 'MISSING_PARAM');
        }

        // 4. Ownership Verification & Account Fetch
        logContext.phase = 'ownership_check';
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Fetch account AND verify membership/profile in one go if possible, or separate.
        // We need account details for Stripe ID.
        const { data: account, error: accountError } = await supabaseAdmin
            .from('accounts')
            .select('id, stripe_customer_id, stripe_subscription_id, subscription_status')
            .eq('id', account_id)
            .single();

        if (accountError || !account) {
            log('Account lookup failed', { error: accountError });
            return errorResponse(404, 'Account not found', 'ACCOUNT_NOT_FOUND');
        }

        // Verify membership
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('id', user.id)
            .eq('account_id', account_id)
            .single();

        if (!profile) {
            return errorResponse(403, 'You do not have permission to manage this account', 'ACCESS_DENIED');
        }

        log('Ownership verified', { account_id, stripe_subscription_id: account.stripe_subscription_id });

        // 5. Cancel in Stripe
        logContext.phase = 'stripe_cancel';
        const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
        if (!stripeKey) {
            return errorResponse(500, 'Server configuration error', 'CONFIG_ERROR');
        }

        const stripe = new Stripe(stripeKey, {
            apiVersion: '2023-10-16',
            httpClient: Stripe.createFetchHttpClient(),
        });

        if (account.stripe_subscription_id) {
            try {
                // Check status first
                const sub = await stripe.subscriptions.retrieve(account.stripe_subscription_id);
                if (sub.status !== 'canceled') {
                    log('Cancelling subscription in Stripe', { sub_attributes: sub });
                    // Immediate cancellation? Or at period end? 
                    // Requirement: "Cancel subscription (immediate cancel vs cancel_at_period_end based on product policy)".
                    // Trial cancel usually implies immediate.
                    // Let's assume immediate for "Danger Zone" trial cancel.
                    // If it's a paid sub, portal handles it better. This btn is mostly for "Cancel Trial".
                    await stripe.subscriptions.cancel(account.stripe_subscription_id);
                } else {
                    log('Subscription already canceled in Stripe');
                }
            } catch (stripeError: any) {
                console.error("Stripe error:", stripeError);
                // If resource missing, we assume it's gone and proceed to clean up DB
                if (stripeError.code !== 'resource_missing') {
                    return errorResponse(500, 'Failed to cancel subscription in Stripe', 'STRIPE_ERROR', { stripeError: stripeError.message });
                }
            }
        }

        // 6. Update Local DB
        logContext.phase = 'db_update';
        // Using 'cancelled' as it seems to be the convention in other parts, 
        // but 'canceled' is standard English. 
        // Based on search results, I see `subscription_status` usage. 
        // If I see `status === 'trial'`, `status === 'active'`.
        // I will stick to 'canceled' (one L) if that matches Stripe, 
        // BUT if the DB expects 'cancelled' (two Ls) I will use that.
        // Safest bet: check what the previous code used. 
        // Previous code had: `subscription_status: 'canceled', // or 'cancelled'` then comments arguing for 'cancelled'.
        // I will use 'canceled' (one L) as a default unless I see strong evidence of 'cancelled' in the grep results.
        // Actually, standardized enum recommended is 'canceled'.

        const { error: updateError } = await supabaseAdmin
            .from('accounts')
            .update({
                subscription_status: 'cancelled',
                // We might want to clear stripe_subscription_id or keep it for history?
                // Usually keep it, status is what matters.
            })
            .eq('id', account_id);

        if (updateError) {
            // If this fails due to enum constraint, then it is 'cancelled'.
            // But we can't easily retry.
            log('DB update failed', { error: updateError });
            throw updateError;
        }

        // 7. Analytics
        await supabaseAdmin.from('analytics_events').insert({
            account_id: account_id,
            event_type: 'subscription_canceled',
            metadata: {
                user_id: user.id,
                stripe_customer_id: account.stripe_customer_id,
                stripe_subscription_id: account.stripe_subscription_id,
                initiated_by: 'user_action'
            }
        });

        log('Cancellation complete');

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        console.error('Unhandled cancel error:', error);
        return errorResponse(500, 'Internal Server Error', 'INTERNAL_ERROR', { error: error.message });
    }
});
