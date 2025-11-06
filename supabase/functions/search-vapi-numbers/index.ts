import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { extractCorrelationId, logError, logInfo, logWarn } from "../_shared/logging.ts";

const FUNCTION_NAME = "search-vapi-numbers";
const DEFAULT_LIMIT = 5;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

type SearchRequest = {
  areaCode?: string;
  limit?: number;
};

type VapiPhoneResult = {
  id?: string;
  sid?: string;
  number?: string;
  phoneNumber?: string;
  phone_number?: string;
  provider?: string;
};

type VapiSearchResponse = {
  data?: VapiPhoneResult[];
  numbers?: VapiPhoneResult[];
  message?: string;
  error?: string;
};

function normalizeAreaCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 3) return null;
  return digits.slice(0, 3);
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders
    }
  });
}

function extractNumbers(payload: VapiSearchResponse | VapiPhoneResult[] | null | undefined) {
  if (!payload) return [] as VapiPhoneResult[];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.numbers)) return payload.numbers;
  if (Array.isArray(payload.data)) return payload.data;
  return [] as VapiPhoneResult[];
}

serve(async (req) => {
  const correlationId = extractCorrelationId(req);
  const baseLog = { functionName: FUNCTION_NAME, correlationId };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const { areaCode, limit } = (await req.json()) as SearchRequest;
    const normalizedAreaCode = normalizeAreaCode(areaCode ?? null);

    if (!normalizedAreaCode) {
      return json(400, { error: "A 3-digit area code is required" });
    }

    const searchLimit = Math.max(1, Math.min(Number(limit ?? DEFAULT_LIMIT), 10));

    const VAPI_BASE_URL = Deno.env.get("VAPI_BASE_URL") ?? "https://api.vapi.ai";
    const VAPI_API_KEY = Deno.env.get("VAPI_API_KEY");

    if (!VAPI_API_KEY) {
      throw new Error("VAPI_API_KEY not configured");
    }

    logInfo("Searching for phone numbers", {
      ...baseLog,
      context: { areaCode: normalizedAreaCode, limit: searchLimit }
    });

    const response = await fetch(`${VAPI_BASE_URL}/phone-number/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${VAPI_API_KEY}`
      },
      body: JSON.stringify({
        numberDesiredAreaCode: normalizedAreaCode,
        limit: searchLimit,
        country: "US"
      })
    });

    const text = await response.text();
    let payload: VapiSearchResponse | VapiPhoneResult[] | null = null;

    if (text) {
      try {
        payload = JSON.parse(text) as VapiSearchResponse | VapiPhoneResult[];
      } catch (error) {
        logWarn("Unable to parse Vapi response", {
          ...baseLog,
          context: { error, response: text }
        });
        payload = null;
      }
    }

    if (!response.ok) {
      const errorMessage =
        (payload && "message" in payload && payload.message) ||
        (payload && "error" in payload && payload.error) ||
        text ||
        "Vapi search failed";

      logWarn("Vapi search returned an error", {
        ...baseLog,
        context: { status: response.status, message: errorMessage }
      });

      let suggestions: string[] | undefined;
      if (typeof errorMessage === "string") {
        const match = errorMessage.match(/available area codes: ([\d,\s]+)/i);
        if (match) {
          suggestions = match[1]
            .split(",")
            .map((code) => code.trim())
            .filter((code) => code.length === 3);
        }
      }

      return json(200, {
        areaCode: normalizedAreaCode,
        numbers: [],
        source: "vapi",
        error: typeof errorMessage === "string" ? errorMessage : "Unable to search for numbers",
        suggestions
      });
    }

    const results = extractNumbers(payload);

    logInfo("Vapi search succeeded", {
      ...baseLog,
      context: { count: results.length }
    });

    return json(200, {
      areaCode: normalizedAreaCode,
      numbers: results,
      source: "vapi"
    });
  } catch (error) {
    logError("Unexpected error while searching numbers", {
      ...baseLog,
      error
    });

    return json(500, {
      error: error instanceof Error ? error.message : "Unknown error",
      areaCode: null,
      numbers: [],
      source: "vapi"
    });
  }
});

