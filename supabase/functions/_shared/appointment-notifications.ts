
import { createClient } from "supabase";
import { sendSMS } from "./sms.ts";
import { sendEmail, buildEmailHtml } from "./resend-client.ts";
import { logInfo, logError } from "./logging.ts";

export interface Appointment {
    id: string;
    account_id: string;
    caller_name: string;
    caller_phone: string;
    caller_email: string | null;
    scheduled_start_at: string;
    time_zone: string;
    service_type: string | null;
    address: string | null;
    status: string;
}

export interface AccountSettings {
    company_name: string;
    notification_email: string | null;
    notification_sms_phone: string | null;
    notify_contractor_email: boolean;
    notify_caller_sms: boolean;
    notify_caller_email: boolean;
    sms_enabled: boolean;
    sms_appointment_confirmations: boolean;
    sms_reminders: boolean;
    timezone: string; // Account timezone for consistency
}

/**
 * Send Appointment Notifications
 * Handles both Confirmations and Reminders to Contractor and Caller
 */
export async function sendAppointmentNotifications(
    supabase: any,
    appointment: Appointment,
    account: AccountSettings,
    type: 'confirmation' | 'reminder',
    correlationId: string
): Promise<void> {
    const functionName = 'appointment-notifications';

    // Format Date Logic
    // We prioritize the appointment's timezone if set, otherwise account timezone
    const tz = appointment.time_zone || account.timezone || 'America/Denver';

    const date = new Date(appointment.scheduled_start_at);
    const formattedDate = new Intl.DateTimeFormat("en-US", {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: tz,
        timeZoneName: 'short'
    }).format(date);

    const context = {
        functionName,
        correlationId,
        appointmentId: appointment.id,
        type
    };

    logInfo(`Sending ${type} notifications`, context);

    // 1. Prepare Messages
    const contractorSubject = type === 'confirmation'
        ? `New Appointment: ${appointment.caller_name}`
        : `Reminder: Appointment with ${appointment.caller_name}`;

    const callerSubject = type === 'confirmation'
        ? `Appointment Confirmed: ${account.company_name}`
        : `Appointment Reminder: ${account.company_name}`;

    const serviceText = appointment.service_type ? `for ${appointment.service_type}` : "";

    // Content for Contractor
    const contractorMessage = `
${type === 'confirmation' ? 'New Booking' : 'Reminder'}: ${appointment.caller_name} ${serviceText}
Time: ${formattedDate}
Phone: ${appointment.caller_phone}
${appointment.address ? `Address: ${appointment.address}` : ''}
  `.trim();

    // Content for Caller
    const callerMessage = `
${type === 'confirmation' ? 'Confirmed' : 'Reminder'}: Your appointment with ${account.company_name} is ${formattedDate}.
  `.trim();


    // 2. Send Contractor Notifications

    // A) Contractor SMS (Gated by existing sms_* flags)
    // sms_enabled must be true AND specific gate must be true
    const smsGate = type === 'confirmation'
        ? account.sms_appointment_confirmations
        : account.sms_reminders;

    if (account.sms_enabled && smsGate && account.notification_sms_phone) {
        await sendSMS({
            to: account.notification_sms_phone,
            message: contractorMessage,
            functionName,
            correlationId
        });
    }

    // B) Contractor Email (Gated by new notify_contractor_email flag)
    // Note: confirmation/reminder specific logic could be added, but for now specific toggle controls all contractor emails or we use generic switch
    // Phase 1 migration only added notify_contractor_email (boolean default true).
    // We assume this applies to both confirmations and reminders for now.
    if (account.notify_contractor_email && account.notification_email) {
        const html = buildEmailHtml(
            contractorSubject,
            `
      <p><strong>${type === 'confirmation' ? 'New Appointment Booked' : 'Upcoming Appointment'}</strong></p>
      <p><strong>Customer:</strong> ${appointment.caller_name}</p>
      <p><strong>Time:</strong> ${formattedDate}</p>
      <p><strong>Phone:</strong> <a href="tel:${appointment.caller_phone}">${appointment.caller_phone}</a></p>
      ${appointment.caller_email ? `<p><strong>Email:</strong> ${appointment.caller_email}</p>` : ''}
      ${appointment.service_type ? `<p><strong>Service:</strong> ${appointment.service_type}</p>` : ''}
      ${appointment.address ? `<p><strong>Address:</strong> ${appointment.address}</p>` : ''}
      ${appointment.notes ? `<p><strong>Notes:</strong> ${appointment.notes}</p>` : ''}
      `
        );

        await sendEmail(Deno.env.get("RESEND_API_KEY") ?? "", {
            to: account.notification_email,
            subject: contractorSubject,
            html,
            text: contractorMessage,
            // No from/reply_to override needed (uses default)
        });
    }


    // 3. Send Caller Notifications

    // A) Caller SMS
    if (account.notify_caller_sms && appointment.caller_phone) {
        // Only send if phone looks valid (rudimentary check handled by sendSMS utility actually)
        await sendSMS({
            to: appointment.caller_phone,
            message: callerMessage,
            functionName,
            correlationId
        });
    }

    // B) Caller Email
    if (account.notify_caller_email && appointment.caller_email) {
        const html = buildEmailHtml(
            callerSubject,
            `
      <p>Hi ${appointment.caller_name},</p>
      <p>This is a ${type === 'confirmation' ? 'confirmation' : 'reminder'} for your appointment with <strong>${account.company_name}</strong>.</p>
      <p><strong>When:</strong> ${formattedDate}</p>
      ${appointment.address ? `<p><strong>Where:</strong> ${appointment.address}</p>` : ''}
      `
        );

        await sendEmail(Deno.env.get("RESEND_API_KEY") ?? "", {
            to: appointment.caller_email,
            subject: callerSubject,
            html,
            text: callerMessage
        });
    }

    // 4. Update Database Timestamp
    // We do not wait for this to throw, but we should await it to ensure it completes
    const updateField = type === 'confirmation' ? 'confirmation_sent_at' : 'reminder_sent_at';

    await supabase
        .from('appointments')
        .update({ [updateField]: new Date().toISOString() })
        .eq('id', appointment.id);

    logInfo(`${type} notifications process complete`, context);
}
