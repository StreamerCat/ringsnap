/**
 * Appointment Detection & Metrics
 * 
 * Single source of truth for determining if a call resulted in a booked appointment
 * and deriving appointment display information from call log fields.
 * 
 * This replaces the previous approach of querying a separate 'appointments' table.
 * All data comes from call_logs fields: outcome, booked, appointment_window, appointment_start
 */

import { type CallLog as BaseCallLog } from '@/lib/leadScore';

// Extend the base CallLog type to include all fields we need
export interface CallLogWithAppointment extends BaseCallLog {
    id?: string;
    started_at?: string;
    from_number?: string;
    caller_name?: string;
    reason?: string;
    appointment_start?: string | null;
    appointment_end?: string | null;
    appointment_window?: string | null;
    address?: string | null;
}

export interface AppointmentEvent {
    id: string;
    customerName: string;
    customerPhone: string;
    address: string;
    jobType: string;
    hasDateTime: boolean;
    start?: Date;
    displayWhen: string;
    displayDay?: string;
    callStartedAt: string;
}

export interface AppointmentMetrics {
    bookedTodayCount: number;
    nextEvent: AppointmentEvent | null;
}

/**
 * Check if a call resulted in a booked appointment.
 * Matches the existing badge logic used in OperatorOverview and OverviewTab.
 */
export function isBookedCall(call: CallLogWithAppointment | null | undefined): boolean {
    if (!call) return false;
    return (
        call.outcome === 'booked' ||
        call.booked === true ||
        !!call.appointment_window ||
        !!call.appointment_start
    );
}

/**
 * Attempt to parse an appointment datetime string.
 * Returns null if the string is not a parseable datetime.
 */
function tryParseDateTime(value: string | null | undefined): Date | null {
    if (!value) return null;

    // Try direct parse
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
        return date;
    }

    return null;
}

/**
 * Extract appointment display information from a call.
 * Handles both parseable datetimes and free-text windows like "tuesday morning".
 */
export function getAppointmentDisplay(call: CallLogWithAppointment): {
    hasDateTime: boolean;
    start?: Date;
    displayWhen: string;
    displayDay?: string;
} {
    // Try to parse appointment_start first
    const parsedStart = tryParseDateTime(call.appointment_start);

    if (parsedStart) {
        return {
            hasDateTime: true,
            start: parsedStart,
            displayWhen: parsedStart.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
            displayDay: parsedStart.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }),
        };
    }

    // Fall back to appointment_window (free text like "tuesday morning")
    if (call.appointment_window) {
        return {
            hasDateTime: false,
            displayWhen: call.appointment_window,
        };
    }

    // No appointment time info available
    return {
        hasDateTime: false,
        displayWhen: 'Time TBD',
    };
}

/**
 * Convert booked calls to normalized appointment events.
 * Only includes calls where isBookedCall() returns true.
 */
export function deriveAppointmentEvents(calls: CallLogWithAppointment[]): AppointmentEvent[] {
    return calls
        .filter(isBookedCall)
        .map((call) => {
            const display = getAppointmentDisplay(call);
            return {
                id: call.id || crypto.randomUUID(),
                customerName: call.caller_name || 'Unknown caller',
                customerPhone: call.from_number || call.caller_phone || '',
                address: call.address || 'Address not provided',
                jobType: call.reason || 'General inquiry',
                hasDateTime: display.hasDateTime,
                start: display.start,
                displayWhen: display.displayWhen,
                displayDay: display.displayDay,
                callStartedAt: call.started_at || new Date().toISOString(),
            };
        });
}

/**
 * Calculate appointment metrics from calls created today.
 * 
 * @param calls - All calls (will be filtered to today and booked)
 * @returns Metrics including today's booked count and next appointment
 */
export function deriveAppointmentMetrics(calls: CallLogWithAppointment[]): AppointmentMetrics {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Filter to calls created today
    const todaysCalls = calls.filter((call) => {
        const callDate = new Date(call.started_at || 0);
        return callDate >= startOfToday;
    });

    // Get booked calls from today
    const bookedToday = todaysCalls.filter(isBookedCall);
    const bookedTodayCount = bookedToday.length;

    // Derive events from all booked calls (not just today's)
    const allEvents = deriveAppointmentEvents(calls);

    // Find next appointment (soonest parseable datetime, or latest booked if none parseable)
    const now = new Date();
    const futureEvents = allEvents
        .filter((e) => e.hasDateTime && e.start && e.start > now)
        .sort((a, b) => (a.start!.getTime() - b.start!.getTime()));

    let nextEvent: AppointmentEvent | null = futureEvents[0] || null;

    // If no parseable future appointments, show the most recently booked (by call time)
    if (!nextEvent && allEvents.length > 0) {
        const sorted = [...allEvents].sort(
            (a, b) => new Date(b.callStartedAt).getTime() - new Date(a.callStartedAt).getTime()
        );
        nextEvent = sorted[0];
    }

    return {
        bookedTodayCount,
        nextEvent,
    };
}

/**
 * Format a phone number for display.
 */
export function formatPhoneNumber(phone: string | null | undefined): string {
    if (!phone) return 'Unknown';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
        return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length === 11 && digits.startsWith('1')) {
        return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return phone;
}
