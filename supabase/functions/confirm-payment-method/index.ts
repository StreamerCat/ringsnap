// Edge Function: confirm-payment-method
// Purpose: Attach payment method to customer after successful Setup Intent confirmation
// Flow: Frontend confirms Setup Intent → Calls this with paymentMethodId → We attach to customer → Update account

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { attachPaymentMethod } from "../_shared/stripe-helpers.ts";
import { extractCorrelationId, logError, logInfo } from "../_shared/logging.ts";

const FUNCTION_NAME = "confirm-payment-method";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  const correlationId = extractCorrelationId(req);
  const baseLogOptions = { functionName: FUNCTION_NAME, correlationId };

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      logError("Auth error in confirm-payment-method", {
        ...baseLogOptions,
        error: userError,
      });
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const { accountId, paymentMethodId } = await req.json();

    if (!accountId || !paymentMethodId) {
      return new Response(JSON.stringify({ error: "accountId and paymentMethodId are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user owns this account
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("account_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      logError("Profile not found", {
        ...baseLogOptions,
        userId: user.id,
        error: profileError,
      });
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (profile.account_id !== accountId) {
      logError("Account ownership mismatch", {
        ...baseLogOptions,
        userId: user.id,
        requestedAccountId: accountId,
        actualAccountId: profile.account_id,
      });
      return new Response(JSON.stringify({ error: "Unauthorized: Account does not belong to user" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get account with Stripe customer ID
    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("stripe_customer_id")
      .eq("id", accountId)
      .single();

    if (accountError || !account?.stripe_customer_id) {
      logError("Account or Stripe customer not found", {
        ...baseLogOptions,
        accountId,
        error: accountError,
      });
      return new Response(JSON.stringify({ error: "Stripe customer not found for account" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logInfo("Attaching payment method to customer", {
      ...baseLogOptions,
      accountId,
      customerId: account.stripe_customer_id,
      paymentMethodId,
    });

    // Attach payment method and update account
    await attachPaymentMethod({
      customerId: account.stripe_customer_id,
      paymentMethodId,
      accountId,
    });

    logInfo("Payment method attached successfully", {
      ...baseLogOptions,
      accountId,
    });

    // Return success
    return new Response(
      JSON.stringify({
        ok: true,
        message: "Payment method added successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    logError("Error in confirm-payment-method", {
      ...baseLogOptions,
      error,
    });
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
