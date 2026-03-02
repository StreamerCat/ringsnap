/**
 * create-upgrade-checkout Edge Function
 *
 * Handles plan upgrades safely — supports new 4-plan pricing structure.
 * Plans: night_weekend | lite | core | pro
 *
 * 1. If stripe_subscription_id exists → Update existing subscription (no duplicate)
 *    - Updates base price item (proration)
 *    - If upgrading from night_weekend → clears rejected_daytime_calls counter (3e)
 * 2. If no subscription exists → Create Stripe Checkout Session with base + overage prices
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

// Valid plan keys — must match plans table plan_key values exactly
type PlanKey = "night_weekend" | "lite" | "core" | "pro";
const VALID_PLAN_KEYS: PlanKey[] = ["night_weekend", "lite", "core", "pro"];

// Env var name → plan_key mapping for base prices
const PLAN_BASE_PRICE_ENV: Record<PlanKey, string> = {
    night_weekend: "STRIPE_PRICE_ID_NIGHT_WEEKEND",
    lite: "STRIPE_PRICE_ID_LITE",
    core: "STRIPE_PRICE_ID_CORE",
    pro: "STRIPE_PRICE_ID_PRO",
};

// Env var name → plan_key mapping for metered overage prices
const PLAN_OVERAGE_PRICE_ENV: Record<PlanKey, string> = {
    night_weekend: "STRIPE_OVERAGE_PRICE_ID_NIGHT_WEEKEND",
    lite: "STRIPE_OVERAGE_PRICE_ID_LITE",
    core: "STRIPE_OVERAGE_PRICE_ID_CORE",
    pro: "STRIPE_OVERAGE_PRICE_ID_PRO",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    const requestId = crypto.randomUUID();
    const log = (msg: string, data: any = {}) => {
        console.log(JSON.stringify({ requestId, message: msg, ...data }));
    };

    initSentry('create-upgrade-checkout', { correlationId: requestId });

    const errorResponse = (status: number, message: string, code?: string) => {
        log(`Error: ${message}`, { status, code });
        return new Response(JSON.stringify({ error: message, code }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status,
        });
    };

    try {
        log("Starting upgrade checkout request");

        // 1. Auth
        const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
        if (!authHeader) return errorResponse(401, "Missing Authorization header", "AUTH_MISSING");

        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
        if (authError || !user) return errorResponse(401, "Unauthorized", "AUTH_FAILED");

        // 2. Parse body
        let account_id: string;
        let planKey: PlanKey;

        try {
            const body = await req.json();
            account_id = body.account_id;
            planKey = body.planKey?.toLowerCase() as PlanKey;
        } catch {
            return errorResponse(400, "Invalid JSON body", "INVALID_JSON");
        }

        if (!account_id) return errorResponse(400, "Missing account_id", "MISSING_ACCOUNT_ID");

        if (!planKey || !VALID_PLAN_KEYS.includes(planKey)) {
            return errorResponse(400,
                `Invalid planKey: ${planKey}. Must be one of: ${VALID_PLAN_KEYS.join(", ")}`,
                "INVALID_PLAN_KEY"
            );
        }

        // 3. Verify account access
        const { data: account, error: accountError } = await supabaseClient
            .from("accounts")
            .select("id, stripe_customer_id, stripe_subscription_id, stripe_overage_item_id, plan_key, plan_type, company_name")
            .eq("id", account_id)
            .single();

        if (accountError || !account) {
            return errorResponse(403, "You do not have permission to upgrade this account", "ACCESS_DENIED");
        }

        if (!account.stripe_customer_id) {
            return errorResponse(400, "Account has no linked Stripe customer", "NO_STRIPE_CUSTOMER");
        }

        const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
        if (!stripeKey) return errorResponse(500, "Missing Stripe configuration", "CONFIG_ERROR");

        // 4. Resolve price IDs
        const basePriceId = Deno.env.get(PLAN_BASE_PRICE_ENV[planKey])?.trim();
        const overagePriceId = Deno.env.get(PLAN_OVERAGE_PRICE_ENV[planKey])?.trim();

        if (!basePriceId) {
            log(`Missing base price env var: ${PLAN_BASE_PRICE_ENV[planKey]}`);
            return errorResponse(500, `Base price not configured for ${planKey}`, "PRICE_NOT_CONFIGURED");
        }

        const stripe = new Stripe(stripeKey, {
            apiVersion: "2023-10-16",
            httpClient: Stripe.createFetchHttpClient(),
        });

        const currentPlanKey = account.plan_key || account.plan_type;

        // 5. Decision: update existing subscription OR create new checkout
        if (account.stripe_subscription_id) {
            log("Updating existing subscription", {
                subscriptionId: account.stripe_subscription_id.substring(0, 15) + "...",
            });

            try {
                const subscription = await stripe.subscriptions.retrieve(account.stripe_subscription_id);

                if (!subscription || subscription.status === "canceled") {
                    log("Subscription canceled, will create checkout instead");
                } else {
                    // Find base (non-metered) subscription item to update
                    const baseItem = subscription.items.data.find(
                        (item: any) => item.price?.recurring?.usage_type !== "metered"
                    );

                    if (!baseItem) {
                        return errorResponse(500, "Cannot find base subscription item to update", "NO_SUBSCRIPTION_ITEM");
                    }

                    // Build update items: swap base price; add overage if not present
                    const updateItems: any[] = [{
                        id: baseItem.id,
                        price: basePriceId,
                    }];

                    // Check if overage item exists; if not, add it
                    const existingOverageItem = subscription.items.data.find(
                        (item: any) => item.price?.recurring?.usage_type === "metered"
                    );

                    if (!existingOverageItem && overagePriceId) {
                        updateItems.push({ price: overagePriceId });
                    } else if (existingOverageItem && overagePriceId && existingOverageItem.price.id !== overagePriceId) {
                        // Swap overage price too (different plan's overage rate)
                        updateItems.push({ id: existingOverageItem.id, price: overagePriceId });
                    }

                    const updatedSubscription = await stripe.subscriptions.update(
                        account.stripe_subscription_id,
                        {
                            items: updateItems,
                            proration_behavior: "create_prorations",
                            metadata: { plan_key: planKey },
                        }
                    );

                    log("Subscription updated", { subscriptionId: updatedSubscription.id });

                    // Update DB immediately for fast UI feedback (webhook is source of truth)
                    const serviceClient = createClient(
                        Deno.env.get("SUPABASE_URL") ?? "",
                        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
                    );

                    const dbUpdate: Record<string, unknown> = {
                        plan_key: planKey,
                        plan_type: planKey,
                        updated_at: new Date().toISOString(),
                    };

                    // 3e: If upgrading FROM night_weekend → clear rejected_daytime_calls
                    if (currentPlanKey === "night_weekend" && planKey !== "night_weekend") {
                        dbUpdate.rejected_daytime_calls = 0;
                    }

                    // Track new overage item ID if created
                    const newOverageItem = updatedSubscription.items.data.find(
                        (item: any) => item.price?.recurring?.usage_type === "metered"
                    );
                    if (newOverageItem) {
                        dbUpdate.stripe_overage_item_id = newOverageItem.id;
                    }

                    await serviceClient
                        .from("accounts")
                        .update(dbUpdate)
                        .eq("id", account_id);

                    return new Response(
                        JSON.stringify({
                            success: true,
                            message: `Plan updated to ${planKey}`,
                            subscription_id: updatedSubscription.id,
                        }),
                        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
                    );
                }
            } catch (stripeError: any) {
                log("Failed to update subscription, creating checkout session instead", {
                    error: stripeError.message,
                });
            }
        }

        // 6. Create Stripe Checkout Session (new subscription)
        log("Creating new checkout session");

        const origin = req.headers.get("origin");
        const siteUrl = Deno.env.get("SITE_URL") || "https://ringsnap.ai";
        const baseUrl = origin && !origin.includes("localhost") ? origin : siteUrl;
        const successUrl = `${baseUrl}/dashboard?tab=billing&upgrade=success`;
        const cancelUrl = `${baseUrl}/dashboard?tab=billing&upgrade=canceled`;

        // Include both base and metered overage price as line items (1b)
        const lineItems: any[] = [{ price: basePriceId, quantity: 1 }];
        if (overagePriceId) {
            lineItems.push({ price: overagePriceId });
        }

        const session = await stripe.checkout.sessions.create({
            customer: account.stripe_customer_id,
            mode: "subscription",
            line_items: lineItems,
            subscription_data: {
                trial_period_days: 3, // 1b: 3-day trial on all plans
                metadata: {
                    plan_key: planKey,
                    trial_minutes: "50",
                },
            },
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: {
                account_id: account_id,
                plan_key: planKey,
                upgrade_from: currentPlanKey || "unknown",
            },
        });

        log("Checkout session created", { sessionId: session.id });

        return new Response(
            JSON.stringify({ url: session.url }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );

    } catch (error: any) {
        console.error("Unhandled upgrade error:", error);
        await captureError(error, { phase: 'upgrade_checkout' });
        const isStripeError = error?.type?.startsWith("Stripe");
        return errorResponse(
            isStripeError ? 400 : 500,
            isStripeError ? error.message : "Internal Server Error",
            isStripeError ? "STRIPE_ERROR" : "INTERNAL_ERROR"
        );
    }
});
