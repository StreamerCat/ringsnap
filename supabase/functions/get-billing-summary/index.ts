/**
 * get-billing-summary Edge Function
 * 
 * Fetches payment method details from Stripe for display in the billing tab.
 * Returns: { brand, last4, exp_month, exp_year } or null if unavailable.
 * 
 * Designed to fail soft - returns null instead of errors for missing data.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno&no-check";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface PaymentMethodInfo {
    brand: string | null;
    last4: string | null;
    exp_month: number | null;
    exp_year: number | null;
}

serve(async (req) => {
    // CORS preflight
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    const requestId = crypto.randomUUID();

    const log = (msg: string, data: any = {}) => {
        console.log(JSON.stringify({ requestId, message: msg, ...data }));
    };

    // Soft fail response - returns null payment info, not an error
    const softFailResponse = (reason: string) => {
        log(`Soft fail: ${reason}`);
        return new Response(
            JSON.stringify({
                payment_method: null,
                reason,
            }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200, // Still 200 - not an error
            }
        );
    };

    const errorResponse = (status: number, message: string) => {
        log(`Error: ${message}`, { status });
        return new Response(JSON.stringify({ error: message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status,
        });
    };

    try {
        log("Starting get-billing-summary request");

        // 1. Auth Check
        const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
        if (!authHeader) {
            return errorResponse(401, "Missing Authorization header");
        }

        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
        if (authError || !user) {
            return errorResponse(401, "Unauthorized");
        }

        // 2. Parse Request Body
        let account_id: string;
        try {
            const body = await req.json();
            account_id = body.account_id;
        } catch {
            return errorResponse(400, "Invalid JSON body");
        }

        if (!account_id) {
            return errorResponse(400, "Missing account_id");
        }

        // 3. Get Account (RLS enforced)
        const { data: account, error: accountError } = await supabaseClient
            .from("accounts")
            .select("id, stripe_customer_id")
            .eq("id", account_id)
            .single();

        if (accountError || !account) {
            return errorResponse(403, "Access denied");
        }

        // 4. Soft fail if no Stripe customer
        if (!account.stripe_customer_id) {
            return softFailResponse("No Stripe customer linked");
        }

        // 5. Check Stripe key
        const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
        if (!stripeKey) {
            return softFailResponse("Stripe not configured");
        }

        const stripe = new Stripe(stripeKey, {
            apiVersion: "2023-10-16",
            httpClient: Stripe.createFetchHttpClient(),
        });

        // 6. Fetch customer with expanded default payment method
        let customer: Stripe.Customer | Stripe.DeletedCustomer;
        try {
            customer = await stripe.customers.retrieve(account.stripe_customer_id, {
                expand: ["invoice_settings.default_payment_method"],
            });
        } catch (stripeError: any) {
            log("Stripe customer retrieval failed", { error: stripeError.message });
            return softFailResponse("Could not fetch customer from Stripe");
        }

        // Check if customer is deleted
        if ((customer as any).deleted) {
            return softFailResponse("Stripe customer has been deleted");
        }

        const activeCustomer = customer as Stripe.Customer;

        // 7. Extract payment method info
        const defaultPm = activeCustomer.invoice_settings?.default_payment_method;

        if (!defaultPm) {
            return softFailResponse("No default payment method set");
        }

        // defaultPm can be a string or expanded object
        let paymentMethod: Stripe.PaymentMethod | null = null;

        if (typeof defaultPm === "string") {
            // Need to fetch the payment method
            try {
                paymentMethod = await stripe.paymentMethods.retrieve(defaultPm);
            } catch {
                return softFailResponse("Could not fetch payment method details");
            }
        } else {
            paymentMethod = defaultPm as Stripe.PaymentMethod;
        }

        // 8. Build response
        const cardDetails = paymentMethod.card;

        if (!cardDetails) {
            return softFailResponse("Payment method is not a card");
        }

        const result: PaymentMethodInfo = {
            brand: cardDetails.brand || null,
            last4: cardDetails.last4 || null,
            exp_month: cardDetails.exp_month || null,
            exp_year: cardDetails.exp_year || null,
        };

        log("Payment method retrieved successfully", {
            brand: result.brand,
            last4: result.last4
        });

        return new Response(
            JSON.stringify({ payment_method: result }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            }
        );

    } catch (error: any) {
        console.error("Unhandled error in get-billing-summary:", error);
        // Even for unexpected errors, return soft fail for resilient UI
        return softFailResponse("Unexpected error fetching payment info");
    }
});
