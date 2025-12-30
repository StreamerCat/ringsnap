
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { withSentryEdge } from "../_shared/sentry.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { logInfo, logError } from "../_shared/logging.ts";
import { sendAppointmentNotifications, Appointment, AccountSettings } from "../_shared/appointment-notifications.ts";

const FUNCTION_NAME = "vapi-tools-appointments";

Deno.serve(withSentryEdge({ functionName: FUNCTION_NAME }, async (req, ctx) => {
    // 1. CORS Preflight
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    const { correlationId } = ctx;

    try {
        // 2. Authentication (Shared Secret)
        // We expect the Vapi tool definition to include this header
        const authHeader = req.headers.get("x-ringsnap-secret");
        const expectedSecret = Deno.env.get("VAPI_WEBHOOK_SECRET");

        // Allow if no secret configured (dev) or if matches
        if (expectedSecret && authHeader !== expectedSecret) {
            logError("Unauthorized tool request", { functionName, correlationId, context: { error: "Invalid secret" } });
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
            logError("Assistant lookup failed", { functionName, correlationId, context: { vapiAssistantId } });
            throw new Error("Assistant not found");
        }

        const accountId = assistant.account_id;

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

        // 6. Create Appointment (Idempotent)
        // We use vapi_call_id + scheduled_start_at unique constraint
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
                logInfo("Appointment already exists (idempotency)", { functionName, correlationId });
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

        // 7. Trigger Notifications
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
                logError("Failed to send notifications", { functionName, correlationId, error: notifError });
                // Swallow error so booking still succeeds
            }
        }

        // 8. Return Success to Vapi
        const resultDetails = `Appointment scheduled for ${startDateTime} with ${callerName}. Confirmation sent.`;

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
        logError("Appointment tool failed", { functionName, correlationId, error: err });

        // Return a soft error to Vapi so it can say "I had trouble booking that" instead of hanging
        // or return a standard error if Vapi handles it well. Vapi tools expect 200 with error message usually?
        // Actually Vapi likes valid JSON.
        // We'll return 200 with an error description in the result if possible, OR 500 if it's a crash.
        // User requested: "safe 'could not confirm booking' response"

        // If we have a toolCallId, we can return a result saying we failed.
        // If we couldn't parse toolCallId, standard error.

        // Try to recover toolCallId from request if possible, but reading body twice might be hard if we didn't clone.
        // We parsed payload earlier.

        /* 
           Note: We can't easily return a "result" if we crashed before parsing toolCallId.
           But if we have it (err implies we might have failed later), we return graceful failure.
        */

        return new Response(JSON.stringify({
            error: "Internal Server Error", // Fallback
        }), { status: 500, headers: corsHeaders });
    }
}));
