import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno&no-check";
import { createClient } from "supabase";
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

        const { account_id, payment_method_id } = await req.json();
        if (!account_id || !payment_method_id) throw new Error('Missing params');

        const { data: account } = await supabaseClient
            .from('accounts')
            .select('stripe_customer_id')
            .eq('id', account_id)
            .single();

        if (!account?.stripe_customer_id) throw new Error('No Stripe customer found');

        const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
            apiVersion: '2023-10-16',
            httpClient: Stripe.createFetchHttpClient(),
        });

        // Attach to customer
        await stripe.paymentMethods.attach(payment_method_id, {
            customer: account.stripe_customer_id,
        });

        // Set as default
        await stripe.customers.update(account.stripe_customer_id, {
            invoice_settings: {
                default_payment_method: payment_method_id,
            },
        });

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
