/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SHARED: Availability Service (Phase 1 - DB Only)
 *
 * PURPOSE: Provide DB-backed availability checking to prevent double booking.
 * 
 * FEATURES:
 * - Generate candidate slots based on business hours
 * - Exclude slots that overlap existing appointments
 * - Multi-tenant safe (scoped by account_id)
 * - Timezone-aware (converts to UTC for DB queries)
 *
 * PHASE 2: Will add Google Calendar integration (union of DB + calendar busy)
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { logInfo, logWarn, logError } from "./logging.ts";

const FUNCTION_NAME = "availability-service";

// Active appointment statuses (these block slots)
const ACTIVE_STATUSES = ["scheduled", "confirmed", "rescheduled"];

// Default business hours (can be overridden per account)
const DEFAULT_BUSINESS_HOURS = {
    start: 8, // 8 AM
    end: 18,  // 6 PM (18:00)
    days: [1, 2, 3, 4, 5], // Monday-Friday (0=Sunday)
};

// Slot generation settings
const DEFAULT_SLOT_DURATION_MINUTES = 60;
const MAX_SLOTS_PER_REQUEST = 8;
const MIN_SLOTS_PER_REQUEST = 3;

export interface TimeSlot {
    start: string; // ISO 8601
    end: string;   // ISO 8601
}

export interface AvailabilityRequest {
    accountId: string;
    date: string; // YYYY-MM-DD format (in account timezone)
    timezone?: string; // IANA timezone (defaults to account timezone or America/Denver)
    durationMinutes?: number;
    serviceType?: string; // Future: for service-specific availability
}

export interface AvailabilityResult {
    success: boolean;
    slots: TimeSlot[];
    date: string;
    timezone: string;
    error?: string;
    meta?: {
        totalCandidates: number;
        existingAppointments: number;
        availableSlots: number;
    };
}

export interface ConflictCheckResult {
    hasConflict: boolean;
    conflictingAppointment?: {
        id: string;
        scheduled_start_at: string;
        scheduled_end_at: string | null;
    };
    alternativeSlots?: TimeSlot[];
}

/**
 * Check if two time ranges overlap
 * Overlap if: start1 < end2 AND end1 > start2
 */
function doTimesOverlap(
    start1: Date,
    end1: Date,
    start2: Date,
    end2: Date
): boolean {
    return start1 < end2 && end1 > start2;
}

/**
 * Parse business hours from account settings or use defaults
 */
function parseBusinessHours(accountBusinessHours: any): {
    start: number;
    end: number;
    days: number[];
} {
    if (!accountBusinessHours) return DEFAULT_BUSINESS_HOURS;

    try {
        // Handle JSON format: { "start": 8, "end": 18, "days": [1,2,3,4,5] }
        if (typeof accountBusinessHours === "object") {
            return {
                start: accountBusinessHours.start ?? DEFAULT_BUSINESS_HOURS.start,
                end: accountBusinessHours.end ?? DEFAULT_BUSINESS_HOURS.end,
                days: accountBusinessHours.days ?? DEFAULT_BUSINESS_HOURS.days,
            };
        }
    } catch {
        // Fall back to defaults
    }

    return DEFAULT_BUSINESS_HOURS;
}

/**
 * Generate candidate time slots for a given date
 */
function generateCandidateSlots(
    dateStr: string,
    timezone: string,
    businessHours: { start: number; end: number; days: number[] },
    durationMinutes: number
): TimeSlot[] {
    const slots: TimeSlot[] = [];

    // Create date in the target timezone
    const targetDate = new Date(`${dateStr}T00:00:00`);

    // Check if day of week is in business days
    const dayOfWeek = targetDate.getDay();
    if (!businessHours.days.includes(dayOfWeek)) {
        return slots; // No slots on non-business days
    }

    // Generate slots from business start to business end
    for (let hour = businessHours.start; hour < businessHours.end; hour++) {
        // Create slot start time in the target timezone
        const slotStart = new Date(`${dateStr}T${hour.toString().padStart(2, "0")}:00:00`);
        const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60 * 1000);

        // Only include if slot ends before business hours end
        const endHour = slotEnd.getHours() + slotEnd.getMinutes() / 60;
        if (endHour <= businessHours.end) {
            slots.push({
                start: slotStart.toISOString(),
                end: slotEnd.toISOString(),
            });
        }
    }

    return slots;
}

