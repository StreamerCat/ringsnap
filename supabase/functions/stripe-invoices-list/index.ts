import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno&no-check";
import { createClient } from "supabase";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        // Auth Check
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
        if (authError || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Get Account
        const { account_id } = await req.json();
        if (!account_id) {
            return new Response(JSON.stringify({ error: 'Missing account_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Verify access safely
        const { data: account, error: accountError } = await supabaseClient
            .from('accounts')
            .select('id, stripe_customer_id')
            .eq('id', account_id)
            .single();

        if (accountError || !account || !account.stripe_customer_id) {
            return new Response(JSON.stringify({ error: 'Account not found or no Stripe customer' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Stripe
        const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
            apiVersion: '2023-10-16',
            httpClient: Stripe.createFetchHttpClient(),
        });

        const invoices = await stripe.invoices.list({
            customer: account.stripe_customer_id,
            limit: 24,
        });

        const mappedInvoices = invoices.data.map(inv => ({
            id: inv.id,
            number: inv.number,
            created: inv.created,
            amount_paid: inv.amount_paid,
            amount_due: inv.amount_due,
            status: inv.status,
            invoice_pdf: inv.invoice_pdf,
            hosted_invoice_url: inv.hosted_invoice_url,
            period_end: inv.period_end
        }));

        return new Response(JSON.stringify({ invoices: mappedInvoices }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
