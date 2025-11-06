// Edge Function: skip-card-trial
// Purpose: Handle cardless trial path when user skips payment method
// Flow: User clicks "Skip for now" → This endpoint → Set trial_type=cardless → Send email reminder

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractCorrelationId, logError, logInfo } from "../_shared/logging.ts";

const FUNCTION_NAME = "skip-card-trial";

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
      logError("Auth error in skip-card-trial", {
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

    logInfo("User skipping card requirement, starting cardless trial", {
      ...baseLogOptions,
      accountId,
      userId: user.id,
    });

    // Update account to cardless trial mode
    const { error: updateError } = await supabase
      .from("accounts")
      .update({
        trial_type: "cardless",
        trial_status: "pending_card",
        has_payment_method: false,
      })
      .eq("id", accountId);

    if (updateError) {
      logError("Failed to update account for cardless trial", {
        ...baseLogOptions,
        accountId,
        error: updateError,
      });
      return new Response(JSON.stringify({ error: "Failed to start cardless trial" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log analytics event
    await supabase.rpc("log_trial_event", {
      p_account_id: accountId,
      p_event_type: "trial_started",
      p_event_data: { trial_type: "cardless", has_payment_method: false },
    });

    logInfo("Cardless trial started successfully", {
      ...baseLogOptions,
      accountId,
    });

    // TODO: Send "Activate Your Trial" email
    // For now, we'll add this in a separate PR or use Supabase email templates
    // await sendActivateTrialEmail(user.email, profile.name, accountId);

    // Return success
    return new Response(
      JSON.stringify({
        ok: true,
        message: "Cardless trial started. Check your email for next steps.",
        trial_type: "cardless",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    logError("Error in skip-card-trial", {
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
