/*
 * ═══════════════════════════════════════════════════════════════════════════
 * FUNCTION: provision-vapi (ASYNC WORKER)
 *
 * PURPOSE: Process queued provisioning jobs asynchronously with retry logic
 *
 * FLOW:
 *   1. Poll for queued/failed jobs (with SKIP LOCKED for concurrency)
 *   2. Mark job as processing
 *   3. Create Vapi assistant idempotently
 *   4. Provision Vapi phone number with area code fallback
 *   5. Update account with provisioning results
 *   6. Mark job as completed or failed
 *   7. Implement exponential backoff for retries
 *
 * RETRY LOGIC:
 *   - Max attempts: 5
 *   - Backoff: 2^attempt minutes
 *   - Permanent failure after max attempts
 *
 * IDEMPOTENCY:
 *   - Check if assistant/phone already exists before creating
 *   - Safe to run multiple times on same account
 *
 * CRON SCHEDULE:
 *   - Triggered every 30 seconds via Supabase cron
 *   - Processes up to 10 jobs per invocation
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

// import { serve } from "https://deno.land/std@0.168.0/http/server.ts"; // Removed: Causes event loop issues in new runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?target=deno";
import { extractCorrelationId, logError, logInfo, logWarn } from "../_shared/logging.ts";
import { buildVapiPrompt } from "../_shared/template-builder.ts";

const FUNCTION_NAME = "provision-vapi";
const VAPI_API_KEY = Deno.env.get("VAPI_API_KEY");
const VAPI_BASE_URL = "https://api.vapi.ai";
const MAX_RETRY_ATTEMPTS = 5;
const JOBS_PER_BATCH = 10;

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
  accountId: string,
  metadata: any,
  correlationId: string
): Promise<{ vapiAssistantId: string; vapiAssistantDbId: string }> {
  const baseLogOptions = {
    functionName: FUNCTION_NAME,
    correlationId,
    accountId,
  };

  // Build prompt
  const prompt = await buildVapiPrompt({
    company_name: metadata.company_name,
    trade: metadata.trade,
    service_area: metadata.service_area || "",
    business_hours: metadata.business_hours || "Monday-Friday 8am-5pm",
    emergency_policy: metadata.emergency_policy || "Available 24/7 for emergencies",
    company_website: metadata.company_website || "",
    custom_instructions: "",
  });

  const voiceId = metadata.assistant_gender === "male" ? "michael" : "sarah";

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
  };

  logInfo("Creating Vapi assistant", {
    ...baseLogOptions,
    context: { companyName: metadata.company_name, voice: voiceId },
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
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl!, supabaseServiceRoleKey!);

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
 * Provision Vapi phone number with area code fallback
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

  const requestedAreaCode = metadata.area_code || "415";
  const fallbackPhone = metadata.fallback_phone;

  // Vapi API requires provider field and doesn't accept assistantId/fallbackDestination in phone creation
  const phonePayload = {
    provider: "vapi",
    numberType: "local",
    areaCode: requestedAreaCode,
  };

  logInfo("Provisioning Vapi phone number", {
    ...baseLogOptions,
    context: { areaCode: requestedAreaCode },
  });

  let phoneResponse = await fetch(`${VAPI_BASE_URL}/phone-number`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${VAPI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(phonePayload),
  });

  // Area code fallback
  if (!phoneResponse.ok && phoneResponse.status === 400) {
    const errorText = await phoneResponse.text();
    if (errorText.includes("area") || errorText.includes("unavailable")) {
      logWarn("Requested area code unavailable, using fallback", {
        ...baseLogOptions,
        context: { requestedAreaCode },
      });

      // Retry without area code restriction
      delete phonePayload.areaCode;

      phoneResponse = await fetch(`${VAPI_BASE_URL}/phone-number`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${VAPI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(phonePayload),
      });
    }
  }

  if (!phoneResponse.ok) {
    const errorText = await phoneResponse.text();
    throw new Error(
      `Vapi phone provisioning failed: ${phoneResponse.status} ${errorText}`
    );
  }

  const vapiPhone = await phoneResponse.json();
  const phoneE164 = vapiPhone.number || vapiPhone.phone_e164;
  const vapiPhoneId = vapiPhone.id;

  logInfo("Vapi phone number provisioned", {
    ...baseLogOptions,
    context: { phoneE164, vapiPhoneId },
  });

  // Insert into DB
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl!, supabaseServiceRoleKey!);

  const { data: phoneRow, error: phoneDbError } = await supabase
    .from("phone_numbers")
    .insert({
      account_id: accountId,
      phone_number: phoneE164,
      area_code: requestedAreaCode,
      vapi_phone_id: vapiPhoneId,
      vapi_id: vapiPhoneId,
      purpose: "primary",
      status: "active",
      is_primary: true,
      activated_at: new Date().toISOString(),
      raw: vapiPhone,
    })
    .select("id")
    .single();

  if (phoneDbError) {
    throw new Error(`Failed to save phone to DB: ${phoneDbError.message}`);
  }

  return {
    phoneE164,
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

    // Update account provisioning status
    await supabase.rpc("update_provisioning_lifecycle", {
      p_account_id: job.account_id,
      p_status: "processing",
    });

    // Fetch account data (since metadata column doesn't exist in provisioning_jobs)
    const { data: accountData, error: accountError } = await supabase
      .from("accounts")
      .select("company_name, trade, service_area, business_hours, emergency_policy, company_website, assistant_gender, wants_advanced_voice, zip_code")
      .eq("id", job.account_id)
      .single();

    if (accountError || !accountData) {
      throw new Error(`Failed to fetch account data: ${accountError?.message || "Account not found"}`);
    }

    // Fetch profile data for phone number
    const { data: profileData } = await supabase
      .from("profiles")
      .select("phone")
      .eq("account_id", job.account_id)
      .eq("is_primary", true)
      .single();

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
      area_code: accountData.zip_code?.slice(0, 3) || "415",
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

    if (payload.triggered_by) {
      logInfo("Worker triggered directly", {
        ...baseLogOptions,
        context: { source: payload.triggered_by }
      });
    }

    // Poll for jobs (queued or failed with retry_after passed)
    const { data: jobs, error: jobsError } = await supabase
      .from("provisioning_jobs")
      .select("*")
      .or(`status.eq.queued,status.eq.failed`)
      .limit(JOBS_PER_BATCH)
      .order("created_at", { ascending: true });

    if (jobsError) {
      throw new Error(`Failed to fetch jobs: ${jobsError.message}`);
    }

    if (!jobs || jobs.length === 0) {
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
      context: { jobCount: jobs.length },
    });

    // Process jobs sequentially (could be parallelized with Promise.all)
    let successCount = 0;
    let failureCount = 0;

    for (const job of jobs) {
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
      context: { total: jobs.length, success: successCount, failed: failureCount },
    });

    return new Response(
      JSON.stringify({
        message: "Batch processing completed",
        total: jobs.length,
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
