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
import { POOL_CONFIG } from "../_shared/pool-config.ts";
import { provisionPhoneNumber } from "../_shared/telephony.ts";

/**
 * Retry a function with exponential backoff
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retry attempts
 * @param baseDelayMs - Base delay in milliseconds
 * @param operationName - Name of operation for logging
 * @returns Result from function
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000,
  operationName: string = "operation"
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < maxRetries) {
        const delayMs = baseDelayMs * Math.pow(2, attempt);
        console.log(
          `[provision-phone-number] Retry ${operationName} attempt ${attempt + 1}/${maxRetries} after ${delayMs}ms`
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError || new Error(`${operationName} failed after ${maxRetries} retries`);
}

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

    // Log state transition: vapi_queued → vapi_phone_pending
    await supabase.rpc("log_state_transition", {
      p_account_id: accountId,
      p_from_stage: "vapi_queued",
      p_to_stage: "vapi_phone_pending",
      p_triggered_by: FUNCTION_NAME,
      p_correlation_id: correlationId,
      p_metadata: { area_code: areaCode }
    });

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
    // STEP 1: Create Vapi Phone Number (SLOW OPERATION with retry)
    // ═══════════════════════════════════════════════════════════════

    let vapiPhoneId = null;
    let phoneNumber = null;

    if (POOL_CONFIG.ENABLED) {
      // -----------------------------------------------------------
      // POOL ENABLED: Allocator -> Buy Twilio -> Import to Vapi
      // -----------------------------------------------------------
      logInfo("Using Number Pool Strategy", { ...baseLogOptions, accountId });

      // A. Try to allocate from pool
      const { data: allocated, error: allocError } = await supabase.rpc(
        'allocate_phone_number_from_pool',
        { p_account_id: accountId }
      );

      if (allocated) {
        logInfo("Allocated number from pool", {
          ...baseLogOptions,
          accountId,
          context: { phoneNumber: allocated.phone_number }
        });
        phoneNumber = allocated.phone_number;
      } else {
        // B. Buy new from Twilio
        logInfo("Pool empty or no match, buying from Twilio", { ...baseLogOptions, accountId });
        try {
          const twilioResult = await provisionPhoneNumber({
            type: 'twilio',
            accountSid: Deno.env.get("TWILIO_ACCOUNT_SID"),
            authToken: Deno.env.get("TWILIO_AUTH_TOKEN"),
          }, {
            countryCode: 'US',
            areaCode: areaCode
          }, { correlationId });

          phoneNumber = twilioResult.phoneNumber;

          // We should probably save the provider_phone_number_id (SID) somewhere?
          // The final upsert Step 3 handles saving.
          logInfo("Purchased Twilio number", {
            ...baseLogOptions,
            context: { phoneNumber, sid: twilioResult.providerId }
          });

        } catch (twilioErr) {
          throw new Error(`Failed to buy Twilio number: ${twilioErr instanceof Error ? twilioErr.message : String(twilioErr)}`);
        }
      }

      // C. Import/Create Vapi Phone Object (tied to Twilio number)
      // Note: We use "provider": "twilio" to tell Vapi we are bringing our own number
      const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
      const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");

      if (!twilioAccountSid || !twilioAuthToken) {
        throw new Error("Missing Twilio credentials for Vapi Import");
      }

      try {
        const phoneData = await retryWithBackoff(
          async () => {
            const payload = {
              provider: "twilio",
              number: phoneNumber,
              twilioAccountSid,
              twilioAuthToken,
              name: `${companyName} - Primary`,
              // We can link assistant immediately here? Yes.
              assistantId: account.vapi_assistant_id,
            };

            const phoneResponse = await fetch("https://api.vapi.ai/phone-number", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${VAPI_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(payload),
            });

            if (!phoneResponse.ok) {
              const errorText = await phoneResponse.text();
              throw new Error(`Vapi Import error: ${errorText}`);
            }
            return await phoneResponse.json();
          },
          3, 2000, "import_vapi_phone"
        );

        vapiPhoneId = phoneData.id;
        logInfo("Imported number to Vapi", { ...baseLogOptions, context: { vapiPhoneId, phoneNumber } });

      } catch (importErr) {
        // If import fails, we have bought a Twilio number (if not pooled) or allocated one.
        // If bought, we might leak it?
        // If allocated, we should ideally rollback allocation (or it stays assigned but broken).
        // For now, allow it to fail, but log it.
        throw importErr;
      }

    } else if (VAPI_API_KEY && areaCode) {
      logInfo("Legacy Strategy: Requesting Vapi phone number with retry logic", {
        ...baseLogOptions,
        accountId,
        context: { areaCode }
      });

      try {
        // Option A: Try with area code first, fallback to no area code if unavailable
        let phoneData;
        try {
          phoneData = await retryWithBackoff(
            async () => {
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
                throw new Error(`Vapi API error: ${errorText}`);
              }

              return await phoneResponse.json();
            },
            3, // Max 3 retries
            2000, // Start with 2 second delay
            "create_vapi_phone_number_with_area_code"
          );
        } catch (areaCodeError) {
          const errorMessage = areaCodeError instanceof Error ? areaCodeError.message : String(areaCodeError);
          const isAreaCodeError = errorMessage.toLowerCase().includes('not available') ||
            errorMessage.toLowerCase().includes('area code') ||
            errorMessage.toLowerCase().includes('no numbers available');

          if (isAreaCodeError) {
            logWarn("Area code not available, retrying without area code constraint", {
              ...baseLogOptions,
              accountId,
              context: {
                requestedAreaCode: areaCode,
                error: errorMessage
              }
            });

            // Retry WITHOUT area code - let Vapi assign any available number
            phoneData = await retryWithBackoff(
              async () => {
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
                    // No numberDesiredAreaCode - accept any available number
                  }),
                });

                if (!phoneResponse.ok) {
                  const errorText = await phoneResponse.text();
                  throw new Error(`Vapi API error (no area code): ${errorText}`);
                }

                return await phoneResponse.json();
              },
              3, // Max 3 retries
              2000, // Start with 2 second delay
              "create_vapi_phone_number_without_area_code"
            );

            logInfo("Phone number created without area code constraint (fallback)", {
              ...baseLogOptions,
              accountId,
              context: { requestedAreaCode: areaCode }
            });
          } else {
            // Non-area-code error, rethrow
            throw areaCodeError;
          }
        }

        vapiPhoneId = phoneData.id;
        phoneNumber = phoneData.number;

        logInfo("Vapi phone number created successfully", {
          ...baseLogOptions,
          accountId,
          context: {
            vapiPhoneId,
            phoneNumber,
            requestedAreaCode: areaCode,
            actualAreaCode: phoneNumber.slice(2, 5) // Extract area code from +1XXXXXXXXXX
          }
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logError("Failed to create phone number after retries", {
          ...baseLogOptions,
          accountId,
          error
        });

        await supabase
          .from("accounts")
          .update({
            phone_number_status: "failed",
            provisioning_error: `Phone creation failed: ${errorMessage}`,
          })
          .eq("id", accountId);

        // Log failed state transition
        await supabase.rpc("log_state_transition", {
          p_account_id: accountId,
          p_from_stage: "vapi_phone_pending",
          p_to_stage: "failed_vapi",
          p_triggered_by: FUNCTION_NAME,
          p_correlation_id: correlationId,
          p_metadata: { error: errorMessage }
        });

        throw error;
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 2: Link Phone Number to Existing Assistant (with retry)
    // ═══════════════════════════════════════════════════════════════

    if (vapiPhoneId && account.vapi_assistant_id) {
      logInfo("Linking phone to assistant with retry logic", {
        ...baseLogOptions,
        accountId,
        context: {
          vapiPhoneId,
          assistantId: account.vapi_assistant_id
        }
      });

      try {
        await retryWithBackoff(
          async () => {
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
              throw new Error(`Failed to link phone: ${errorText}`);
            }

            return await linkResponse.json();
          },
          3, // Max 3 retries
          1000, // Start with 1 second delay
          "link_phone_to_assistant"
        );

        logInfo("Phone linked to assistant successfully", {
          ...baseLogOptions,
          accountId
        });
      } catch (error) {
        // Don't throw - phone is created, linkage can be fixed manually
        logWarn("Failed to link phone to assistant after retries (non-critical)", {
          ...baseLogOptions,
          accountId,
          error
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 3: Save Phone Number to Database
    // ═══════════════════════════════════════════════════════════════

    let phoneNumberId = null;
    if (phoneNumber && vapiPhoneId) {
      // Check if this is a pooled number (already has a record from allocator)
      const { data: existingPooledPhone } = await supabase
        .from("phone_numbers")
        .select("id")
        .eq("phone_number", phoneNumber)
        .maybeSingle();

      if (existingPooledPhone) {
        // POOLED NUMBER: Update existing record (allocated by allocator RPC)
        const { error: updateError } = await supabase
          .from("phone_numbers")
          .update({
            account_id: accountId,
            vapi_phone_id: vapiPhoneId,
            e164_number: phoneNumber, // Ensure e164 is set for webhook lookup
            is_primary: true,
            status: "active",
            label: "Primary",
            // Phone Pooling fields - CRITICAL for proper assignment
            lifecycle_status: "assigned",
            assigned_account_id: accountId,
            assigned_at: new Date().toISOString(),
          })
          .eq("id", existingPooledPhone.id);

        if (updateError) {
          logError("Failed to update pooled phone record", {
            ...baseLogOptions,
            accountId,
            error: updateError
          });
          throw new Error(`Failed to update pooled phone: ${updateError.message}`);
        }

        phoneNumberId = existingPooledPhone.id;

        logInfo("Updated pooled phone number record", {
          ...baseLogOptions,
          accountId,
          context: { phoneNumberId, phoneNumber }
        });
      } else {
        // NEW NUMBER: Insert new record
        const { data: phoneRecord, error: insertError } = await supabase
          .from("phone_numbers")
          .insert({
            account_id: accountId,
            phone_number: phoneNumber,
            e164_number: phoneNumber, // Ensure e164 is set for webhook lookup
            vapi_phone_id: vapiPhoneId,
            area_code: phoneNumber.slice(2, 5),
            is_primary: true,
            status: "active",
            label: "Primary",
            // Phone Pooling fields - CRITICAL for proper assignment
            lifecycle_status: "assigned",
            assigned_account_id: accountId,
            assigned_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (insertError) {
          logError("Failed to insert phone record", {
            ...baseLogOptions,
            accountId,
            error: insertError
          });
          throw new Error(`Failed to save phone: ${insertError.message}`);
        }

        phoneNumberId = phoneRecord?.id;

        logInfo("Inserted new phone number record", {
          ...baseLogOptions,
          accountId,
          context: { phoneNumberId }
        });
      }

      // ═══════════════════════════════════════════════════════════════
      // CRITICAL: Verify Vapi assistant binding
      // ═══════════════════════════════════════════════════════════════
      try {
        const verifyResponse = await fetch(
          `https://api.vapi.ai/phone-number/${vapiPhoneId}`,
          {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${VAPI_API_KEY}`,
            },
          }
        );

        if (verifyResponse.ok) {
          const vapiPhoneData = await verifyResponse.json();
          const boundAssistantId = vapiPhoneData.assistantId;

          if (boundAssistantId !== account.vapi_assistant_id) {
            logError("CRITICAL: Vapi assistant binding mismatch!", {
              ...baseLogOptions,
              accountId,
              context: {
                expectedAssistant: account.vapi_assistant_id,
                actualAssistant: boundAssistantId,
                vapiPhoneId
              }
            });

            // Attempt to fix by PATCHing again
            const fixResponse = await fetch(
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

            if (!fixResponse.ok) {
              const errText = await fixResponse.text();
              throw new Error(`Failed to fix Vapi binding: ${errText}`);
            }

            logInfo("Fixed Vapi assistant binding", {
              ...baseLogOptions,
              accountId
            });
          } else {
            logInfo("Vapi assistant binding verified", {
              ...baseLogOptions,
              accountId,
              context: { assistantId: boundAssistantId }
            });
          }
        } else {
          logWarn("Could not verify Vapi binding (non-critical)", {
            ...baseLogOptions,
            accountId
          });
        }
      } catch (verifyError) {
        logWarn("Vapi verification failed (non-critical)", {
          ...baseLogOptions,
          accountId,
          error: verifyError
        });
      }
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

    // Log state transition: vapi_phone_pending → vapi_phone_active → fully_provisioned
    await supabase.rpc("log_state_transition", {
      p_account_id: accountId,
      p_from_stage: "vapi_phone_pending",
      p_to_stage: "vapi_phone_active",
      p_triggered_by: FUNCTION_NAME,
      p_correlation_id: correlationId,
      p_metadata: {
        vapi_phone_id: vapiPhoneId,
        phone_number: phoneNumber
      }
    });

    await supabase.rpc("log_state_transition", {
      p_account_id: accountId,
      p_from_stage: "vapi_phone_active",
      p_to_stage: "fully_provisioned",
      p_triggered_by: FUNCTION_NAME,
      p_correlation_id: correlationId,
      p_metadata: {
        referral_code: referralCode
      }
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
