/*
 * ═══════════════════════════════════════════════════════════════════════════
 * FUNCTION: booking-schedule (BOOKING FLOW INTERFACE)
 *
 * PURPOSE: Handle appointment booking requests from Vapi or other systems.
 *          Phase 1: SMS-only booking (manual confirmation)
 *          Phase 2: Direct calendar booking (Google/Microsoft/Apple via aggregator)
 *
 * CORE FLOW:
 *   1. Validate input
 *   2. Load account booking preferences
 *   3. Create appointment record
 *   4. If SMS-only: Send SMS to account owner
 *   5. If direct calendar: TODO - Integrate with calendar API
 *
 * INPUT:
 *   {
 *     account_id: "uuid",
 *     customer_name: "string",
 *     customer_phone: "string",
 *     job_type?: "string",
 *     job_description?: "string",
 *     preferred_time_range?: "string"
 *   }
 *
 * OUTPUT (Success):
 *   {
 *     success: true,
 *     appointment_id: "uuid",
 *     booking_mode: "sms_only" | "direct_calendar",
 *     message: "Appointment request created"
 *   }
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { logError, logInfo, logWarn } from "../_shared/logging.ts";
import { sendSMS } from "../_shared/sms.ts";
import { getRequiredEnv, assertEnv } from "../_shared/env-validation.ts";

const FUNCTION_NAME = "booking-schedule";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const bookingRequestSchema = z.object({
  account_id: z.string().uuid("Invalid account_id"),
  customer_name: z.string().min(1, "Customer name required"),
  customer_phone: z.string().min(1, "Customer phone required"),
  customer_email: z.string().email("Invalid email").optional(),
  job_type: z.string().optional(),
  job_description: z.string().optional(),
  preferred_time_range: z.string().optional(),
});

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const correlationId = `booking-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  const baseLogOptions = {
    functionName: FUNCTION_NAME,
    correlationId,
  };

  // Validate required environment variables
  try {
    const requiredVars = getRequiredEnv(['SUPABASE', 'TWILIO']);
    assertEnv(requiredVars, FUNCTION_NAME);
  } catch (envError: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Service configuration error. Please contact support.",
        details: envError.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    logInfo("Starting booking request", { ...baseLogOptions });

    // ═══════════════════════════════════════════════════════════════
    // INPUT VALIDATION
    // ═══════════════════════════════════════════════════════════════

    let rawData: any;
    try {
      rawData = await req.json();
    } catch (err: any) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let data: z.infer<typeof bookingRequestSchema>;
    try {
      data = bookingRequestSchema.parse(rawData);
    } catch (zodError: any) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid input data",
          details: zodError.errors,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // INITIALIZE SUPABASE CLIENT
    // ═══════════════════════════════════════════════════════════════

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ═══════════════════════════════════════════════════════════════
    // LOAD ACCOUNT BOOKING PREFERENCES
    // ═══════════════════════════════════════════════════════════════

    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("booking_mode, calendar_external_link, destination_phone, company_name")
      .eq("id", data.account_id)
      .single();

    if (accountError || !account) {
      logError("Account not found", {
        ...baseLogOptions,
        context: { account_id: data.account_id },
        error: accountError
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Account not found",
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const bookingMode = account.booking_mode || "sms_only";

    logInfo("Processing booking request", {
      ...baseLogOptions,
      context: {
        account_id: data.account_id,
        booking_mode: bookingMode,
        customer: data.customer_name,
      },
    });

    // ═══════════════════════════════════════════════════════════════
    // CREATE APPOINTMENT RECORD
    // ═══════════════════════════════════════════════════════════════

    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .insert({
        account_id: data.account_id,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        customer_email: data.customer_email,
        job_type: data.job_type,
        job_description: data.job_description,
        preferred_time_range: data.preferred_time_range,
        status: "pending_confirmation",
        booking_source: "phone_call",
        metadata: {
          correlation_id: correlationId,
        },
      })
      .select("id")
      .single();

    if (appointmentError || !appointment) {
      logError("Failed to create appointment", {
        ...baseLogOptions,
        error: appointmentError
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to create appointment",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logInfo("Appointment record created", {
      ...baseLogOptions,
      context: { appointment_id: appointment.id },
    });

    // ═══════════════════════════════════════════════════════════════
    // HANDLE BOOKING MODE
    // ═══════════════════════════════════════════════════════════════

    if (bookingMode === "sms_only") {
      // ★★★ PHASE 1: SMS ONLY BOOKING ★★★
      // Send SMS to account owner with appointment details

      const destinationPhone = account.destination_phone;

      if (destinationPhone) {
        const smsMessage = `New appointment request from ${data.customer_name} (${data.customer_phone}).\n` +
          `Job: ${data.job_type || "Not specified"}\n` +
          `Preferred time: ${data.preferred_time_range || "Not specified"}\n` +
          `Reply to confirm or call customer directly.`;

        // Send SMS notification (best-effort, don't block appointment creation)
        try {
          const smsResult = await sendSMS({
            to: destinationPhone,
            message: smsMessage,
            functionName: FUNCTION_NAME,
            correlationId,
          });

          if (smsResult.success) {
            logInfo("SMS notification sent", {
              ...baseLogOptions,
              context: {
                to: destinationPhone,
                messageId: smsResult.messageId,
                appointment_id: appointment.id,
              },
            });
          } else {
            logWarn("SMS notification failed (non-blocking)", {
              ...baseLogOptions,
              context: {
                to: destinationPhone,
                error: smsResult.error,
                appointment_id: appointment.id,
              },
            });
          }
        } catch (smsError) {
          logError("SMS send exception (non-blocking)", {
            ...baseLogOptions,
            error: smsError instanceof Error ? smsError : new Error(String(smsError)),
            context: { appointment_id: appointment.id },
          });
        }
      } else {
        logWarn("No destination phone configured for account", {
          ...baseLogOptions,
          context: { account_id: data.account_id, appointment_id: appointment.id },
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          appointment_id: appointment.id,
          booking_mode: "sms_only",
          message: "Appointment request created. Owner will be notified via SMS.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (bookingMode === "direct_calendar") {
      // ★★★ PHASE 2: DIRECT CALENDAR BOOKING ★★★
      // TODO: Implement calendar integration
      //
      // Options:
      // 1. Use calendar aggregator (e.g., Nylas, Cal.com API)
      // 2. Native Google Calendar API
      // 3. Native Microsoft Graph API
      // 4. Native Apple Calendar via CalDAV
      //
      // For now, fall back to SMS with external link

      logInfo("Direct calendar booking requested (not yet implemented)", {
        ...baseLogOptions,
        context: { external_link: account.calendar_external_link },
      });

      const destinationPhone = account.destination_phone;

      if (destinationPhone) {
        let smsMessage = `New appointment request from ${data.customer_name} (${data.customer_phone}).\n` +
          `Job: ${data.job_type || "Not specified"}\n` +
          `Preferred time: ${data.preferred_time_range || "Not specified"}\n`;

        if (account.calendar_external_link) {
          smsMessage += `\nBook via calendar: ${account.calendar_external_link}`;
        }

        smsMessage += `\nReply to confirm or call customer directly.`;

        // Send SMS notification (best-effort, don't block appointment creation)
        try {
          const smsResult = await sendSMS({
            to: destinationPhone,
            message: smsMessage,
            functionName: FUNCTION_NAME,
            correlationId,
          });

          if (smsResult.success) {
            logInfo("SMS notification with calendar link sent", {
              ...baseLogOptions,
              context: {
                to: destinationPhone,
                messageId: smsResult.messageId,
                appointment_id: appointment.id,
              },
            });
          } else {
            logWarn("SMS notification failed (non-blocking)", {
              ...baseLogOptions,
              context: {
                to: destinationPhone,
                error: smsResult.error,
                appointment_id: appointment.id,
              },
            });
          }
        } catch (smsError) {
          logError("SMS send exception (non-blocking)", {
            ...baseLogOptions,
            error: smsError instanceof Error ? smsError : new Error(String(smsError)),
            context: { appointment_id: appointment.id },
          });
        }
      } else {
        logWarn("No destination phone configured for account", {
          ...baseLogOptions,
          context: { account_id: data.account_id, appointment_id: appointment.id },
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          appointment_id: appointment.id,
          booking_mode: "direct_calendar",
          message: "Appointment request created. Direct calendar booking coming soon. Owner notified via SMS.",
          note: "Direct calendar integration will be available in Phase 2",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fallback (shouldn't reach here)
    return new Response(
      JSON.stringify({
        success: true,
        appointment_id: appointment.id,
        message: "Appointment request created",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    logError("Unexpected error in booking-schedule", {
      ...baseLogOptions,
      context: { stack: error.stack },
      error
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Internal server error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
