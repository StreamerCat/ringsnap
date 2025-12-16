/**
 * parser_test.ts
 * 
 * Unit tests for call_parser.ts
 * Run with: deno test
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { extractCallDetails, VapiCall, VapiMessage } from "./call_parser.ts";

Deno.test("Scenario 1: Frank Ocean Booking (Transcript + SuccessEval)", () => {
    const call: VapiCall = {
        transcript: "Hi, this is ring snap plumbing. My name is Frank Ocean. I need a toilet replacement. okay great. You're all set for Wednesday afternoon.",
        analysis: {
            successEvaluation: "true",
            summary: "The customer Frank called to schedule a toilet replacement. The agent successfully booked the appointment for Wednesday afternoon.",
            structuredData: {} // Empty to test fallback
        }
    };

    const message: VapiMessage = {
        type: "end-of-call-report",
        call: call
    };

    const result = extractCallDetails(call, message);

    assertEquals(result.callerName, "Frank Ocean");
    assertEquals(result.booked, true);
    assertEquals(result.outcome, "booked");
    assertEquals(result.appointmentWindow, "Wednesday afternoon");
    // Reason might come from summary heuristic or be null if logic is strict.
    // Our logic uses summary first sentence if short.
    // "The customer Frank called to schedule a toilet replacement" is usually detected.
});

Deno.test("Scenario 2: Lead Capture (Name + Phone, No Booking)", () => {
    const call: VapiCall = {
        transcript: "Hi, my name is John Smith. I just have a question about pricing.",
        analysis: {
            successEvaluation: false,
            summary: "He wanted to check verify pricing.",
            structuredData: {}
        },
        customer: {
            number: "+15551234567"
        }
    };

    const message: VapiMessage = {
        type: "end-of-call-report",
        call: call
    };

    const result = extractCallDetails(call, message);

    assertEquals(result.callerName, "John Smith");
    assertEquals(result.booked, false);
    assertEquals(result.outcome, "lead"); // Name found -> Lead
});

Deno.test("Scenario 3: Structured Data Priority", () => {
    const call: VapiCall = {
        transcript: "My name is Fake Name.",
        analysis: {
            structuredData: {
                callerName: "Real Name",
                booked: true,
                appointmentStart: "2025-10-10T10:00:00Z"
            }
        }
    };
    const message: VapiMessage = { type: "end-of-call-report", call };

    const result = extractCallDetails(call, message);
    assertEquals(result.callerName, "Real Name");
    assertEquals(result.booked, true);
    assertEquals(result.appointmentStart, "2025-10-10T10:00:00Z");
});
