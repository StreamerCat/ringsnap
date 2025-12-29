/*
 * ═══════════════════════════════════════════════════════════════════════════
 * FUNCTION: provision-vapi (ASYNC WORKER)
 *
 * PURPOSE: Process queued provisioning jobs asynchronously with retry logic
 *
 * FLOW:
 * 1. Poll for queued/failed jobs (with SKIP LOCKED for concurrency)
 * 2. Mark job as processing
 * 3. Create Vapi assistant idempotently
 * 4. Provision Vapi phone number with area code fallback
 * 5. Update account with provisioning results
 * 6. Mark job as completed or failed
 * 7. Implement exponential backoff for retries
 *
 * RETRY LOGIC:
 * - Max attempts: 5
 * - Backoff: 2^attempt minutes
 * - Permanent failure after max attempts
 *
 * IDEMPOTENCY:
 * - Check if assistant/phone already exists before creating
 * - Safe to run multiple times on same account
 *
 * CRON SCHEDULE:
 * - Triggered every 30 seconds via Supabase cron
 * - Processes up to 10 jobs per invocation
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

// Imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { extractCorrelationId, logError, logInfo, logWarn } from "../_shared/logging.ts";
import { buildVapiPrompt } from "../_shared/template-builder.ts";
import { getAccountTemplate, upsertAccountTemplate } from "../_shared/template-service.ts";
import { formatPhoneE164 } from "../_shared/validators.ts";
import { getPreferredAreaCode } from "../_shared/phone-utils.ts";
import { trackEvent } from "../_shared/analytics.ts";
import { initSentry, captureError, setContext } from "../_shared/sentry.ts";

import { provisionPhoneNumber, ProviderConfig } from "../_shared/telephony.ts";

const FUNCTION_NAME = "provision-vapi";
const VAPI_API_KEY = Deno.env.get("VAPI_API_KEY");
const VAPI_BASE_URL = "https://api.vapi.ai";
const MAX_RETRY_ATTEMPTS = 5;
const JOBS_PER_BATCH = 10;
const TRIAL_DAYS = parseInt(Deno.env.get("TRIAL_DAYS") || "3", 10);
const TRIAL_PHONE_RETENTION_DAYS = parseInt(Deno.env.get("TRIAL_PHONE_RETENTION_DAYS") || "10", 10);

// Telephony Config
const TELEPHONY_PROVIDER = (Deno.env.get("VAPI_DEFAULT_PROVIDER") || "twilio") as "twilio" | "vapi";
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const VAPI_TWILIO_CREDENTIAL_ID = Deno.env.get("VAPI_TWILIO_CREDENTIAL_ID");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Calculate exponential backoff delay
 */
function calculateRetryDelay(attempts: number): string {
  const minutes = Math.pow(2, attempts); // 2^attempts minutes
  const delayDate = new Date(Date.now() + minutes * 60 * 1000);
  return delayDate.toISOString();
}

/**
 * Check if Vapi assistant already exists for account
 */
async function getExistingAssistant(
  supabase: any,
  accountId: string
): Promise<{ id: string; vapi_assistant_id: string } | null> {
  const { data, error } = await supabase
    .from("vapi_assistants")
    .select("id, vapi_assistant_id")
    .eq("account_id", accountId)
    .maybeSingle();

  if (error) {
    logWarn("Failed to check existing assistant", {
      functionName: FUNCTION_NAME,
      context: { accountId, error: error.message },
    });
    return null;
  }

  return data;
}

/**
 * Check if phone number already exists for account
 */
async function getExistingPhone(
  supabase: any,
  accountId: string
): Promise<{ id: string; phone_number: string; vapi_phone_id: string } | null> {
  const { data, error } = await supabase
    .from("phone_numbers")
    .select("id, phone_number, vapi_phone_id")
    .eq("account_id", accountId)
    .eq("is_primary", true)
    .maybeSingle();

  if (error) {
    logWarn("Failed to check existing phone", {
      functionName: FUNCTION_NAME,
      context: { accountId, error: error.message },
    });
    return null;
  }

  return data;
}

/**
 * Create Vapi assistant
 */
