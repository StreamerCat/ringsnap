
import { assertEquals, assertRejects } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { provisionPhoneNumber, ProviderConfig } from "../_shared/telephony.ts";

/**
 * Mock global fetch
 */
const originalFetch = globalThis.fetch;

function mockFetch(handlers: Record<string, Response>) {
    globalThis.fetch = async (input: string | Request | URL, init?: RequestInit) => {
        const url = input.toString();

        // Find matching handler
        for (const [key, response] of Object.entries(handlers)) {
            if (url.includes(key)) {
                return response.clone();
            }
        }

        return new Response("Not Found", { status: 404 });
    };
}

function restoreFetch() {
    globalThis.fetch = originalFetch;
}

Deno.test("provisionPhoneNumber - Twilio Success", async () => {
    const config: ProviderConfig = {
        type: "twilio",
        accountSid: "AC_TEST",
        authToken: "AUTH_TEST",
    };

    const mockSearchResponse = {
        available_phone_numbers: [
            { phone_number: "+14155550100", friendly_name: "(415) 555-0100" }
        ]
    };

    const mockBuyResponse = {
        sid: "PN_TEST",
        phone_number: "+14155550100",
        friendly_name: "(415) 555-0100",
        capabilities: { voice: true, sms: true }
    };

    mockFetch({
        "AvailablePhoneNumbers": new Response(JSON.stringify(mockSearchResponse), { status: 200 }),
        "IncomingPhoneNumbers": new Response(JSON.stringify(mockBuyResponse), { status: 201 })
    });

    try {
        const result = await provisionPhoneNumber(config, { countryCode: "US", areaCode: "415" });
        assertEquals(result.phoneNumber, "+14155550100");
        assertEquals(result.provider, "twilio");
        assertEquals(result.providerId, "PN_TEST");
    } finally {
        restoreFetch();
    }
});

Deno.test("provisionPhoneNumber - Twilio Search Fail (No Numbers)", async () => {
    const config: ProviderConfig = {
        type: "twilio",
        accountSid: "AC_TEST",
        authToken: "AUTH_TEST",
    };

    const mockSearchResponse = {
        available_phone_numbers: []
    };

    mockFetch({
        "AvailablePhoneNumbers": new Response(JSON.stringify(mockSearchResponse), { status: 200 })
    });

    try {
        await assertRejects(
            async () => await provisionPhoneNumber(config, { countryCode: "US", areaCode: "415" }),
            Error,
            "No available Twilio numbers found"
        );
    } finally {
        restoreFetch();
    }
});

Deno.test("provisionPhoneNumber - Twilio Search Backup Strategy", async () => {
    const config: ProviderConfig = {
        type: "twilio",
        accountSid: "AC_TEST",
        authToken: "AUTH_TEST",
    };

    // First call fails (no numbers in area code)
    // Second call succeeds (generic search)
    let callCount = 0;
    globalThis.fetch = async (input: string | Request | URL) => {
        const url = input.toString();

        if (url.includes("AvailablePhoneNumbers")) {
            callCount++;
            if (url.includes("AreaCode=999")) {
                return new Response(JSON.stringify({ available_phone_numbers: [] }), { status: 200 }); // Or 404/Empty
            }
            // Fallback (no AreaCode param)
            return new Response(JSON.stringify({
                available_phone_numbers: [{ phone_number: "+18005550199" }]
            }), { status: 200 });
        }

        if (url.includes("IncomingPhoneNumbers")) {
            return new Response(JSON.stringify({
                sid: "PN_FALLBACK",
                phone_number: "+18005550199"
            }), { status: 201 });
        }

        return new Response("Not Found", { status: 404 });
    };

    try {
        // Test logic missing
    } finally {
        restoreFetch();
    }
});

Deno.test("provisionPhoneNumber - Twilio Success (API Key)", async () => {
    const config: ProviderConfig = {
        type: "twilio",
        accountSid: "AC_TEST",
        apiKey: "SK_TEST",
        apiSecret: "SECRET_TEST"
    };

    const mockSearchResponse = {
        available_phone_numbers: [
            { phone_number: "+14155550100", friendly_name: "(415) 555-0100" }
        ]
    };

    const mockBuyResponse = {
        sid: "PN_TEST",
        phone_number: "+14155550100",
        friendly_name: "(415) 555-0100",
        capabilities: { voice: true, sms: true }
    };

    mockFetch({
        "AvailablePhoneNumbers": new Response(JSON.stringify(mockSearchResponse), { status: 200 }),
        "IncomingPhoneNumbers": new Response(JSON.stringify(mockBuyResponse), { status: 201 })
    });

    try {
        const result = await provisionPhoneNumber(config, { countryCode: "US", areaCode: "415" });
        assertEquals(result.phoneNumber, "+14155550100");
        assertEquals(result.provider, "twilio");
        assertEquals(result.providerId, "PN_TEST");
    } finally {
        restoreFetch();
    }
});
