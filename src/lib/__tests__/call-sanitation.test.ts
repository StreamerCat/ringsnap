import { describe, it, expect } from "vitest";
import { sanitizeCallReason, sanitizeCallSummary } from "../call-sanitation";

describe("call-sanitation", () => {
    describe("sanitizeCallReason", () => {
        it("strips 'the user called [Business] to' prefix", () => {
            const input = "The user called RingSnap support to schedule a plumbing repair.";
            expect(sanitizeCallReason(input)).toBe("Schedule a plumbing repair");
        });

        it("strips 'caller called to' prefix", () => {
            const input = "caller called to request pricing for a new roof.";
            expect(sanitizeCallReason(input)).toBe("Request pricing for a new roof");
        });

        it("replaces AI with RingSnap", () => {
            const input = "Talk to the AI about a leak.";
            expect(sanitizeCallReason(input)).toBe("Talk to the RingSnap about a leak");
        });

        it("truncates long reasons", () => {
            const input = "The user called to schedule a comprehensive maintenance check because they have been noticing some strange noises coming from their furnace lately and they wanted to make sure everything was safe.";
            const output = sanitizeCallReason(input);
            expect(output.split(" ").length).toBeLessThanOrEqual(13); // 12 words + "..."
            expect(output).toContain("...");
        });

        it("handles empty or null input", () => {
            expect(sanitizeCallReason(null)).toBe("");
            expect(sanitizeCallReason("")).toBe("");
        });

        it("is idempotent", () => {
            const input = "Schedule a repair";
            const first = sanitizeCallReason(input);
            const second = sanitizeCallReason(first);
            expect(first).toBe(second);
        });
    });

    describe("sanitizeCallSummary", () => {
        it("strips intro phrases but preserves meaningful content", () => {
            const input = "The user called to book a cleaning and the agent scheduled Tuesday.";
            expect(sanitizeCallSummary(input)).toBe("Book a cleaning and the agent scheduled Tuesday.");
        });

        it("removes standalone intro sentence and keeps the rest", () => {
            const input = "The user called RingSnap. They wanted to book a drain cleaning. The RingSnap agent helped them find a time.";
            expect(sanitizeCallSummary(input)).toBe("They wanted to book a drain cleaning. The RingSnap agent helped them find a time.");
        });

        it("replaces AI with RingSnap agent", () => {
            const input = "The AI answered and scheduled the appointment.";
            expect(sanitizeCallSummary(input)).toBe("The RingSnap agent answered and scheduled the appointment.");
        });

        it("limits to max 2 sentences", () => {
            const input = "First sentence. Second sentence. Third sentence. Fourth sentence.";
            const output = sanitizeCallSummary(input);
            // Count periods to verify sentence count
            const periodCount = (output.match(/\./g) || []).length;
            expect(periodCount).toBe(2);
        });

        it("handles empty or null input", () => {
            expect(sanitizeCallSummary(null)).toBe("");
            expect(sanitizeCallSummary("")).toBe("");
        });
    });
});
