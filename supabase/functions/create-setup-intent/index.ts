// Edge Function: create-setup-intent
// Purpose: Create Stripe Setup Intent for collecting payment method without charging
// Flow: User clicks "Add Payment Method" → This endpoint → Returns client_secret → Frontend mounts Stripe UI

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ensureStripeCustomer, createSetupIntent } from "../_shared/stripe-helpers.ts";
import { extractCorrelationId, logError, logInfo } from "../_shared/logging.ts";

const FUNCTION_NAME = "create-setup-intent";

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
      logError("Auth error in create-setup-intent", {
        ...baseLogOptions,
        error: userError,
      });
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const { accountId } = await req.json();

    if (!accountId) {
      return new Response(JSON.stringify({ error: "accountId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user owns this account
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("account_id, name")
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

    logInfo("Creating Setup Intent", {
      ...baseLogOptions,
      accountId,
      userId: user.id,
    });

    // Find or create Stripe customer
    const customerId = await ensureStripeCustomer({
      accountId,
      email: user.email!,
      name: profile.name || undefined,
      metadata: {
        user_id: user.id,
      },
    });

    // Create Setup Intent
    const setupIntent = await createSetupIntent({
      customerId,
      accountId,
      userId: user.id,
    });

    logInfo("Setup Intent created successfully", {
      ...baseLogOptions,
      accountId,
      setupIntentId: setupIntent.id,
    });

    // Return client secret to frontend
    return new Response(
      JSON.stringify({
        clientSecret: setupIntent.client_secret,
        customerId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    logError("Error in create-setup-intent", {
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
