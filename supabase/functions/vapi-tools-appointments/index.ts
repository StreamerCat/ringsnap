import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { withSentryEdge } from "../_shared/sentry.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { logInfo, logError, logWarn, extractTraceId, stepStart, stepEnd, stepError } from "../_shared/logging.ts";
import { sendAppointmentNotifications, Appointment, AccountSettings } from "../_shared/appointment-notifications.ts";
import { checkSlotConflict } from "../_shared/availability.ts";

const FUNCTION_NAME = "vapi-tools-appointments";

// Feature flag for conflict enforcement (default ON)
const CONFLICT_ENFORCEMENT_ENABLED =
    Deno.env.get("APPOINTMENT_CONFLICT_ENFORCEMENT") !== "false";

Deno.serve(withSentryEdge({ functionName: FUNCTION_NAME }, async (req, ctx) => {
    // 1. CORS Preflight
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    const { correlationId } = ctx;
    let toolCallId: string | null = null;
    const traceId = extractTraceId(req);
    let accountId: string | undefined;

    try {
        // 2. Authentication (Shared Secret)
        // We expect the Vapi tool definition to include this header
        const authHeader = req.headers.get("x-ringsnap-secret");
        const expectedSecret = Deno.env.get("VAPI_WEBHOOK_SECRET");

        // Allow if no secret configured (dev) or if matches
        if (expectedSecret && authHeader !== expectedSecret) {
            logError("Unauthorized tool request", { functionName: FUNCTION_NAME, correlationId, context: { error: "Invalid secret" } });
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
        }

        // 3. Parse Request
        const payload = await req.json();
        const message = payload.message;
        const toolCall = payload.toolCall; // Vapi structure

        if (!message || !toolCall) {
            // Vapi sometimes sends just the tool call in different formats, but for 'server' tools it's usually this structure.
            // If it's a direct browser test, structure might differ.
            throw new Error("Invalid payload: missing message or toolCall");
        }

        toolCallId = toolCall.id;

        const {
            startDateTime,
            endDateTime,
            timeZone,
            callerName,
            callerPhone,
            callerEmail,
            serviceType,
            address,
            notes
        } = toolCall.function.arguments;

        if (!startDateTime || !callerName || !callerPhone) {
            throw new Error("Missing required arguments: startDateTime, callerName, callerPhone");
        }

        // 4. Resolve Account
        // We use the assistantId from the call to find the account
        const vapiAssistantId = message.call?.assistantId;

        if (!vapiAssistantId) {
            throw new Error("Missing assistantId in call metadata");
        }

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const { data: assistant, error: assistantError } = await supabase
            .from("vapi_assistants")
            .select("account_id, id")
            .eq("vapi_assistant_id", vapiAssistantId)
            .single();

        if (assistantError || !assistant) {
            // Fallback: Try looking up by phone number if assistant logic fails or is shared? 
            // For now, strict requirement: Assistant must be registered.
            logError("Assistant lookup failed", { functionName: FUNCTION_NAME, correlationId, context: { vapiAssistantId } });
            throw new Error("Assistant not found");
        }

        accountId = assistant.account_id;
        const base = { functionName: FUNCTION_NAME, traceId, accountId };
        const bookingStart = Date.now();

        stepStart('book_appointment', base, { callerName, vapiAssistantId });

        // 5. Get Account Settings for Notification
        const { data: account, error: accountError } = await supabase
            .from("accounts")
            .select(`
        company_name,
        notification_email,
        notification_sms_phone,
        notify_contractor_email,
        notify_caller_sms,
        notify_caller_email,
        sms_enabled,
        sms_appointment_confirmations,
        sms_reminders,
        timezone
      `)
            .eq("id", accountId)
            .single();

        if (accountError || !account) {
            throw new Error("Account not found");
        }

        // ═══════════════════════════════════════════════════════════════
        // 6. PHASE 1: CONFLICT CHECK (Write-Time Protection)
        // Even if we didn't offer this time (caller requested manually),
        // we must verify no conflict exists to prevent race conditions.
        // ═══════════════════════════════════════════════════════════════

        if (CONFLICT_ENFORCEMENT_ENABLED) {
            logInfo("Checking for slot conflicts", {
                functionName: FUNCTION_NAME,
                correlationId,
                accountId,
                context: { startDateTime, endDateTime },
            });

            const conflictResult = await checkSlotConflict(
                supabase,
                accountId,
                startDateTime,
                endDateTime || null,
                60, // Default to 60 minute duration if no end time
                correlationId
            );

            if (conflictResult.hasConflict) {
                logWarn("Slot conflict detected at booking time", {
                    functionName: FUNCTION_NAME,
                    correlationId,
                    accountId,
                    context: {
                        requestedStart: startDateTime,
                        conflictId: conflictResult.conflictingAppointment?.id,
                        alternativesCount: conflictResult.alternativeSlots?.length || 0,
                    },
                });

                // Format alternative slots for voice
                let alternativeMessage = "I'm sorry, but that time slot is no longer available.";

                if (conflictResult.alternativeSlots && conflictResult.alternativeSlots.length > 0) {
                    const altTimes = conflictResult.alternativeSlots.slice(0, 3).map((slot) => {
                        const startTime = new Date(slot.start);
                        const hours = startTime.getHours();
                        const minutes = startTime.getMinutes();
                        const period = hours >= 12 ? "PM" : "AM";
                        const displayHour = hours % 12 || 12;
                        const displayMinutes = minutes > 0 ? `:${minutes.toString().padStart(2, "0")}` : "";
                        return `${displayHour}${displayMinutes} ${period}`;
                    });

                    if (altTimes.length === 1) {
                        alternativeMessage += ` I do have ${altTimes[0]} available. Would that work for you?`;
                    } else {
                        const lastAlt = altTimes.pop();
                        alternativeMessage += ` I do have ${altTimes.join(", ")} and ${lastAlt} available. Would any of those work for you?`;
                    }
                } else {
                    alternativeMessage += " Would you like me to check availability for a different day?";
                }

                return new Response(JSON.stringify({
                    results: [
                        {
                            toolCallId: toolCall.id,
                            result: alternativeMessage,
                            error: "slot_unavailable",
                            data: {
                                conflict: true,
                                requestedTime: startDateTime,
                                alternativeSlots: conflictResult.alternativeSlots || [],
                            },
                        }
                    ]
                }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // 7. Create Appointment (Idempotent)
        // We use vapi_call_id + scheduled_start_at unique constraint
        // ═══════════════════════════════════════════════════════════════
        const vapiCallId = message.call.id;

        // Safety: ensure vapiCallId exists.
        if (!vapiCallId) {
            throw new Error("Missing vapi call.id");
        }

        const appointmentData = {
            account_id: accountId,
            assistant_id: assistant.id,
            vapi_call_id: vapiCallId,
            caller_name: callerName,
            caller_phone: callerPhone,
            caller_email: callerEmail || null,
            scheduled_start_at: startDateTime,
            scheduled_end_at: endDateTime || null,
            time_zone: timeZone || account.timezone || 'America/Denver',
            service_type: serviceType || null,
            address: address || null,
            notes: notes || null,
            status: 'scheduled'
        };

        const { data: appointment, error: insertError } = await supabase
            .from("appointments")
            .insert(appointmentData)
            .select()
            .single();

        let finalAppointment = appointment;

        if (insertError) {
            if (insertError.code === '23505') { // Unique violation
                logInfo("Appointment already exists (idempotency)", { functionName: FUNCTION_NAME, correlationId });
                // Fetch existing
                const { data: existing } = await supabase
                    .from("appointments")
                    .select()
                    .eq("vapi_call_id", vapiCallId)
                    .eq("scheduled_start_at", startDateTime)
                    .single();
                finalAppointment = existing;
            } else {
                throw insertError;
            }
        }

        logInfo("Appointment created/confirmed", {
            functionName: FUNCTION_NAME,
            correlationId,
            accountId,
            context: {
                appointmentId: finalAppointment?.id,
                startDateTime,
                callerName,
                enforced: CONFLICT_ENFORCEMENT_ENABLED,
            },
        });

        // 8. Trigger Notifications
        // Only if newly created or confirmation not sent yet
        if (finalAppointment && !finalAppointment.confirmation_sent_at) {
            // Run in background (don't await strictly to return Vapi response fast? 
            // No, Vapi waits for tool response, better to finish sending to be sure.)
            // But we want to be fast.
            // We'll await it but wrap in try/catch so we don't fail the tool call if notifications fail.
            try {
                await sendAppointmentNotifications(
                    supabase,
                    finalAppointment as Appointment, // Type cast since we fetched fresh
                    account as AccountSettings,
                    'confirmation',
                    correlationId
                );
            } catch (notifError) {
                logError("Failed to send notifications", { functionName: FUNCTION_NAME, correlationId, error: notifError });
                // Swallow error so booking still succeeds
            }
        }

        // 9. Return Success to Vapi
        const startTime = new Date(startDateTime);
        const hours = startTime.getHours();
        const minutes = startTime.getMinutes();
        const period = hours >= 12 ? "PM" : "AM";
        const displayHour = hours % 12 || 12;
        const displayMinutes = minutes > 0 ? `:${minutes.toString().padStart(2, "0")}` : "";
        const formattedTime = `${displayHour}${displayMinutes} ${period}`;

        const resultDetails = `Perfect! I've booked your appointment for ${formattedTime}. You'll receive a confirmation text and email shortly. Is there anything else I can help you with?`;

        stepEnd('book_appointment', base, { result: 'success', appointmentId: finalAppointment?.id }, bookingStart);

        return new Response(JSON.stringify({
            results: [
                {
                    toolCallId: toolCall.id,
                    result: resultDetails
                }
            ]
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (err: any) {
        const base = { functionName: FUNCTION_NAME, traceId, accountId };
        stepError('book_appointment', base, err, { reason_code: err.message });

        logError("Appointment tool failed", { functionName: FUNCTION_NAME, correlationId, error: err });

        // Return a graceful error to Vapi if we have the toolCallId
        if (toolCallId) {
            return new Response(JSON.stringify({
                results: [
                    {
                        toolCallId: toolCallId,
                        result: "I apologize, but I'm having trouble confirming that booking right now. Let me take your information and someone will call you back to confirm the appointment.",
                        error: "booking_failed"
                    }
                ]
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        return new Response(JSON.stringify({
            error: "Internal Server Error", // Fallback
        }), { status: 500, headers: corsHeaders });
    }
}));
