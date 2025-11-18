/*
 * ═══════════════════════════════════════════════════════════════════════════
 * FUNCTION: provision-phone-number
 *
 * ASYNCHRONOUS PHONE NUMBER PROVISIONING
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This function is called ASYNCHRONOUSLY after account creation to provision
 * a Vapi phone number. It runs in the background while the user sees their
 * dashboard.
 *
 * IMPORTANT: This function assumes the Vapi ASSISTANT has already been created
 * synchronously during the signup process. This function ONLY:
 *   1. Creates the Vapi phone number (SLOW: 1-2 minutes)
 *   2. Links the phone number to the existing assistant
 *   3. Saves phone number to database
 *   4. Generates referral code
 *   5. Sends welcome emails
 *   6. Updates phone_number_status = 'ready'
 *
 * WHY ASYNC:
 *   - Vapi phone number provisioning can take 1-2 minutes for the number to
 *     become fully active and ready to receive calls
 *   - We don't want users waiting on a spinner for that long
 *   - Instead, they see "Setting up your phone number..." in the dashboard
 *
 * ERROR HANDLING:
 *   - Errors are logged and phone_number_status set to 'failed'
 *   - Support team can be notified to manually provision or issue refund
 *   - User sees clear error message with support contact info
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractCorrelationId, logError, logInfo, logWarn } from "../_shared/logging.ts";
import { generateReferralCode } from "../_shared/validators.ts";

const FUNCTION_NAME = "provision-phone-number";
const VAPI_API_KEY = Deno.env.get("VAPI_API_KEY");
const RESEND_API_KEY = Deno.env.get("RESEND_PROD_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  const correlationId = extractCorrelationId(req);
  const baseLogOptions = { functionName: FUNCTION_NAME, correlationId };
  let currentAccountId: string | null = null;

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { accountId, email, name, phone, areaCode, companyName } = await req.json();
    currentAccountId = accountId;

    if (!accountId) {
      return new Response(
        JSON.stringify({ error: "Account ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logInfo("Starting phone provisioning", {
      ...baseLogOptions,
      accountId,
      context: { areaCode }
    });

    // Update provisioning status
    await supabase
      .from("accounts")
      .update({ phone_number_status: "provisioning" })
      .eq("id", accountId);

    // Fetch account details
    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("*, vapi_assistant_id")
      .eq("id", accountId)
      .single();

    if (accountError || !account) {
      throw new Error(`Account not found: ${accountError?.message}`);
    }

    if (!account.vapi_assistant_id) {
      logWarn("No Vapi assistant found - phone provisioning requires assistant", {
        ...baseLogOptions,
        accountId
      });
      throw new Error("Cannot provision phone without Vapi assistant");
    }

    // Check if phone already exists
    const { data: existingPhone } = await supabase
      .from("phone_numbers")
      .select("*")
      .eq("account_id", accountId)
      .eq("is_primary", true)
      .maybeSingle();

    if (existingPhone) {
      logInfo("Phone number already provisioned", {
        ...baseLogOptions,
        accountId,
        context: { phoneNumber: existingPhone.phone_number }
      });
      await supabase
        .from("accounts")
        .update({ phone_number_status: "ready" })
        .eq("id", accountId);
      return new Response(
        JSON.stringify({ ok: true, message: "Phone already provisioned" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 1: Create Vapi Phone Number (SLOW OPERATION)
    // ═══════════════════════════════════════════════════════════════

    let vapiPhoneId = null;
    let phoneNumber = null;

    if (VAPI_API_KEY && areaCode) {
      logInfo("Requesting Vapi phone number", {
        ...baseLogOptions,
        accountId,
        context: { areaCode }
      });

      const phoneResponse = await fetch("https://api.vapi.ai/phone-number", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${VAPI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: "vapi",
          name: `${companyName} - Primary`,
          fallbackDestination: {
            type: "number",
            number: phone || "+14155551234",
          },
          numberDesiredAreaCode: areaCode,
        }),
      });

      if (!phoneResponse.ok) {
        const errorText = await phoneResponse.text();
        await supabase
          .from("accounts")
          .update({
            phone_number_status: "failed",
            provisioning_error: `Phone creation failed: ${errorText}`,
          })
          .eq("id", accountId);
        throw new Error(`Failed to create phone number: ${errorText}`);
      }

      const phoneData = await phoneResponse.json();
      vapiPhoneId = phoneData.id;
      phoneNumber = phoneData.number;

      logInfo("Vapi phone number created", {
        ...baseLogOptions,
        accountId,
        context: { vapiPhoneId, phoneNumber }
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 2: Link Phone Number to Existing Assistant
    // ═══════════════════════════════════════════════════════════════

    if (vapiPhoneId && account.vapi_assistant_id) {
      logInfo("Linking phone to assistant", {
        ...baseLogOptions,
        accountId,
        context: {
          vapiPhoneId,
          assistantId: account.vapi_assistant_id
        }
      });

      const linkResponse = await fetch(
        `https://api.vapi.ai/phone-number/${vapiPhoneId}`,
        {
          method: "PATCH",
          headers: {
            "Authorization": `Bearer ${VAPI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            assistantId: account.vapi_assistant_id,
          }),
        }
      );

      if (!linkResponse.ok) {
        const errorText = await linkResponse.text();
        logWarn("Failed to link phone to assistant", {
          ...baseLogOptions,
          accountId,
          context: { error: errorText }
        });
        // Don't throw - phone is created, linkage can be fixed manually
      } else {
        logInfo("Phone linked to assistant successfully", {
          ...baseLogOptions,
          accountId
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 3: Save Phone Number to Database
    // ═══════════════════════════════════════════════════════════════

    let phoneNumberId = null;
    if (phoneNumber && vapiPhoneId) {
      const { data: phoneRecord } = await supabase
        .from("phone_numbers")
        .insert({
          account_id: accountId,
          phone_number: phoneNumber,
          vapi_phone_id: vapiPhoneId,
          area_code: phoneNumber.slice(2, 5),
          is_primary: true,
          status: "active",
          label: "Primary",
        })
        .select()
        .single();

      phoneNumberId = phoneRecord?.id;

      logInfo("Phone number saved to database", {
        ...baseLogOptions,
        accountId,
        context: { phoneNumberId }
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 4: Generate Referral Code
    // ═══════════════════════════════════════════════════════════════

    const referralCode = generateReferralCode();
    await supabase.from("referral_codes").insert({
      account_id: accountId,
      code: referralCode,
    });

    logInfo("Referral code generated", {
      ...baseLogOptions,
      accountId,
      context: { referralCode }
    });

    // ═══════════════════════════════════════════════════════════════
    // STEP 5: Update Account with Phone Number
    // ═══════════════════════════════════════════════════════════════

    await supabase
      .from("accounts")
      .update({
        vapi_phone_number: phoneNumber,
        phone_number_e164: phoneNumber,
        vapi_phone_number_id: vapiPhoneId,
        phone_number_status: "active",
        phone_provisioned_at: new Date().toISOString(),
        provisioning_status: "completed",
        onboarding_completed: true,
      })
      .eq("id", accountId);

    logInfo("Account updated with phone number", {
      ...baseLogOptions,
      accountId,
      context: { phoneNumber }
    });

    // Update provisioning job status
    await supabase
      .from("provisioning_jobs")
      .update({ status: "completed" })
      .eq("account_id", accountId)
      .eq("job_type", "provision_phone");

    // ═══════════════════════════════════════════════════════════════
    // STEP 6: Send Onboarding SMS (Non-blocking)
    // ═══════════════════════════════════════════════════════════════

    if (phone && phoneNumber && vapiPhoneId) {
      supabase.functions
        .invoke("send-onboarding-sms", {
          body: {
            phone: phone,
            ringSnapNumber: phoneNumber,
            name: name || "there",
            accountId: accountId,
            vapiPhoneId: vapiPhoneId,
          },
        })
        .catch((err) =>
          logWarn("SMS notification failed (non-critical)", {
            ...baseLogOptions,
            accountId,
            context: { error: err instanceof Error ? err.message : String(err) },
          })
        );

      logInfo("SMS notification triggered", {
        ...baseLogOptions,
        accountId
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 7: Send Welcome Email with Forwarding Instructions
    // ═══════════════════════════════════════════════════════════════

    if (RESEND_API_KEY && email && phoneNumber) {
      const userName = name || "there";
      const formatPhone = (phone: string) => {
        const cleaned = phone.replace(/\D/g, "");
        if (cleaned.length === 11 && cleaned.startsWith("1")) {
          return cleaned.substring(1).replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3");
        }
        if (cleaned.length === 10) {
          return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3");
        }
        return phone;
      };

      const formattedPhone = formatPhone(phoneNumber);
      const cleanNumber = phoneNumber.replace(/\D/g, "").slice(-10);

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "RingSnap <welcome@getringsnap.com>",
          to: email,
          subject: "Your RingSnap line is live - start catching every call",
          html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your RingSnap Line Is Ready</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #111827;">Your RingSnap Line Is Ready</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 40px 40px; color: #374151; font-size: 16px; line-height: 1.6;">
              <p style="margin: 0 0 20px 0;">Hey ${userName},</p>
              <p style="margin: 0 0 20px 0;">Your RingSnap line is ready: <strong style="color: #D95F3C; font-size: 18px;">${formattedPhone}</strong></p>
              <p style="margin: 0 0 20px 0;">Forward your business number to start catching calls:</p>
              <div style="background-color: #f9fafb; border-left: 4px solid #D95F3C; padding: 20px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0 0 12px 0;"><strong>👉 Step 1:</strong> Dial <strong style="font-family: monospace; font-size: 18px;">*72${cleanNumber}</strong></p>
                <p style="margin: 0 0 12px 0;"><strong>👉 Step 2:</strong> Wait for confirmation, then hang up</p>
                <p style="margin: 0;"><strong>👉 Step 3:</strong> Call your number to test - you're live!</p>
              </div>
              <p style="margin: 20px 0;">Takes less than a minute. RingSnap will start answering automatically.</p>
              <p style="margin: 30px 0 0 0; color: #6b7280; font-size: 14px;">- The RingSnap Team</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; color: #6b7280; font-size: 14px;">Questions? Reply to this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
          `,
        }),
      });

      logInfo("Welcome email sent", {
        ...baseLogOptions,
        accountId,
        context: { email }
      });
    }

    logInfo("Phone provisioning completed successfully", {
      ...baseLogOptions,
      accountId
    });

    return new Response(
      JSON.stringify({
        ok: true,
        message: "Phone provisioned successfully",
        phoneNumber,
        referralCode,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    logError("Phone provisioning error", {
      ...baseLogOptions,
      accountId: currentAccountId,
      error
    });

    const errorMessage = error instanceof Error ? error.message : "Internal server error";

    if (currentAccountId) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await supabase
        .from("accounts")
        .update({
          phone_number_status: "failed",
          provisioning_error: errorMessage,
        })
        .eq("id", currentAccountId);

      // Update provisioning job
      await supabase
        .from("provisioning_jobs")
        .update({
          status: "failed",
          error_message: errorMessage,
        })
        .eq("account_id", currentAccountId)
        .eq("job_type", "provision_phone");
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
