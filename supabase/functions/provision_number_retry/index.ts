import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?target=deno";
import { extractCorrelationId, logError, logInfo, logWarn, withLogContext } from "../_shared/logging.ts";
import { corsHeaders } from "../_shared/cors.ts";

const FUNCTION_NAME = "provision_number_retry";
const VAPI_BASE = "https://api.vapi.ai";

interface VapiPhoneResponse {
  id: string;
  status: "pending" | "active" | "failed";
  number?: string;
  [key: string]: unknown;
}

async function pollPhoneFromVapi(
  vapiId: string,
  log: ReturnType<typeof withLogContext>
): Promise<VapiPhoneResponse | null> {
  const vapiKey = Deno.env.get("VAPI_API_KEY");
  if (!vapiKey) {
    log.error("VAPI_API_KEY not configured");
    return null;
  }

  try {
    const response = await fetch(`${VAPI_BASE}/phone-number/${vapiId}`, {
      headers: { Authorization: `Bearer ${vapiKey}` }
    });

    if (!response.ok) {
      log.warn("Vapi poll failed", {
        status: response.status,
        vapiId
      });
      return null;
    }

    const phone = await response.json();
    return phone;
  } catch (err) {
    log.error("Error polling Vapi", err, { vapiId });
    return null;
  }
}

async function notifyUserPhoneReady(
  supabase: ReturnType<typeof createClient>,
  accountId: string,
  phoneNumber: string,
  log: ReturnType<typeof withLogContext>,
  userEmail?: string,
  userPhone?: string
) {
  try {
    // Get user contact info if not provided via profiles table
    if (!userEmail && !userPhone) {
      const { data: profile } = (await supabase
        .from("profiles")
        .select("id")
        .eq("account_id", accountId)
        .eq("is_primary", true)
        .maybeSingle()) as { data: { id: string } | null };

      if (profile?.id) {
        try {
          const { data: userData } = await supabase.auth.admin.getUserById(profile.id);
          if (userData?.user) {
            userEmail = userData.user.email;
            userPhone = userData.user.user_metadata?.phone;
          }
        } catch (err) {
          log.error("Could not fetch user details", err, { accountId });
        }
      }
    }

    // Try to send via webhook first (if configured)
    const webhookUrl = Deno.env.get("NOTIFY_WEBHOOK_URL");
    if (webhookUrl) {
      try {
        const webhookRes = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "phone_ready",
            accountId,
            phoneNumber,
            userEmail,
            userPhone
          })
        });

        if (!webhookRes.ok) {
          log.warn("Webhook notification failed", {
            status: webhookRes.status,
            accountId,
            phoneNumber
          });
        } else {
          log.info("Notification sent via webhook", {
            accountId,
            phoneNumber
          });
        }
      } catch (err) {
        log.error("Webhook notification error", err, { accountId });
      }
    }

    // Notifications tracking removed - not needed for core functionality
  } catch (err) {
    log.error("Error notifying user", err, { accountId });
  }
}

serve(async (req) => {
  const correlationId = extractCorrelationId(req);
  const log = withLogContext({ functionName: FUNCTION_NAME, correlationId });

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    log.info("Provisioning retry job started");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      log.error("Supabase credentials missing");
      return new Response(
        JSON.stringify({ error: "Configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch pending phone numbers
    const { data: pendingPhones, error: fetchError } = await supabase
      .from("phone_numbers")
      .select("id, vapi_phone_id, vapi_id, account_id, provisioning_attempts")
      .eq("status", "pending")
      .lt("provisioning_attempts", 20) // Stop retrying after 20 attempts (~100 min at 5 min intervals)
      .limit(50);

    if (fetchError) {
      log.error("Failed to fetch pending phones", fetchError);
      return new Response(
        JSON.stringify({ error: "Database error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!pendingPhones || pendingPhones.length === 0) {
      log.info("No pending phones to retry");
      return new Response(
        JSON.stringify({ result: "ok" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    log.info("Found pending phones to retry", {
      count: pendingPhones.length
    });

    // Process each pending phone
    let processedCount = 0;
    let activatedCount = 0;

    for (const phone of pendingPhones) {
      try {
        // Poll Vapi (Use canonical ID first)
        const vapiId = phone.vapi_phone_id || phone.vapi_id;
        const vapiPhone = await pollPhoneFromVapi(vapiId, log);

        if (!vapiPhone) {
          log.warn("Could not poll Vapi phone", {
            vapiId,
            accountId: phone.account_id
          });

          // Increment attempt counter
          await supabase
            .from("phone_numbers")
            .update({ provisioning_attempts: (phone.provisioning_attempts || 0) + 1 })
            .eq("id", phone.id);

          processedCount++;
          continue;
        }

        // Update phone record
        const updateData: Record<string, unknown> = {
          status: vapiPhone.status,
          last_polled_at: new Date().toISOString(),
          raw: vapiPhone,
          provisioning_attempts: (phone.provisioning_attempts || 0) + 1
        };

        if (vapiPhone.status === "active") {
          updateData.activated_at = new Date().toISOString();
          updateData.phone_number = vapiPhone.number || updateData.phone_number;
        }

        await supabase.from("phone_numbers").update(updateData).eq("id", phone.id);

        // Update account status
        await supabase
          .from("accounts")
          .update({
            provisioning_status: vapiPhone.status === "active" ? "active" : "pending",
            phone_provisioned_at: vapiPhone.status === "active" ? new Date().toISOString() : null
          })
          .eq("id", phone.account_id);

        // If active, notify user
        if (vapiPhone.status === "active") {
          activatedCount++;
          log.info("Phone became active, notifying user", {
            vapiId,
            phoneNumber: vapiPhone.number,
            accountId: phone.account_id
          });

          await notifyUserPhoneReady(
            supabase as any,
            phone.account_id,
            vapiPhone.number ?? "unknown",
            log
          );

          // Log success
          await supabase.from("provisioning_logs").insert({
            account_id: phone.account_id,
            operation: "poll_success",
            details: {
              vapiId,
              phoneNumber: vapiPhone.number,
              attemptsNeeded: (phone.provisioning_attempts || 0) + 1
            }
          });
        }

        processedCount++;
      } catch (err) {
        log.error("Error processing pending phone", err, {
          phoneId: phone.id,
          accountId: phone.account_id
        });
        processedCount++;
      }
    }

    log.info("Provisioning retry job completed", {
      processed: processedCount,
      activated: activatedCount,
      pending: pendingPhones.length - activatedCount
    });

    return new Response(
      JSON.stringify({
        result: "ok",
        processed: processedCount,
        activated: activatedCount
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    log.error("Unhandled error in retry job", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