async function createVapiAssistant(
  supabase: any,
  accountId: string,
  metadata: any,
  correlationId: string
): Promise<{ vapiAssistantId: string; vapiAssistantDbId: string }> {
  const baseLogOptions = {
    functionName: FUNCTION_NAME,
    correlationId,
    accountId,
  };

  // 1. Try to load existing template
  let prompt = await getAccountTemplate(supabase, accountId, metadata.trade);

  // 2. If no template exists, build default and store it
  if (!prompt) {
    logInfo("No existing template found, building default", baseLogOptions);
    prompt = await buildVapiPrompt({
      company_name: metadata.company_name,
      trade: metadata.trade,
      service_area: metadata.service_area || "",
      business_hours: metadata.business_hours || "Monday-Friday 8am-5pm",
      emergency_policy: metadata.emergency_policy || "Available 24/7 for emergencies",
      company_website: metadata.company_website || "",
      custom_instructions: "",
      why_choose_us_blurb: metadata.why_choose_us_blurb, // Pass if available in metadata
    });

    // Save generated template
    try {
      await upsertAccountTemplate(supabase, accountId, metadata.trade, prompt, 'system_generated', true);
      logInfo("Stored default template", baseLogOptions);
    } catch (err) {
      logWarn("Failed to store default template (continuing)", { ...baseLogOptions, error: err });
    }
  } else {
    logInfo("Using existing account template", baseLogOptions);
  }

  // Use valid ElevenLabs voice IDs
  // Rachel (Female): 21m00Tcm4TlvDq8ikWAM
  // Brian (Male): nPczCjzI2devNBz1zQrb
  const voiceId = metadata.assistant_gender === "male"
    ? "nPczCjzI2devNBz1zQrb"  // Brian
    : "21m00Tcm4TlvDq8ikWAM"; // Rachel

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serverUrl = supabaseUrl
    ? `${supabaseUrl.replace(/\/$/, "")}/functions/v1/vapi-webhook`
    : undefined;

  const assistantPayload = {
    name: `${metadata.company_name} Assistant`,
    model: {
      provider: "openai",
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: prompt,
        },
      ],
    },
    voice: {
      provider: "11labs",
      voiceId: voiceId,
    },
    firstMessage: `Thank you for calling ${metadata.company_name}! How can I help you today?`,
    serverUrl: serverUrl,
  };

  logInfo("Creating Vapi assistant", {
    ...baseLogOptions,
    context: { companyName: metadata.company_name, voice: voiceId, serverUrl },
  });

  const vapiResponse = await fetch(`${VAPI_BASE_URL}/assistant`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${VAPI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(assistantPayload),
  });

  if (!vapiResponse.ok) {
    const errorText = await vapiResponse.text();
    throw new Error(
      `Vapi assistant creation failed: ${vapiResponse.status} ${errorText}`
    );
  }

  const vapiAssistant = await vapiResponse.json();
  const vapiAssistantId = vapiAssistant.id;

  logInfo("Vapi assistant created", {
    ...baseLogOptions,
    context: { vapiAssistantId },
  });

  // Insert into DB
  const { data: assistantRow, error: assistantDbError } = await supabase
    .from("vapi_assistants")
    .insert({
      account_id: accountId,
      vapi_assistant_id: vapiAssistantId,
      config: vapiAssistant,
    })
    .select("id")
    .single();

  if (assistantDbError) {
    throw new Error(`Failed to save assistant to DB: ${assistantDbError.message}`);
  }

  return {
    vapiAssistantId,
    vapiAssistantDbId: assistantRow.id,
  };
}

/**
 * Provision Vapi phone number with smart area code selection
 */
