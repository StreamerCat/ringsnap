/**
 * Appointment Detection, Display & Metrics
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
    customer_name?: string;
    lead_name?: string;
    reason?: string;
    summary?: string;
    appointment_start?: string | null;
    appointment_end?: string | null;
    appointment_window?: string | null;
    address?: string | null;
    customer_address?: string | null;
    service_address?: string | null;
}

export interface AppointmentEvent {
    id: string;
    sourceCallId: string;
    customerName: string;
    customerPhone: string;
    address: string;
    jobType: string;
    hasDateTime: boolean;
    inferred: boolean;
    start?: Date;
    displayWhen: string;
    displayDay?: string;
    callStartedAt: string;
}

export interface AppointmentMetrics {
    bookedTodayCount: number;
    nextEvent: AppointmentEvent | null;
}

// Sentinel values to treat as missing
const SENTINEL_VALUES = ['none', 'null', 'undefined', 'n/a', 'na', 'unknown', ''];

/**
 * Check if a value is a sentinel (should be treated as missing).
 */
export function isSentinelValue(value: string | null | undefined): boolean {
    if (!value) return true;
    const normalized = value.trim().toLowerCase();
    return SENTINEL_VALUES.includes(normalized) || normalized.length === 0;
}

/**
 * Get a clean string value, returning null if it's a sentinel.
 */
function cleanValue(value: string | null | undefined): string | null {
    if (isSentinelValue(value)) return null;
    return value!.trim();
}

/**
 * Extract caller name from summary text using common Vapi patterns.
 * Returns null if no high-confidence name is found.
 */
function extractNameFromSummary(summary: string | null | undefined): string | null {
    if (!summary || isSentinelValue(summary)) return null;

    // clean multiline
    const s = summary.replace(/\r?\n/g, ' ').trim();

    // Pattern 1: "Incoming call from [Name]" or "Call from [Name]"
    const fromMatch = s.match(/(?:incoming call |call |received |call received )?from ([A-Z][a-z]+(?: [A-Z][a-z]+)+)/i);
    if (fromMatch && fromMatch[1]) return fromMatch[1].trim();

    // Pattern 2: "The caller, [Name], ..."
    const callerComma = s.match(/caller, ([A-Z][a-z]+(?: [A-Z][a-z]+)+),/i);
    if (callerComma && callerComma[1]) return callerComma[1].trim();

    // Pattern 3: "Caller is [Name]"
    const callerIs = s.match(/caller (?:is|is named) ([A-Z][a-z]+(?: [A-Z][a-z]+)+)/i);
    if (callerIs && callerIs[1]) return callerIs[1].trim();

    // Pattern 4: "Name: [Name]" (Explicit label)
    const nameLabel = s.match(/(?:name|caller): ([A-Z][a-z]+(?: [A-Z][a-z]+)+)/i);
    if (nameLabel && nameLabel[1]) return nameLabel[1].trim();

    return null;
}

/**
 * Get display name from a call with priority order and sentinel handling.
 * Priority: caller_name → customer_name → lead_name → from_number → "Unknown caller"
 */
export function getDisplayName(call: CallLogWithAppointment | null | undefined): string {
    if (!call) return 'Unknown caller';

    const name = cleanValue(call.caller_name)
        || cleanValue(call.customer_name)
        || cleanValue(call.lead_name);

    if (name) return name;

    // Fallback: Try to extract from summary
    // (This handles cases where RPC doesn't return caller_name but summary has it)
    const extracted = extractNameFromSummary(call.summary);
    if (extracted) return extracted;

    // Fall back to formatted phone number
    if (call.from_number && !isSentinelValue(call.from_number)) {
        return formatPhoneNumber(call.from_number);
    }
    if (call.caller_phone && !isSentinelValue(call.caller_phone)) {
        return formatPhoneNumber(call.caller_phone);
    }

    return 'Unknown caller';
}

/**
 * Get display address from a call with priority order and sentinel handling.
 * Priority: address → customer_address → service_address → "Address not provided"
 */
export function getDisplayAddress(call: CallLogWithAppointment | null | undefined): string {
    if (!call) return 'Address not provided';

    const address = cleanValue(call.address)
        || cleanValue(call.customer_address)
        || cleanValue(call.service_address);

    return address || 'Address not provided';
}

/**
 * Get job type / reason with fallback.
 */
