#!/usr/bin/env -S deno run --allow-net --allow-env

/**
 * Standalone test script for Vapi phone provisioning API
 * Tests the POST /phone-number endpoint directly
 */

const VAPI_API_KEY = Deno.env.get("VAPI_API_KEY");
const VAPI_BASE_URL = "https://api.vapi.ai";

if (!VAPI_API_KEY) {
    console.error("ERROR: VAPI_API_KEY environment variable is not set");
    console.error("Please set it before running this script:");
    console.error("  export VAPI_API_KEY=your_key_here");
    Deno.exit(1);
}

console.log("=".repeat(60));
console.log("Vapi Phone Provisioning Test");
console.log("=".repeat(60));
console.log("");

// Build payload according to Vapi API - FIXED: removed numberType
const phonePayload = {
    provider: "vapi",
    areaCode: "415", // San Francisco area code
};

const endpoint = `${VAPI_BASE_URL}/phone-number`;

console.log(`Endpoint: ${endpoint}`);
console.log(`Payload: ${JSON.stringify(phonePayload, null, 2)}`);
console.log("");
console.log("Sending request...");
console.log("");

try {
    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${VAPI_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(phonePayload),
    });

    const responseText = await response.text();

    console.log("=".repeat(60));
    console.log("Response");
    console.log("=".repeat(60));
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Body:`);
    console.log(responseText);
    console.log("");

    if (response.ok) {
        console.log("✅ Vapi phone provisioning test SUCCESS");
        try {
            const data = JSON.parse(responseText);
            console.log(`Phone ID: ${data.id}`);
            console.log(`Phone Number: ${data.number || data.phone_e164 || "N/A"}`);
        } catch (e) {
            // Response might not be JSON
        }
    } else {
        console.log("❌ Vapi phone provisioning test FAILED");
        console.log(`HTTP ${response.status}: ${response.statusText}`);
    }

    Deno.exit(response.ok ? 0 : 1);
} catch (error) {
    console.error("=".repeat(60));
    console.error("ERROR");
    console.error("=".repeat(60));
    console.error(error);
    Deno.exit(1);
}
