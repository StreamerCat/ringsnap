import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno&no-check";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Missing Auth Header');

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
        if (authError || !user) throw new Error('Unauthorized');

        const { account_id } = await req.json();
        if (!account_id) throw new Error('Missing account_id');

        const { data: account } = await supabaseClient
            .from('accounts')
            .select('stripe_subscription_id')
            .eq('id', account_id)
            .single();

        if (!account?.stripe_subscription_id) throw new Error('No subscription found');

        const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
            apiVersion: '2023-10-16',
            httpClient: Stripe.createFetchHttpClient(),
        });

        // Cancel at period end usually preferred for paid subs, but user requirements might imply immediate?
        // Let's do at period end to prevent accidental service loss.
        // User said: "stripe-subscription-cancel: cancels subscription"
        // And "Keep 'Open Stripe Portal' as a fallback".
        // Usually safer to cancel at period end.

        await stripe.subscriptions.update(account.stripe_subscription_id, {
            cancel_at_period_end: true,
        });

        return new Response(JSON.stringify({ success: true, message: 'Subscription will cancel at end of period' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