export function getJobType(call: CallLogWithAppointment | null | undefined): string {
    if (!call) return 'General inquiry';
    return cleanValue(call.reason) || cleanValue(call.summary?.split('.')[0]) || 'General inquiry';
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

// Weekday names for parsing
const WEEKDAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WEEKDAY_ABBREV = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// Time period mappings
const TIME_PERIODS: Record<string, number> = {
    'morning': 9,
    'afternoon': 13,
    'evening': 17,
    'night': 19,
};

/**
 * Parse weekday and optional time from appointment text.
 * Returns inferred date if a weekday is found, null otherwise.
 */
function inferWeekdayAppointment(text: string, referenceDate: Date): {
    date: Date;
    timeText: string;
} | null {
    if (!text) return null;

    const lowerText = text.toLowerCase();

    // Find weekday
    let targetDayOfWeek = -1;
    for (let i = 0; i < WEEKDAY_NAMES.length; i++) {
        if (lowerText.includes(WEEKDAY_NAMES[i]) || lowerText.includes(WEEKDAY_ABBREV[i])) {
            targetDayOfWeek = i;
            break;
        }
    }

    if (targetDayOfWeek === -1) return null;

    // Calculate next occurrence of this weekday
    const currentDayOfWeek = referenceDate.getDay();
    let daysUntil = targetDayOfWeek - currentDayOfWeek;
    if (daysUntil <= 0) {
        daysUntil += 7; // Next week
    }

    const inferredDate = new Date(referenceDate);
    inferredDate.setDate(inferredDate.getDate() + daysUntil);
    inferredDate.setHours(12, 0, 0, 0); // Default to noon

    // Try to parse specific time
    // Match patterns: "1pm", "2:30pm", "10 am", "10:00 AM"
    const timeMatch = lowerText.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)/i);
    if (timeMatch) {
        let hours = parseInt(timeMatch[1], 10);
        const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
        const isPM = timeMatch[3].toLowerCase() === 'pm';

        if (isPM && hours < 12) hours += 12;
        if (!isPM && hours === 12) hours = 0;

        inferredDate.setHours(hours, minutes, 0, 0);
    } else {
        // Check for time periods
        for (const [period, hour] of Object.entries(TIME_PERIODS)) {
            if (lowerText.includes(period)) {
                inferredDate.setHours(hour, 0, 0, 0);
                break;
            }
        }
    }

    return {
        date: inferredDate,
        timeText: text,
    };
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

export interface AppointmentDisplayResult {
    hasDateTime: boolean;
    inferred: boolean;
    start?: Date;
    displayWhen: string;
    displayDay?: string;
}

/**
 * Extract appointment display information from a call.
 * Handles explicit datetimes, weekday inference, and free-text windows.
 */
export function getAppointmentDisplay(call: CallLogWithAppointment): AppointmentDisplayResult {
    // Try to parse explicit appointment_start first
    const parsedStart = tryParseDateTime(call.appointment_start);

    if (parsedStart) {
        return {
            hasDateTime: true,
            inferred: false,
            start: parsedStart,
            displayWhen: parsedStart.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
            displayDay: parsedStart.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }),
        };
    }

    // Try to infer from appointment_window (e.g., "thursday at 1pm")
    if (call.appointment_window) {
        const referenceDate = call.started_at ? new Date(call.started_at) : new Date();
        const inferred = inferWeekdayAppointment(call.appointment_window, referenceDate);

        if (inferred) {
            return {
                hasDateTime: true,
                inferred: true,
                start: inferred.date,
                displayWhen: inferred.date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
                displayDay: inferred.date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }),
            };
        }

        // Not parseable, show as-is
        return {
            hasDateTime: false,
            inferred: false,
            displayWhen: call.appointment_window,
        };
    }

    // No appointment time info available
    return {
        hasDateTime: false,
        inferred: false,
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
                sourceCallId: call.id || '',
                customerName: getDisplayName(call),
                customerPhone: call.from_number || call.caller_phone || '',
                address: getDisplayAddress(call),
                jobType: getJobType(call),
                hasDateTime: display.hasDateTime,
                inferred: display.inferred,
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
    if (!phone || isSentinelValue(phone)) return 'Unknown';
    const digits = phone.replace(/\D/g, '');
    let coreDigits = digits;
    if (digits.length === 11 && digits.startsWith('1')) {
        coreDigits = digits.slice(1);
    }

    if (coreDigits.length === 10) {
        return `${coreDigits.slice(0, 3)}-${coreDigits.slice(3, 6)}-${coreDigits.slice(6)}`;
    }
    return phone;
}
