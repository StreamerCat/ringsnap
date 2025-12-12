/**
 * create-upgrade-checkout Edge Function
 * 
 * Handles plan upgrades safely:
 * 1. If stripe_subscription_id exists → Update existing subscription (no duplicate)
 * 2. If no subscription exists → Create Stripe Checkout Session
 * 
 * Request body: { account_id: string, planKey: "starter" | "professional" | "premium" }
 * 
 * CRITICAL: Never creates duplicate subscriptions!
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno&no-check";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { initSentry, captureError } from "../_shared/sentry.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Valid plan keys - must match exactly
type PlanKey = "starter" | "professional" | "premium";

// Map planKey to Supabase secret name
const PLAN_KEY_TO_SECRET: Record<PlanKey, string> = {
    starter: "STRIPE_PRICE_STARTER",
    professional: "STRIPE_PRICE_PROFESSIONAL",
    premium: "STRIPE_PRICE_PREMIUM",
};

serve(async (req) => {
    // CORS preflight
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    const requestId = crypto.randomUUID();

    // Helper for structured logging
    const log = (msg: string, data: any = {}) => {
        console.log(JSON.stringify({ requestId, message: msg, ...data }));
    };

    // Initialize Sentry for error tracking
    initSentry('create-upgrade-checkout', { correlationId: requestId });

    // Helper for error responses
    const errorResponse = (status: number, message: string, code?: string) => {
        log(`Error: ${message}`, { status, code });
        return new Response(JSON.stringify({ error: message, code }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status,
        });
    };

    try {
        log("Starting upgrade checkout request");

        // 1. Auth Check
        const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
        if (!authHeader) {
            return errorResponse(401, "Missing Authorization header", "AUTH_MISSING");
        }

        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
        if (authError || !user) {
            return errorResponse(401, "Unauthorized: Invalid token", "AUTH_FAILED");
        }

        log("User authenticated", { userId: user.id });

        // 2. Parse Request Body
        let account_id: string;
        let planKey: PlanKey;

        try {
            const body = await req.json();
            account_id = body.account_id;
            planKey = body.planKey?.toLowerCase();
        } catch {
            return errorResponse(400, "Invalid JSON body", "INVALID_JSON");
        }

        if (!account_id) {
            return errorResponse(400, "Missing account_id", "MISSING_ACCOUNT_ID");
        }

        if (!planKey || !PLAN_KEY_TO_SECRET[planKey]) {
            return errorResponse(400, `Invalid planKey: ${planKey}. Must be one of: starter, professional, premium`, "INVALID_PLAN_KEY");
        }

        log("Request parsed", { account_id, planKey });

        // 3. Verify Account Access (RLS enforced)
        const { data: account, error: accountError } = await supabaseClient
            .from("accounts")
            .select("id, stripe_customer_id, stripe_subscription_id, plan_type, company_name")
            .eq("id", account_id)
            .single();

        if (accountError || !account) {
            return errorResponse(403, "You do not have permission to upgrade this account", "ACCESS_DENIED");
        }

        log("Account verified", {
            account_id: account.id,
            stripe_customer_id: account.stripe_customer_id?.substring(0, 10) + "...",
            has_subscription: !!account.stripe_subscription_id
        });

        // 4. Validate Stripe prerequisites
        if (!account.stripe_customer_id) {
            return errorResponse(400, "This account does not have a linked Stripe customer", "NO_STRIPE_CUSTOMER");
        }

        const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
        if (!stripeKey) {
            return errorResponse(500, "Server configuration error: Missing Stripe key", "CONFIG_ERROR");
        }

        // 5. Get Stripe Price ID from secrets
        const priceSecretName = PLAN_KEY_TO_SECRET[planKey];
        const priceId = Deno.env.get(priceSecretName);

        if (!priceId) {
            log(`Missing Stripe price secret: ${priceSecretName}`);
            return errorResponse(500, `Server configuration error: Missing price for ${planKey}`, "PRICE_NOT_CONFIGURED");
        }

        log("Price ID resolved", { planKey, priceSecretName, priceId: priceId.substring(0, 15) + "..." });

        const stripe = new Stripe(stripeKey, {
            apiVersion: "2023-10-16",
            httpClient: Stripe.createFetchHttpClient(),
        });

        // 6. Decision: Update existing subscription OR create new checkout
        if (account.stripe_subscription_id) {
            // ═══════════════════════════════════════════════════════════════════════
            // EXISTING SUBSCRIPTION: Update in-place (no duplicate!)
            // ═══════════════════════════════════════════════════════════════════════
            log("Updating existing subscription", {
                subscriptionId: account.stripe_subscription_id.substring(0, 15) + "..."
            });

            try {
                // Get current subscription to find the item to update
                const subscription = await stripe.subscriptions.retrieve(account.stripe_subscription_id);

                if (!subscription || subscription.status === "canceled") {
                    // Subscription is canceled, create new checkout instead
                    log("Subscription is canceled, falling through to checkout creation");
                } else {
                    // Get the first subscription item (assuming single-product subscription)
                    const subscriptionItemId = subscription.items.data[0]?.id;

                    if (!subscriptionItemId) {
                        return errorResponse(500, "Unable to find subscription item to update", "NO_SUBSCRIPTION_ITEM");
                    }

                    // Update subscription with new price
                    // proration_behavior: 'create_prorations' gives customer credit for unused time
                    const updatedSubscription = await stripe.subscriptions.update(
                        account.stripe_subscription_id,
                        {
                            items: [{
                                id: subscriptionItemId,
                                price: priceId,
                            }],
                            proration_behavior: "create_prorations",
                        }
                    );

                    log("Subscription updated successfully", {
                        subscriptionId: updatedSubscription.id,
                        newStatus: updatedSubscription.status,
                    });

                    // Stripe webhook will update DB, but we can update plan_type immediately
                    // for faster UI feedback (webhook is source of truth for status)
                    const serviceClient = createClient(
                        Deno.env.get("SUPABASE_URL") ?? "",
                        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
                    );

                    await serviceClient
                        .from("accounts")
                        .update({
                            plan_type: planKey,
                            updated_at: new Date().toISOString(),
                        })
                        .eq("id", account_id);

                    return new Response(
                        JSON.stringify({
                            success: true,
                            message: `Plan upgraded to ${planKey}`,
                            subscription_id: updatedSubscription.id,
                        }),
                        {
                            headers: { ...corsHeaders, "Content-Type": "application/json" },
                            status: 200,
                        }
                    );
                }
            } catch (stripeError: any) {
                // If subscription retrieval/update fails, fall through to checkout
                log("Failed to update subscription, will create checkout", {
                    error: stripeError.message
                });
            }
        }

        // ═══════════════════════════════════════════════════════════════════════
        // NO SUBSCRIPTION: Create Stripe Checkout Session
        // ═══════════════════════════════════════════════════════════════════════
        log("Creating new checkout session");

        const origin = req.headers.get("origin");
        const siteUrl = Deno.env.get("SITE_URL") || "https://getringsnap.com";
        const baseUrl = origin && !origin.includes("localhost") ? origin : siteUrl;
        const successUrl = `${baseUrl}/dashboard?tab=billing&upgrade=success`;
        const cancelUrl = `${baseUrl}/dashboard?tab=billing&upgrade=canceled`;

        const session = await stripe.checkout.sessions.create({
            customer: account.stripe_customer_id,
            mode: "subscription",
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: {
                account_id: account_id,
                plan_key: planKey,
                upgrade_from: account.plan_type || "unknown",
            },
        });

        log("Checkout session created", { sessionId: session.id });

        return new Response(
            JSON.stringify({ url: session.url }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            }
        );

    } catch (error: any) {
        console.error("Unhandled upgrade error:", error);
        await captureError(error, { phase: 'upgrade_checkout' });

        const isStripeError = error?.type?.startsWith("Stripe");
        const statusCode = isStripeError ? 400 : 500;
        const message = isStripeError ? error.message : "Internal Server Error";

        return errorResponse(statusCode, message, isStripeError ? "STRIPE_ERROR" : "INTERNAL_ERROR");
    }
});
