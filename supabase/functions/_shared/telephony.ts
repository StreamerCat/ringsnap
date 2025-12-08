
import { logError, logInfo } from "./logging.ts";

export type TelephonyProviderType = "twilio" | "vapi" | "vonage" | "telnyx";

export interface ProviderConfig {
    type: TelephonyProviderType;
    accountSid?: string;
    authToken?: string;
    apiKey?: string;
    apiSecret?: string;
    vapiCredentialId?: string; // ID of the credential in Vapi (for import)
}

// ... (ProvisionResult interface remains same) ...

export async function provisionPhoneNumber(
    config: ProviderConfig,
    filters: {
        countryCode: string; // "US"
        areaCode?: string;
        capabilities?: { voice: boolean; sms: boolean };
    },
    ctx: { correlationId?: string } = {}
): Promise<ProvisionResult> {
    const { type } = config;

    if (type === "twilio") {
        return await provisionTwilioNumber(config, filters, ctx);
    } else if (type === "vapi") {
        throw new Error("Direct Vapi provisioning not implemented in telephony abstraction.");
    }

    throw new Error(`Provider '${type}' not supported for direct provisioning.`);
}

// ----------------------------------------------------------------------------
// Twilio Implementation
// ----------------------------------------------------------------------------

async function provisionTwilioNumber(
    config: ProviderConfig,
    filters: { countryCode: string; areaCode?: string },
    ctx: { correlationId?: string } = {}
): Promise<ProvisionResult> {
    const { accountSid, authToken, apiKey, apiSecret } = config;

    // Validate Creds: Need Account SID AND (AuthToken OR (ApiKey+ApiSecret))
    if (!accountSid) {
        throw new Error("Missing Twilio Account SID");
    }
    const hasToken = !!authToken;
    const hasApiKeys = !!apiKey && !!apiSecret;

    if (!hasToken && !hasApiKeys) {
        throw new Error("Missing Twilio credentials (need AuthToken or ApiKey/ApiSecret)");
    }

    const correlationId = ctx.correlationId || `twilio-${Date.now()}`;

    const baseLog = {
        functionName: "provisionTwilioNumber",
        correlationId,
        provider: "twilio",
    };

    // Construct Basic Auth
    // Preference: API Key (username) + Secret (password) if available, else SID + Token
    let basicAuth: string;
    if (hasApiKeys) {
        basicAuth = btoa(`${apiKey}:${apiSecret}`);
    } else {
        basicAuth = btoa(`${accountSid}:${authToken}`);
    }

    const headers = {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
    };

    // 1. Search for a number
    let searchParams = new URLSearchParams();
    if (filters.areaCode) searchParams.append("AreaCode", filters.areaCode);
    searchParams.append("VoiceEnabled", "true");
    searchParams.append("SmsEnabled", "true");
    searchParams.append("PageSize", "1");

    const searchUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/AvailablePhoneNumbers/${filters.countryCode}/Local.json?${searchParams.toString()}`;

    logInfo("Searching for Twilio number", { ...baseLog, context: { filters } });

    let searchRes = await fetch(searchUrl, { method: "GET", headers });

    // Backup: If search fails with specific area code, retry without it or with a fallback
    if (!searchRes.ok && filters.areaCode) {
        logInfo("Twilio search failed with AreaCode, retrying without", { ...baseLog });
        const cleanParams = new URLSearchParams();
        cleanParams.append("VoiceEnabled", "true");
        cleanParams.append("SmsEnabled", "true");
        cleanParams.append("PageSize", "1");
        searchRes = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/AvailablePhoneNumbers/${filters.countryCode}/Local.json?${cleanParams.toString()}`,
            { method: "GET", headers }
        );
    }

    if (!searchRes.ok) {
        const errText = await searchRes.text();
        // Special handling: If 404 or bad request due to area code
        if (filters.areaCode) {
            logInfo("Twilio search failed (HTTP error), retrying without AreaCode", { ...baseLog });
            const cleanParams = new URLSearchParams();
            cleanParams.append("VoiceEnabled", "true");
            cleanParams.append("SmsEnabled", "true");
            cleanParams.append("PageSize", "1");
            searchRes = await fetch(
                `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/AvailablePhoneNumbers/${filters.countryCode}/Local.json?${cleanParams.toString()}`,
                { method: "GET", headers }
            );
            if (!searchRes.ok) {
                const retryErrText = await searchRes.text();
                throw new Error(`Twilio Search Failed (Retry): ${searchRes.status} ${retryErrText}`);
            }
        } else {
            throw new Error(`Twilio Search Failed: ${searchRes.status} ${errText}`);
        }
    }

    let searchData = await searchRes.json();
    let available = searchData.available_phone_numbers;

    // Retry if empty list and we used an area code
    if ((!available || available.length === 0) && filters.areaCode) {
        logInfo("No numbers found in area code, retrying with raw country search", { ...baseLog });
        const cleanParams = new URLSearchParams();
        cleanParams.append("VoiceEnabled", "true");
        cleanParams.append("SmsEnabled", "true");
        cleanParams.append("PageSize", "1");
        searchRes = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/AvailablePhoneNumbers/${filters.countryCode}/Local.json?${cleanParams.toString()}`,
            { method: "GET", headers }
        );

        if (searchRes.ok) {
            searchData = await searchRes.json();
            available = searchData.available_phone_numbers;
        }
    }

    if (!available || available.length === 0) {
        throw new Error("No available Twilio numbers found.");
    }

    const chosenNumber = available[0].phone_number; // E.164 already
    logInfo("Found Twilio number, purchasing...", { ...baseLog, context: { chosenNumber } });

    // 2. Buy the number
    const buyUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json`;
    const buyBody = new URLSearchParams();
    buyBody.append("PhoneNumber", chosenNumber);

    // We can also set a FriendlyName or Callback URL here if needed
    // buyBody.append("FriendlyName", `Vapi-${filters.areaCode || "General"}`);

    const buyRes = await fetch(buyUrl, {
        method: "POST",
        headers,
        body: buyBody,
    });

    if (!buyRes.ok) {
        const errText = await buyRes.text();
        throw new Error(`Twilio Purchase Failed: ${buyRes.status} ${errText}`);
    }

    const buyData = await buyRes.json();

    logInfo("Successfully purchased Twilio number", { ...baseLog, context: { sid: buyData.sid, number: buyData.phone_number } });

    return {
        phoneNumber: buyData.phone_number,
        providerId: buyData.sid,
        provider: "twilio",
        metadata: {
            friendlyName: buyData.friendly_name,
            capabilities: buyData.capabilities
        }
    };
}