/**
 * Get available time slots, excluding existing appointments
 */
export async function getAvailableSlots(
    supabase: SupabaseClient,
    request: AvailabilityRequest,
    correlationId?: string
): Promise<AvailabilityResult> {
    const baseLogOptions = {
        functionName: FUNCTION_NAME,
        correlationId: correlationId || "n/a",
        accountId: request.accountId,
    };

    try {
        // 1. Fetch account settings for timezone and business hours
        const { data: account, error: accountError } = await supabase
            .from("accounts")
            .select("timezone, business_hours")
            .eq("id", request.accountId)
            .single();

        if (accountError || !account) {
            logError("Failed to fetch account for availability", {
                ...baseLogOptions,
                error: accountError,
            });
            return {
                success: false,
                slots: [],
                date: request.date,
                timezone: request.timezone || "America/Denver",
                error: "Account not found",
            };
        }

        const timezone = request.timezone || account.timezone || "America/Denver";
        const businessHours = parseBusinessHours(account.business_hours);
        const durationMinutes = request.durationMinutes || DEFAULT_SLOT_DURATION_MINUTES;

        // 2. Generate candidate slots
        const candidates = generateCandidateSlots(
            request.date,
            timezone,
            businessHours,
            durationMinutes
        );

        if (candidates.length === 0) {
            logInfo("No candidate slots for date (non-business day)", {
                ...baseLogOptions,
                context: { date: request.date, dayOfWeek: new Date(request.date).getDay() },
            });
            return {
                success: true,
                slots: [],
                date: request.date,
                timezone,
                meta: {
                    totalCandidates: 0,
                    existingAppointments: 0,
                    availableSlots: 0,
                },
            };
        }

        // 3. Query existing appointments that overlap with the date range
        // We query from day start to day end in UTC to catch all possible overlaps
        const dayStart = candidates[0].start;
        const dayEnd = candidates[candidates.length - 1].end;

        const { data: existingAppointments, error: appointmentsError } = await supabase
            .from("appointments")
            .select("id, scheduled_start_at, scheduled_end_at, status")
            .eq("account_id", request.accountId)
            .in("status", ACTIVE_STATUSES)
            .gte("scheduled_start_at", dayStart)
            .lt("scheduled_start_at", dayEnd);

        if (appointmentsError) {
            logError("Failed to query existing appointments", {
                ...baseLogOptions,
                error: appointmentsError,
            });
            return {
                success: false,
                slots: [],
                date: request.date,
                timezone,
                error: "Failed to check existing appointments",
            };
        }

        const appointments = existingAppointments || [];

        logInfo("Checking availability", {
            ...baseLogOptions,
            context: {
                date: request.date,
                totalCandidates: candidates.length,
                existingAppointments: appointments.length,
            },
        });

        // 4. Filter out slots that overlap with existing appointments
        const availableSlots = candidates.filter((slot) => {
            const slotStart = new Date(slot.start);
            const slotEnd = new Date(slot.end);

            // Check if any appointment overlaps with this slot
            for (const appt of appointments) {
                const apptStart = new Date(appt.scheduled_start_at);
                // If no end time, assume it lasts for default duration
                const apptEnd = appt.scheduled_end_at
                    ? new Date(appt.scheduled_end_at)
                    : new Date(apptStart.getTime() + DEFAULT_SLOT_DURATION_MINUTES * 60 * 1000);

                if (doTimesOverlap(slotStart, slotEnd, apptStart, apptEnd)) {
                    return false; // Slot is blocked
                }
            }

            return true; // Slot is available
        });

        // 5. Limit to MAX_SLOTS_PER_REQUEST
        const limitedSlots = availableSlots.slice(0, MAX_SLOTS_PER_REQUEST);

        logInfo("Availability calculated", {
            ...baseLogOptions,
            context: {
                date: request.date,
                availableSlots: limitedSlots.length,
                totalCandidates: candidates.length,
                filtered: candidates.length - availableSlots.length,
            },
        });

        return {
            success: true,
            slots: limitedSlots,
            date: request.date,
            timezone,
            meta: {
                totalCandidates: candidates.length,
                existingAppointments: appointments.length,
                availableSlots: availableSlots.length,
            },
        };

    } catch (error: any) {
        logError("Unexpected error in getAvailableSlots", {
            ...baseLogOptions,
            error,
        });
        return {
            success: false,
            slots: [],
            date: request.date,
            timezone: request.timezone || "America/Denver",
            error: error.message || "Internal error",
        };
    }
}

