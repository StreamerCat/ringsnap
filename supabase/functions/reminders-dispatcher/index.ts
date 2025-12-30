
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { withSentryEdge } from "../_shared/sentry.ts";
import { logInfo, logError } from "../_shared/logging.ts";
import { sendAppointmentNotifications, Appointment, AccountSettings } from "../_shared/appointment-notifications.ts";

const FUNCTION_NAME = "reminders-dispatcher";

// Define the handler
async function handler(req: Request) {
    const correlationId = crypto.randomUUID();

    // 1. Auth Check (Service Role Only via Scheduler)
    // We can check for a shared secret or assume internal invocation if signed by system.
    // Standard Supabase Cron signs requests with header: "authorization: Bearer <service_role>"
    // We can just trust the Authorization header matches service role.
    // Or better, use a secret header checking like the user requested.

    const providedSecret = req.headers.get("x-cron-secret");
    const cronSecret = Deno.env.get("CRON_SECRET");

    // Strictly enforce secret checking for cron job
    if (!cronSecret || providedSecret !== cronSecret) {
        logError("Unauthorized cron attempt", { functionName, correlationId });
        return new Response("Unauthorized", { status: 401 });
    }

    const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    try {
        logInfo("Checking for appointment reminders", { functionName, correlationId });

        // 2. Query Appointments Needing Reminders
        // Filter: 
        // - Status = scheduled
        // - Reminder NOT sent
        // - Scheduled start is "Today" in the Account's timezone.

        // This date logic is tricky in SQL directly across mixed timezones.
        // Easier approach: Get all impending appointments (e.g. next 24 hours) that haven't had a reminder.
        // Filter in code for "is today?".
        // OR just send reminder 24h before?
        // User requirement: "reminder is sent on the day of the appointment"
        // So if appointment is at 4pm, and it's 8am same day, we send it.

        // We'll fetch all 'scheduled' appointments within next 24 hours where reminder_sent_at is null.
        // Then checks if "local date" == "today".

        const now = new Date();
        const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Next 24h

        const { data: appointments, error } = await supabase
            .from("appointments")
            .select(`
        *,
        accounts (
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
        )
      `)
            .eq("status", "scheduled")
            .is("reminder_sent_at", null)
            .lte("scheduled_start_at", windowEnd.toISOString()) // Only upcoming
            .gte("scheduled_start_at", now.toISOString()) // Don't remind for past? or maybe we should? "Day of" implies morning of.
            // If we missed it (cron failed), strictly we might send late.
            // Let's stick to future/present events. 
            .limit(50); // Batch size safety

        if (error) throw error;

        let sentCount = 0;

        for (const appt of (appointments || [])) {
            // Validation: Is it "Day of" in the account timezone?
            // accounts is joined.
            // We need to type cast properly.
            const account = appt.accounts as unknown as AccountSettings;
            if (!account) continue;

            const tz = account.timezone || appt.time_zone || 'America/Denver';

            // Current time in target TZ
            const nowInTz = new Date().toLocaleDateString("en-US", { timeZone: tz });
            const startInTz = new Date(appt.scheduled_start_at).toLocaleDateString("en-US", { timeZone: tz });

            if (nowInTz === startInTz) {
                // It is the day of the appointment!
                await sendAppointmentNotifications(
                    supabase,
                    appt as unknown as Appointment,
                    account,
                    'reminder',
                    correlationId
                );
                sentCount++;
            }
        }

        logInfo("Reminders dispatch complete", { functionName, correlationId, context: { sentCount, scanned: appointments?.length } });

        return new Response(JSON.stringify({ success: true, sent: sentCount }), {
            headers: { "Content-Type": "application/json" }
        });

    } catch (err) {
        logError("Reminders dispatch failed", { functionName, correlationId, error: err });
        return new Response("Internal Server Error", { status: 500 });
    }
}

Deno.serve(withSentryEdge({ functionName: FUNCTION_NAME }, async (req, ctx) => {
    return handler(req);
}));
