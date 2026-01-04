/**
 * Unit tests for validators.ts - formatPhoneE164
 * 
 * Run with: deno test --allow-read validators.test.ts
 */

import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { formatPhoneE164, tryFormatPhoneE164 } from "./validators.ts";

// ============================================================================
// formatPhoneE164 - Valid US Numbers
// ============================================================================

Deno.test("formatPhoneE164 - 10 digit US number without country code", () => {
    assertEquals(formatPhoneE164("4155551234"), "+14155551234");
    assertEquals(formatPhoneE164("3035551234"), "+13035551234");
    assertEquals(formatPhoneE164("2125551234"), "+12125551234");
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
    assertEquals(formatPhoneE164("+14155551234"), "+14155551234");
});

// ============================================================================
// formatPhoneE164 - Invalid Inputs Return null
// ============================================================================

Deno.test("formatPhoneE164 - empty or whitespace returns null", () => {
    assertEquals(formatPhoneE164(""), null);
    assertEquals(formatPhoneE164("   "), null);
    assertEquals(formatPhoneE164(null), null);
    assertEquals(formatPhoneE164(undefined), null);
});

Deno.test("formatPhoneE164 - non-digits returns null", () => {
    assertEquals(formatPhoneE164("invalid"), null);
    assertEquals(formatPhoneE164("abc"), null);
    assertEquals(formatPhoneE164("hello world"), null);
});

Deno.test("formatPhoneE164 - 10 digit starting with 0 or 1 returns null (invalid US area code)", () => {
    // US area codes cannot start with 0 or 1
    assertEquals(formatPhoneE164("0555551234"), null);
    assertEquals(formatPhoneE164("1555551234"), null);
});

Deno.test("formatPhoneE164 - 11 digit with invalid area code returns null", () => {
    // 11 digits starting with 1, but area code (2nd digit) is 0 or 1
    assertEquals(formatPhoneE164("10555551234"), null);
    assertEquals(formatPhoneE164("11555551234"), null);
});

Deno.test("formatPhoneE164 - too few digits returns null", () => {
    assertEquals(formatPhoneE164("555"), null);
    assertEquals(formatPhoneE164("5551234"), null); // 7 digits
    assertEquals(formatPhoneE164("55512345"), null); // 8 digits
    assertEquals(formatPhoneE164("555123456"), null); // 9 digits
});

Deno.test("formatPhoneE164 - too many digits returns null", () => {
    assertEquals(formatPhoneE164("12345678901234567"), null); // 17 digits
    assertEquals(formatPhoneE164("1234567890123456"), null); // 16 digits
});

// ============================================================================
// formatPhoneE164 - International Numbers
// ============================================================================

Deno.test("formatPhoneE164 - international numbers (12-15 digits)", () => {
    assertEquals(formatPhoneE164("442071234567"), "+442071234567"); // UK
    assertEquals(formatPhoneE164("33142685300"), null); // France 11 digits but not starting with 1, returns null
    assertEquals(formatPhoneE164("4915123456789"), "+4915123456789"); // Germany 13 digits
});

// ============================================================================
// tryFormatPhoneE164 - Logging Wrapper
// ============================================================================

Deno.test("tryFormatPhoneE164 - returns same as formatPhoneE164 for valid input", () => {
    assertEquals(tryFormatPhoneE164("4155551234"), "+14155551234");
    assertEquals(tryFormatPhoneE164("+14155551234"), "+14155551234");
});

Deno.test("tryFormatPhoneE164 - returns null for invalid input (with logging)", () => {
    assertEquals(tryFormatPhoneE164("invalid"), null);
    assertEquals(tryFormatPhoneE164(""), null);
    assertEquals(tryFormatPhoneE164(null), null);
});

Deno.test("tryFormatPhoneE164 - accepts context for logging", () => {
    // Just verify it doesn't throw with context
    const result = tryFormatPhoneE164("invalid", { accountId: "test-123", jobId: "job-456" });
    assertEquals(result, null);
});

console.log("All formatPhoneE164 tests passed!");