/**
 * Check if a specific time slot has a conflict with existing appointments
 * Returns conflict info and alternative slots if there's a conflict
 */
export async function checkSlotConflict(
    supabase: SupabaseClient,
    accountId: string,
    startDateTime: string,
    endDateTime: string | null,
    durationMinutes: number = DEFAULT_SLOT_DURATION_MINUTES,
    correlationId?: string
): Promise<ConflictCheckResult> {
    const baseLogOptions = {
        functionName: FUNCTION_NAME,
        correlationId: correlationId || "n/a",
        accountId,
    };

    try {
        const slotStart = new Date(startDateTime);
        const slotEnd = endDateTime
            ? new Date(endDateTime)
            : new Date(slotStart.getTime() + durationMinutes * 60 * 1000);

        // Query for overlapping appointments
        // We need to find appointments where:
        // apptStart < slotEnd AND apptEnd > slotStart
        // Since we don't have apptEnd always, we conservatively check window
        const windowStart = new Date(slotStart.getTime() - durationMinutes * 60 * 1000);
        const windowEnd = slotEnd;

        const { data: overlapping, error } = await supabase
            .from("appointments")
            .select("id, scheduled_start_at, scheduled_end_at, status")
            .eq("account_id", accountId)
            .in("status", ACTIVE_STATUSES)
            .gte("scheduled_start_at", windowStart.toISOString())
            .lt("scheduled_start_at", windowEnd.toISOString());

        if (error) {
            logError("Failed to check slot conflict", {
                ...baseLogOptions,
                error,
            });
            // Fail-safe: don't allow booking if we can't verify
            return { hasConflict: true };
        }

        // Check each overlapping appointment for true conflict
        for (const appt of overlapping || []) {
            const apptStart = new Date(appt.scheduled_start_at);
            const apptEnd = appt.scheduled_end_at
                ? new Date(appt.scheduled_end_at)
                : new Date(apptStart.getTime() + durationMinutes * 60 * 1000);

            if (doTimesOverlap(slotStart, slotEnd, apptStart, apptEnd)) {
                logWarn("Slot conflict detected", {
                    ...baseLogOptions,
                    context: {
                        requestedStart: startDateTime,
                        requestedEnd: slotEnd.toISOString(),
                        conflictId: appt.id,
                        conflictStart: appt.scheduled_start_at,
                    },
                });

                // Get alternative slots for the same day
                const dateStr = startDateTime.split("T")[0];
                const alternatives = await getAvailableSlots(supabase, {
                    accountId,
                    date: dateStr,
                    durationMinutes,
                }, correlationId);

                return {
                    hasConflict: true,
                    conflictingAppointment: {
                        id: appt.id,
                        scheduled_start_at: appt.scheduled_start_at,
                        scheduled_end_at: appt.scheduled_end_at,
                    },
                    alternativeSlots: alternatives.slots.slice(0, 5),
                };
            }
        }

        logInfo("No slot conflict", {
            ...baseLogOptions,
            context: {
                requestedStart: startDateTime,
                requestedEnd: slotEnd.toISOString(),
            },
        });

        return { hasConflict: false };

    } catch (error: any) {
        logError("Unexpected error in checkSlotConflict", {
            ...baseLogOptions,
            error,
        });
        // Fail-safe: don't allow booking if we can't verify
        return { hasConflict: true };
    }
}
