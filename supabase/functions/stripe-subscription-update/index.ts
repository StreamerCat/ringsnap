import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno&no-check";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders } from "../_shared/cors.ts";

const PLAN_KEY_TO_SECRET: Record<string, string> = {
    starter: "STRIPE_PRICE_STARTER",
    professional: "STRIPE_PRICE_PROFESSIONAL",
    premium: "STRIPE_PRICE_PREMIUM",
};

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

        const { account_id, plan_key } = await req.json();
        if (!account_id || !plan_key) throw new Error('Missing params');

        const secretName = PLAN_KEY_TO_SECRET[plan_key];
        const priceId = Deno.env.get(secretName || '');
        if (!priceId) throw new Error('Invalid plan key or missing price config');

        const { data: account } = await supabaseClient
            .from('accounts')
            .select('stripe_subscription_id, plan_type')
            .eq('id', account_id)
            .single();

        if (!account?.stripe_subscription_id) throw new Error('No active subscription to update');

        const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
            apiVersion: '2023-10-16',
            httpClient: Stripe.createFetchHttpClient(),
        });

        const subscription = await stripe.subscriptions.retrieve(account.stripe_subscription_id);
        const itemId = subscription.items.data[0].id;

        await stripe.subscriptions.update(account.stripe_subscription_id, {
            items: [{ id: itemId, price: priceId }],
            proration_behavior: 'always_invoice', // Charge immediately for upgrade difference
        });

        // Update local DB immediately for UI responsiveness
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        await supabaseAdmin.from('accounts').update({ plan_type: plan_key }).eq('id', account_id);

        return new Response(JSON.stringify({ success: true }), {
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