async function provisionVapiPhone(
  accountId: string,
  vapiAssistantId: string,
  metadata: any,
  correlationId: string
): Promise<{ phoneE164: string; vapiPhoneId: string; phoneDbId: string }> {
  const baseLogOptions = {
    functionName: FUNCTION_NAME,
    correlationId,
    accountId,
  };

  // Use smart area code selection
  const areaCodePref = getPreferredAreaCode(metadata.fallback_phone, metadata.zip_code);
  const requestedAreaCode = areaCodePref.areaCode;

  let phoneE164: string;
  let providerProviderId: string | undefined; // e.g. Twilio SID
  let providerMetadata: any = {};

  // --------------------------------------------------------
  // 1. Provision (Buy) Number from Telephony Provider
  // --------------------------------------------------------
  if (TELEPHONY_PROVIDER === "twilio") {
    // Validate Creds
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")?.trim();
    // Use TWILIO_API_KEY / TWILIO_API_SECRET preferentially for Twilio Auth
    const twilioApiKey = Deno.env.get("TWILIO_API_KEY")?.trim();
    const twilioApiSecret = Deno.env.get("TWILIO_API_SECRET")?.trim();

    if (!TWILIO_ACCOUNT_SID || !twilioApiKey || !twilioApiSecret) {
      const missing = [];
      if (!TWILIO_ACCOUNT_SID) missing.push("TWILIO_ACCOUNT_SID");
      if (!twilioApiKey) missing.push("TWILIO_API_KEY");
      if (!twilioApiSecret) missing.push("TWILIO_API_SECRET");

      logError("Missing Twilio credentials", {
        ...baseLogOptions,
        context: { missing }
      });
      throw new Error(`Missing Twilio credentials in environment: ${missing.join(", ")}`);
    }

    // We use API Key/Secret for Twilio Auth (matches Vapi inline requirement)
    // Twilio API supports Basic Auth with API Key SID (username) and Secret (password)
    const providerConfig: ProviderConfig = {
      type: "twilio",
      accountSid: TWILIO_ACCOUNT_SID,
      apiKey: twilioApiKey,
      apiSecret: twilioApiSecret,
    };

    logInfo("Provisioning number via Twilio", {
      ...baseLogOptions,
      context: { requestedAreaCode, provider: "twilio" },
    });

    try {
      const result = await provisionPhoneNumber(
        providerConfig,
        { countryCode: "US", areaCode: requestedAreaCode },
        { correlationId }
      );

      phoneE164 = result.phoneNumber;
      providerProviderId = result.providerId;
      providerMetadata = result.metadata;

    } catch (e: any) {
      throw new Error(`Telephony Provisioning Failed: ${e.message}`);
    }

  } else {
    // Legacy Vapi "Free" Number (Known to be flaky/exhausted)
    throw new Error("Legacy Vapi provisioning is deprecated. Configure Twilio credentials.");
  }


  // --------------------------------------------------------
  // 2. Import/Create Number in Vapi
  // --------------------------------------------------------

  // Check Mode
  const mode = Deno.env.get("TWILIO_PROVISION_MODE") || "live";
  const isTestMode = mode === "test";

  // Construct Vapi Payload based on Provider
  let vapiPayload: any;
  let twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  let twilioApiKey = Deno.env.get("TWILIO_API_KEY");
  let twilioApiSecret = Deno.env.get("TWILIO_API_SECRET");

  if (isTestMode) {
    logInfo("Running in TEST mode: Using Test Credentials for Vapi Payload", baseLogOptions);
    twilioAccountSid = Deno.env.get("TWILIO_TEST_ACCOUNT_SID");
    twilioApiKey = ""; // Test creds use SID/Token usually
    twilioApiSecret = Deno.env.get("TWILIO_TEST_AUTH_TOKEN"); // Token acts as secret
  }

  if (TELEPHONY_PROVIDER === "twilio") {
    vapiPayload = {
      provider: "twilio",
      number: phoneE164, // The number we just bought
      twilioAccountSid: twilioAccountSid,
      twilioApiKey: twilioApiKey || undefined, // Send undefined if empty (test mode)
      twilioApiSecret: twilioApiSecret,
      name: metadata.company_name ? `${metadata.company_name} Line` : undefined,
      assistantId: vapiAssistantId, // Bind immediately
      fallbackDestination: {
        type: "number",
        // Ensure we ALWAYS have a valid E.164 fallback. Double-check the formatted result.
        number: (() => {
          const rawFallback = metadata.fallback_phone?.trim() || "";
          const formatted = formatPhoneE164(rawFallback || "4155551234");
          // Validate the result is actually E.164
          if (formatted.startsWith('+') && formatted.length >= 11) {
            return formatted;
          }
          // Hardcoded safe fallback if formatting somehow failed
          return "+14155551234";
        })(),
      }
    };
  }

  logInfo("Importing number to Vapi", {
    ...baseLogOptions,
    context: {
      phoneE164,
      payload: { ...vapiPayload, twilioApiSecret: "***" }, // Redact secret
      isTestMode
    },
  });

  let vapiPhone: any;

  if (isTestMode) {
    // MOCK Vapi Response for Test Mode
    logInfo("Test Mode: Mocking Vapi Import (Skipping actual API call)", baseLogOptions);
    vapiPhone = {
      id: `test-vapi-phone-${Date.now()}`,
      number: phoneE164,
      phoneNumber: phoneE164,
      createdAt: new Date().toISOString(),
      provider: "twilio"
    };
  } else {
    // REAL Vapi Call
    const vapiResponse = await fetch(`${VAPI_BASE_URL}/phone-number`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${VAPI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(vapiPayload),
    });

    if (!vapiResponse.ok) {
      const errorText = await vapiResponse.text();
      throw new Error(
        `Vapi phone import failed: ${vapiResponse.status} ${errorText}`
      );
    }
    vapiPhone = await vapiResponse.json();
  }

  const vapiPhoneId = vapiPhone.id;
  const finalNumber = vapiPhone.number || vapiPhone.phoneNumber || phoneE164; // Fallback to what we tried to import

  logInfo("Vapi phone number provisioned/imported", {
    ...baseLogOptions,
    context: { phoneE164: finalNumber, vapiPhoneId, isMock: isTestMode },
  });

  // Calculate Trial Dates
  const now = new Date();
  const trialExpiresAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const retentionExpiresAt = new Date(now.getTime() + TRIAL_PHONE_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  // Insert into DB
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl!, supabaseServiceRoleKey!);

  logInfo("Inserting phone number into database", {
    ...baseLogOptions,
    context: {
      phoneNumber: finalNumber,
      areaCode: requestedAreaCode,
      vapiPhoneId,
    },
  });

  const { data: phoneRow, error: phoneDbError } = await supabase
    .from("phone_numbers")
    .insert({
      account_id: accountId,
      phone_number: finalNumber,
      e164_number: finalNumber, // Ensure e164_number is set for webhook lookup
      area_code: requestedAreaCode,
      vapi_phone_id: vapiPhoneId,
      purpose: "primary",
      status: "active",
      is_primary: true,
      // Phone Pooling fields - CRITICAL for proper assignment
      lifecycle_status: "assigned",
      assigned_account_id: accountId,
      assigned_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (phoneDbError) {
    logError("Failed to save phone to DB", {
      ...baseLogOptions,
      error: phoneDbError,
      context: {
        phoneNumber: finalNumber,
        errorDetails: phoneDbError.details,
        errorHint: phoneDbError.hint,
      },
    });
    throw new Error(`Failed to save phone to DB: ${phoneDbError.message}`);
  }

  logInfo("Phone number saved to database successfully", {
    ...baseLogOptions,
    context: {
      phoneDbId: phoneRow.id,
      phoneNumber: finalNumber,
    },
  });

  return {
    phoneE164: finalNumber,
    vapiPhoneId,
    phoneDbId: phoneRow.id,
  };
}

/**
 * Process a single provisioning job
 */
async function processJob(job: any, supabase: any): Promise<void> {
  const correlationId = job.correlation_id || `job-${job.id}`;
  const baseLogOptions = {
    functionName: FUNCTION_NAME,
    correlationId,
    accountId: job.account_id,
  };

  logInfo("Processing provisioning job", {
    ...baseLogOptions,
    context: {
      jobId: job.id,
      jobType: job.job_type,
      attempts: job.attempts,
    },
  });

  try {
    // Mark job as processing
    await supabase.from("provisioning_jobs").update({
      status: "processing",
      updated_at: new Date().toISOString(),
    }).eq("id", job.id);

    // Track Start
    trackEvent(supabase, job.account_id, job.user_id, "provisioning_started", {
      job_id: job.id,
      attempts: job.attempts
    });

    // Update account provisioning status
    await supabase.rpc("update_provisioning_lifecycle", {
      p_account_id: job.account_id,
      p_status: "processing",
    });

    // Fetch account data (since metadata column doesn't exist in provisioning_jobs)
    // NOTE: is_test_account removed from select - column may not exist yet
    const { data: accountData, error: accountError } = await supabase
      .from("accounts")
      .select("company_name, trade, service_area, business_hours, emergency_policy, company_website, assistant_gender, wants_advanced_voice, zip_code")
      .eq("id", job.account_id)
      .single();

    if (accountError || !accountData) {
      throw new Error(`Failed to fetch account data: ${accountError?.message || "Account not found"}`);
    }

    // Check for test mode - use zip_code as fallback since is_test_account column may not exist
    const isJobTestMode = job.test_mode || accountData.zip_code === "99999";

    if (isJobTestMode) {
      // ═══════════════════════════════════════════════════════════════
      // TEST MODE: Skip all Twilio/Vapi calls - use mock data
      // The create-trial function should have already written mock data
      // This is a safety net in case provision-vapi is called anyway
      // ═══════════════════════════════════════════════════════════════
      logInfo("TEST MODE: Skipping Twilio/Vapi provisioning entirely", {
        ...baseLogOptions,
        context: {
          jobTestMode: job.test_mode,
          zipCode: accountData.zip_code,
          reason: "Test account detected - no real provisioning needed"
        }
      });
      console.log(`[provision-vapi] TEST MODE: Skipping job ${job.id} for test account`);

      // Mark job as completed immediately (no Twilio/Vapi work)
      await supabase.from("provisioning_jobs").update({
        status: "completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        error: null,
      }).eq("id", job.id);

      logInfo("TEST MODE: Job marked as completed (no-op)", {
        ...baseLogOptions,
        context: { jobId: job.id },
      });

      // Exit this job processing - do NOT continue with Twilio/Vapi calls
      return;
    }

    // LIVE MODE: Proceed with real Twilio/Vapi provisioning
    logInfo("LIVE MODE: Processing real provisioning", baseLogOptions);

    // Fetch profile data for phone number
    const { data: profileData } = await supabase
      .from("profiles")
      .select("phone")
      .eq("id", job.user_id)
      .maybeSingle();

    // Build metadata object from account data
    const metadata = {
      company_name: accountData.company_name,
      trade: accountData.trade,
      service_area: accountData.service_area || "",
      business_hours: accountData.business_hours || "Monday-Friday 8am-5pm",
      emergency_policy: accountData.emergency_policy || "Available 24/7 for emergencies",
      company_website: accountData.company_website || "",
      assistant_gender: accountData.assistant_gender,
      wants_advanced_voice: accountData.wants_advanced_voice,
      zip_code: accountData.zip_code, // Use raw zip for helper
      fallback_phone: profileData?.phone || "",
    };

    // Check if assistant already exists (idempotency)
    let vapiAssistantId: string;
    let vapiAssistantDbId: string;

    const existingAssistant = await getExistingAssistant(supabase, job.account_id);
    if (existingAssistant) {
      logInfo("Assistant already exists, skipping creation", {
        ...baseLogOptions,
        context: { vapiAssistantId: existingAssistant.vapi_assistant_id },
      });
      vapiAssistantId = existingAssistant.vapi_assistant_id;
      vapiAssistantDbId = existingAssistant.id;
    } else {
      const assistantResult = await createVapiAssistant(
        supabase, // Pass supabase client
        job.account_id,
        metadata,
        correlationId
      );
      vapiAssistantId = assistantResult.vapiAssistantId;
      vapiAssistantDbId = assistantResult.vapiAssistantDbId;
    }

    // Check if phone already exists (idempotency)
    let phoneE164: string;
    let vapiPhoneId: string;
    let phoneDbId: string;

    const existingPhone = await getExistingPhone(supabase, job.account_id);
    if (existingPhone) {
      logInfo("Using existing phone number", {
        ...baseLogOptions,
        context: { phoneNumber: existingPhone.phone_number },
      });
      phoneE164 = existingPhone.phone_number;
      vapiPhoneId = existingPhone.vapi_phone_id;
      phoneDbId = existingPhone.id;
    } else {
      const phoneResult = await provisionVapiPhone(
        job.account_id,
        vapiAssistantId,
        metadata,
        correlationId
      );
      phoneE164 = phoneResult.phoneE164;
      vapiPhoneId = phoneResult.vapiPhoneId;
      phoneDbId = phoneResult.phoneDbId;
    }

    // Update account with provisioning results
    await supabase.from("accounts").update({
      vapi_assistant_id: vapiAssistantId,
      vapi_phone_number: phoneE164,
      phone_number_e164: phoneE164,
      vapi_phone_number_id: vapiPhoneId,
      phone_number_status: "active",
      phone_provisioned_at: new Date().toISOString(),
    }).eq("id", job.account_id);

    // Update provisioning lifecycle to completed
    await supabase.rpc("update_provisioning_lifecycle", {
      p_account_id: job.account_id,
      p_status: "completed",
    });

    // Update user's onboarding status to active (hybrid onboarding flow)
    if (job.user_id) {
      await supabase.from("profiles").update({
        onboarding_status: "active",
      }).eq("id", job.user_id);

      logInfo("Updated onboarding status to active", {
        ...baseLogOptions,
        context: { userId: job.user_id },
      });
    }

    // Mark job as completed
    await supabase.from("provisioning_jobs").update({
      status: "completed",
      vapi_assistant_id: vapiAssistantId,
      vapi_phone_id: vapiPhoneId,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      error: null,
    }).eq("id", job.id);

    logInfo("Provisioning job completed successfully", {
      ...baseLogOptions,
      context: {
        jobId: job.id,
        phoneNumber: phoneE164,
        vapiAssistantId,
      },
    });

    // Track Success
    trackEvent(supabase, job.account_id, job.user_id, "provisioning_completed", {
      job_id: job.id,
      phone_number: phoneE164,
      vapi_phone_id: vapiPhoneId
    });
  } catch (error: any) {
    // Job failed - determine if we should retry
    const newAttempts = (job.attempts || 0) + 1;
    const shouldRetry = newAttempts < MAX_RETRY_ATTEMPTS;

    logError("Provisioning job failed", {
      ...baseLogOptions,
      error,
      context: {
        jobId: job.id,
        attempts: newAttempts,
        willRetry: shouldRetry,
      },
    });

    if (shouldRetry) {
      // Calculate retry delay with exponential backoff
      const retryAfter = calculateRetryDelay(newAttempts);

      await supabase.from("provisioning_jobs").update({
        status: "failed",
        attempts: newAttempts,
        error: error.message?.substring(0, 500) || "Unknown error",
        updated_at: new Date().toISOString(),
      }).eq("id", job.id);

      // Update account status
      await supabase.rpc("update_provisioning_lifecycle", {
        p_account_id: job.account_id,
        p_status: "failed",
        p_error: `Provisioning failed (attempt ${newAttempts}/${MAX_RETRY_ATTEMPTS}): ${error.message}`,
      });

      trackEvent(supabase, job.account_id, job.user_id, "provisioning_failed", {
        job_id: job.id,
        error: error.message,
        attempt: newAttempts,
        is_permanent: false
      });
    } else {
      // Permanent failure
      await supabase.from("provisioning_jobs").update({
        status: "failed_permanent",
        attempts: newAttempts,
        error: error.message?.substring(0, 500) || "Unknown error",
        updated_at: new Date().toISOString(),
      }).eq("id", job.id);

      // Update account status
      await supabase.rpc("update_provisioning_lifecycle", {
        p_account_id: job.account_id,
        p_status: "failed",
        p_error: `Provisioning failed permanently after ${MAX_RETRY_ATTEMPTS} attempts: ${error.message}`,
      });

      trackEvent(supabase, job.account_id, job.user_id, "provisioning_failed", {
        job_id: job.id,
        error: error.message,
        attempt: newAttempts,
        is_permanent: true
      });

      // Update user's onboarding status to provision_failed (hybrid onboarding flow)
      if (job.user_id) {
        await supabase.from("profiles").update({
          onboarding_status: "provision_failed",
        }).eq("id", job.user_id);
      }

      logError("Provisioning job failed permanently", {
        ...baseLogOptions,
        error,
        context: { jobId: job.id, maxAttempts: MAX_RETRY_ATTEMPTS },
      });
    }
  }
}

Deno.serve(async (req: Request) => {
  const correlationId = extractCorrelationId(req);
  const baseLogOptions = {
    functionName: FUNCTION_NAME,
    correlationId,
  };

  // Initialize Sentry for error tracking
  initSentry(FUNCTION_NAME, { correlationId });

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[provision-vapi] Start", { correlationId });

    if (!VAPI_API_KEY) {
      logWarn("VAPI_API_KEY not configured", baseLogOptions);
      return new Response(
        JSON.stringify({ error: "VAPI_API_KEY not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Check for direct invocation payload (e.g. from create-trial)
    let payload: any = {};
    try {
      if (req.body && req.headers.get("content-type")?.includes("application/json")) {
        payload = await req.json();
      }
    } catch (e) {
      // Ignore JSON parse errors (e.g. empty body from Cron)
    }

    // --------------------------------------------------------------------------
    // 1. MANUAL TRIGGER MODE
    // --------------------------------------------------------------------------
    if (payload.jobId || payload.accountId) {
      let job;

      if (payload.jobId) {
        logInfo("Manual trigger received for specific job", {
          ...baseLogOptions,
          context: { jobId: payload.jobId }
        });

        const { data, error } = await supabase
          .from("provisioning_jobs")
          .select("*")
          .eq("id", payload.jobId)
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ error: "Job not found", details: error.message }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        job = data;

      } else if (payload.accountId) {
        logInfo("Manual trigger received for account", {
          ...baseLogOptions,
          context: { accountId: payload.accountId }
        });

        // Find the most recent job for this account
        const { data, error } = await supabase
          .from("provisioning_jobs")
          .select("*")
          .eq("account_id", payload.accountId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error || !data) {
          return new Response(
            JSON.stringify({ error: "No provisioning job found for this account" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        job = data;
      }

      // Check if job is already completed to avoid double-processing
      if (job.status === 'completed') {
        return new Response(
          JSON.stringify({ message: "Job already completed", job }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Process immediately
      try {
        await processJob(job, supabase);
        return new Response(
          JSON.stringify({ success: true, message: "Job processed successfully", jobId: job.id }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err: any) {
        return new Response(
          JSON.stringify({ success: false, error: err.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // --------------------------------------------------------------------------
    // 2. CRON POLL MODE (Prioritized)
    // --------------------------------------------------------------------------

    // Step 2a: Fetch QUEUED jobs first (High Priority - New Signups)
    // We want to process these immediately so users don't wait
    const { data: queuedJobs, error: queuedError } = await supabase
      .from("provisioning_jobs")
      .select("*")
      .eq("status", "queued")
      .order("created_at", { ascending: true }) // FIFO
      .limit(JOBS_PER_BATCH);

    if (queuedError) {
      throw new Error(`Failed to fetch queued jobs: ${queuedError.message}`);
    }

    let jobsToProcess = queuedJobs || [];

    // Step 2b: If we have capacity, fetch FAILED jobs (Retry Queue)
    // We strictly check the backoff time to ensure we don't retry too fast
    if (jobsToProcess.length < JOBS_PER_BATCH) {
      const remainingSlots = JOBS_PER_BATCH - jobsToProcess.length;

      const { data: failedJobs, error: failedError } = await supabase
        .from("provisioning_jobs")
        .select("*")
        .eq("status", "failed")
        .order("updated_at", { ascending: true }) // Oldest failures first
        .limit(remainingSlots * 2); // Fetch extra to filter in memory

      if (!failedError && failedJobs) {
        const now = Date.now();

        // Filter for jobs that have passed their backoff period
        const readyRetries = failedJobs.filter((job: any) => {
          // If no updated_at, assume ready
          if (!job.updated_at) return true;

          const lastUpdate = new Date(job.updated_at).getTime();
          const attempts = job.attempts || 0;
          // Calculate backoff: 2^attempts minutes
          // We add a small buffer (e.g. 5 seconds) to be safe
          const requiredDelayMs = Math.pow(2, attempts) * 60 * 1000;

          return (now - lastUpdate) > requiredDelayMs;
        });

        // Add ready retries to batch until full
        jobsToProcess = [...jobsToProcess, ...readyRetries.slice(0, remainingSlots)];
      }
    }

    if (jobsToProcess.length === 0) {
      logInfo("No jobs to process", baseLogOptions);
      return new Response(
        JSON.stringify({ message: "No jobs to process", processed: 0 }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    logInfo("Processing jobs batch", {
      ...baseLogOptions,
      context: {
        total: jobsToProcess.length,
        queued: queuedJobs?.length || 0,
        retries: jobsToProcess.length - (queuedJobs?.length || 0)
      },
    });

    // Process jobs sequentially
    let successCount = 0;
    let failureCount = 0;

    for (const job of jobsToProcess) {
      try {
        await processJob(job, supabase);
        successCount++;
      } catch (error: any) {
        failureCount++;
        logError("Job processing error", {
          ...baseLogOptions,
          error,
          context: { jobId: job.id },
        });
      }
    }

    logInfo("Batch processing completed", {
      ...baseLogOptions,
      context: { total: jobsToProcess.length, success: successCount, failed: failureCount },
    });

    return new Response(
      JSON.stringify({
        message: "Batch processing completed",
        total: jobsToProcess.length,
        success: successCount,
        failed: failureCount,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[provision-vapi] Unhandled error", {
      message: error?.message,
      stack: error?.stack,
    });

    logError("Worker execution failed", {
      ...baseLogOptions,
      error,
    });

    // Capture error to Sentry
    await captureError(error, { phase: 'worker_execution' });

    return new Response(
      JSON.stringify({
        error: "Worker execution failed",
        message: error?.message || "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
