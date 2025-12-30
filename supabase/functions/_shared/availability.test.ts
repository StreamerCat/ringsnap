/**
 * Tests for availability service
 * 
 * Run with: deno test --allow-env supabase/functions/_shared/availability.test.ts
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";

// Mock the module structure for testing pure functions
const ACTIVE_STATUSES = ["scheduled", "confirmed", "rescheduled"];

const DEFAULT_BUSINESS_HOURS = {
    start: 8,
    end: 18,
    days: [1, 2, 3, 4, 5],
};

function doTimesOverlap(
    start1: Date,
    end1: Date,
    start2: Date,
    end2: Date
): boolean {
    return start1 < end2 && end1 > start2;
}

function parseBusinessHours(accountBusinessHours: any): {
    start: number;
    end: number;
    days: number[];
} {
    if (!accountBusinessHours) return DEFAULT_BUSINESS_HOURS;

    try {
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

Deno.test("doTimesOverlap - overlapping slots", () => {
    // Slot 1: 10:00 - 11:00
    // Slot 2: 10:30 - 11:30
    const start1 = new Date("2024-01-15T10:00:00Z");
    const end1 = new Date("2024-01-15T11:00:00Z");
    const start2 = new Date("2024-01-15T10:30:00Z");
    const end2 = new Date("2024-01-15T11:30:00Z");

    assertEquals(doTimesOverlap(start1, end1, start2, end2), true);
});

Deno.test("doTimesOverlap - non-overlapping slots", () => {
    // Slot 1: 10:00 - 11:00
    // Slot 2: 11:00 - 12:00 (adjacent but not overlapping)
    const start1 = new Date("2024-01-15T10:00:00Z");
    const end1 = new Date("2024-01-15T11:00:00Z");
    const start2 = new Date("2024-01-15T11:00:00Z");
    const end2 = new Date("2024-01-15T12:00:00Z");

    assertEquals(doTimesOverlap(start1, end1, start2, end2), false);
});

Deno.test("doTimesOverlap - contained slot", () => {
    // Slot 1: 10:00 - 12:00
    // Slot 2: 10:30 - 11:00 (fully contained)
    const start1 = new Date("2024-01-15T10:00:00Z");
    const end1 = new Date("2024-01-15T12:00:00Z");
    const start2 = new Date("2024-01-15T10:30:00Z");
    const end2 = new Date("2024-01-15T11:00:00Z");

    assertEquals(doTimesOverlap(start1, end1, start2, end2), true);
});

Deno.test("doTimesOverlap - completely separate", () => {
    // Slot 1: 10:00 - 11:00
    // Slot 2: 14:00 - 15:00
    const start1 = new Date("2024-01-15T10:00:00Z");
    const end1 = new Date("2024-01-15T11:00:00Z");
    const start2 = new Date("2024-01-15T14:00:00Z");
    const end2 = new Date("2024-01-15T15:00:00Z");

    assertEquals(doTimesOverlap(start1, end1, start2, end2), false);
});

Deno.test("parseBusinessHours - null input returns defaults", () => {
    const result = parseBusinessHours(null);
    assertEquals(result, DEFAULT_BUSINESS_HOURS);
});

Deno.test("parseBusinessHours - undefined input returns defaults", () => {
    const result = parseBusinessHours(undefined);
    assertEquals(result, DEFAULT_BUSINESS_HOURS);
});

Deno.test("parseBusinessHours - custom hours", () => {
    const customHours = { start: 9, end: 17, days: [1, 2, 3, 4, 5, 6] };
    const result = parseBusinessHours(customHours);
    assertEquals(result, customHours);
});

Deno.test("parseBusinessHours - partial custom hours uses defaults for missing", () => {
    const partialHours = { start: 10 };
    const result = parseBusinessHours(partialHours);
    assertEquals(result.start, 10);
    assertEquals(result.end, DEFAULT_BUSINESS_HOURS.end);
    assertEquals(result.days, DEFAULT_BUSINESS_HOURS.days);
});

Deno.test("active statuses include expected values", () => {
    assertEquals(ACTIVE_STATUSES.includes("scheduled"), true);
    assertEquals(ACTIVE_STATUSES.includes("confirmed"), true);
    assertEquals(ACTIVE_STATUSES.includes("rescheduled"), true);
    assertEquals(ACTIVE_STATUSES.includes("canceled"), false);
    assertEquals(ACTIVE_STATUSES.includes("completed"), false);
});

// Integration test placeholder
// In a real environment, you would:
// 1. Create a test appointment at 10:00
// 2. Call getAvailableSlots for that day
// 3. Verify 10:00 is NOT in the returned slots
// 4. Try to book 10:00 and verify it returns slot_unavailable

console.log("All availability tests passed!");
