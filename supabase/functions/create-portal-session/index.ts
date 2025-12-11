
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?target=deno";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            {
                global: {
                    headers: { Authorization: req.headers.get("Authorization")! },
                },
            }
        );

        const {
            data: { user },
        } = await supabaseClient.auth.getUser();

        if (!user) {
            throw new Error("Unauthorized");
        }

        // Get the account associated with the user
        // We get this via the profile -> account link
        const { data: profile } = await supabaseClient
            .from("profiles")
            .select("account_id")
            .eq("id", user.id)
            .single();

        if (!profile?.account_id) {
            throw new Error("No account found for user");
        }

        // Determine the return URL (dashboard)
        const origin = req.headers.get("origin") || "https://app.ringsnap.ai"; // Fallback if origin missing (unlikely from browser)
        const returnUrl = `${origin}/dashboard`;

        // Initialize Supabase Admin client to read sensitive account data (stripe keys) if needed, 
        // though RLS might restrict reading stripe_customer_id from client, edge function is usually service role or user context.
        // However, we need the SERVICE ROLE key to create a supabase client that can read stripe_customer_id 
        // if RLS policies hide it, OR we just trust the user context if RLS allows reading own account.
        // Safest is to use service role for the DB lookup inside the function.
        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const { data: account, error: accountError } = await supabaseAdmin
            .from("accounts")
            .select("stripe_customer_id")
            .eq("id", profile.account_id)
            .single();

        if (accountError || !account) {
            console.error("Account fetch error:", accountError);
            throw new Error("Failed to fetch account details");
        }

        if (!account.stripe_customer_id) {
            // Start of logic for "no stripe customer yet" - maybe created manually?
            // For now, just error out.
            throw new Error("No Stripe customer found for this account");
        }

        const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") as string, {
            apiVersion: "2023-10-16",
            httpClient: Stripe.createFetchHttpClient(),
        });

        const session = await stripe.billingPortal.sessions.create({
            customer: account.stripe_customer_id,
            return_url: returnUrl,
        });

        return new Response(JSON.stringify({ url: session.url }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });

    } catch (error: any) {
        console.error(error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});
