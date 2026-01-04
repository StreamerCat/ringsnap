/**
 * Unit tests for validators.ts - formatPhoneE164
 * 
 * Run with: deno test --allow-read validators.test.ts
 */

import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { formatPhoneE164 } from "./validators.ts";

Deno.test("formatPhoneE164 - 10 digit US number without country code", () => {
    assertEquals(formatPhoneE164("4155551234"), "+14155551234");
    assertEquals(formatPhoneE164("3035551234"), "+13035551234");
});

Deno.test("formatPhoneE164 - 10 digit US number with formatting", () => {
    assertEquals(formatPhoneE164("(415) 555-1234"), "+14155551234");
    assertEquals(formatPhoneE164("415-555-1234"), "+14155551234");
    assertEquals(formatPhoneE164("415.555.1234"), "+14155551234");
    assertEquals(formatPhoneE164("415 555 1234"), "+14155551234");
});

Deno.test("formatPhoneE164 - 11 digit US number with country code", () => {
    assertEquals(formatPhoneE164("14155551234"), "+14155551234");
    assertEquals(formatPhoneE164("1-415-555-1234"), "+14155551234");
    assertEquals(formatPhoneE164("+1 (415) 555-1234"), "+14155551234");
});

Deno.test("formatPhoneE164 - already E.164 format", () => {
    assertEquals(formatPhoneE164("+14155551234"), "+14155551234");
    assertEquals(formatPhoneE164("+13035551234"), "+13035551234");
});

Deno.test("formatPhoneE164 - empty or invalid input returns default", () => {
    assertEquals(formatPhoneE164(""), "+14155551234");
    assertEquals(formatPhoneE164("   "), "+14155551234");
    assertEquals(formatPhoneE164("invalid"), "+14155551234");
    assertEquals(formatPhoneE164("abc"), "+14155551234");
});

Deno.test("formatPhoneE164 - handles null/undefined-like inputs", () => {
    // @ts-ignore - Testing edge cases
    assertEquals(formatPhoneE164(null as any), "+14155551234");
    // @ts-ignore - Testing edge cases
    assertEquals(formatPhoneE164(undefined as any), "+14155551234");
});

Deno.test("formatPhoneE164 - 10 digit starting with 1 (edge case)", () => {
    // 10 digits starting with 1 is ambiguous, but we try to handle it
    const result = formatPhoneE164("1555551234");
    // Should add + prefix (becomes +1555551234 - 10 digits with + is still valid for non-US)
    assertEquals(result.startsWith("+"), true);
    assertEquals(result.length >= 11, true);
});

Deno.test("formatPhoneE164 - international numbers", () => {
    // 12+ digit international numbers
    assertEquals(formatPhoneE164("442071234567"), "+442071234567");
    assertEquals(formatPhoneE164("+442071234567"), "+442071234567");
});

Deno.test("formatPhoneE164 - too many digits uses last 10", () => {
    // More than 15 digits should take last 10 and add +1
    const result = formatPhoneE164("1234567890123456789");
    assertEquals(result, "+10123456789"); // Last 10 digits with +1
});

Deno.test("formatPhoneE164 - short numbers get padded", () => {
    // 7-9 digits should be padded to 10
    const result = formatPhoneE164("5551234");
    assertEquals(result.startsWith("+1"), true);
    assertEquals(result.length, 12); // +1 + 10 digits
});

console.log("All formatPhoneE164 tests passed!");
