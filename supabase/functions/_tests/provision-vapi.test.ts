
import { assertEquals, assertExists, assertRejects } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { provisionPhoneNumber, ProviderConfig } from "../_shared/telephony.ts";

// Mock Deno.env
const originalEnv = Deno.env.toObject();
const mockEnv = {
    ...originalEnv,
    VAPI_DEFAULT_PROVIDER: "twilio",
    TWILIO_ACCOUNT_SID: "AC_TEST",
    TWILIO_API_KEY: "SK_TEST",
    TWILIO_API_SECRET: "SECRET_TEST",
    VAPI_API_KEY: "VAPI_TEST"
};

// Mock Deno.env.get
Deno.env.get = (key: string) => mockEnv[key];

// Mock Fetch
const originalFetch = globalThis.fetch;

function mockFetch(handlers: (url: string, opts: any) => Response | null) {
    globalThis.fetch = async (input: string | Request | URL, init?: RequestInit) => {
        const url = input.toString();
        const handlerResponse = handlers(url, init);
        if (handlerResponse) return handlerResponse;
        return new Response("Not Found", { status: 404 });
    };
}

function restore() {
    globalThis.fetch = originalFetch;
    // Restore Env (approximate)
}

// ----------------------------------------------------------------------------
// Test: Twilio Provisioning Flow (Unit/Integration Lite)
// ----------------------------------------------------------------------------
// Note: True integration test requires running the edge function via `supabase functions serve`.
// This test validates the core logic flow if imported or run in isolation.

Deno.test("Telephony: Full Twilio Provisioning Flow (API Key)", async () => {

    // Mock Responses
    mockFetch((url, opts) => {
        // 1. Twilio Search
        if (url.includes("AvailablePhoneNumbers")) {
            return new Response(JSON.stringify({
                available_phone_numbers: [{ phone_number: "+14155550100" }]
            }), { status: 200 });
        }
        // 2. Twilio Buy
        if (url.includes("IncomingPhoneNumbers")) {
            return new Response(JSON.stringify({
                sid: "PN_TEST",
                phone_number: "+14155550100",
                friendly_name: "Test Number",
                capabilities: { voice: true }
            }), { status: 201 });
        }
        return null;
    });

    try {
        const config: ProviderConfig = {
            type: "twilio",
            accountSid: mockEnv.TWILIO_ACCOUNT_SID,
            apiKey: mockEnv.TWILIO_API_KEY,
            apiSecret: mockEnv.TWILIO_API_SECRET,
        };

        const result = await provisionPhoneNumber(config, { countryCode: "US", areaCode: "415" });

        assertEquals(result.phoneNumber, "+14155550100");
        assertEquals(result.provider, "twilio");
        assertEquals(result.providerId, "PN_TEST");

    } finally {
        restore();
    }
});
