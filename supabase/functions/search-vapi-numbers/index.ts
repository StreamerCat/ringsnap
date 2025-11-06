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

    logInfo("Generating preview phone numbers", {
      ...baseLog,
      context: { areaCode: normalizedAreaCode, limit: searchLimit }
    });

    // Vapi doesn't have a phone number search endpoint.
    // Instead, we generate preview numbers for UI purposes.
    // The actual provisioning happens when the user submits the form.

    // Generate realistic preview numbers based on the area code
    const previewNumbers: VapiPhoneResult[] = [];
    const baseNumber = Math.floor(Math.random() * 900) + 100; // Random 3-digit number

    for (let i = 0; i < searchLimit; i++) {
      const exchange = (baseNumber + i).toString().padStart(3, '0');
      const lineNumber = Math.floor(Math.random() * 9000) + 1000; // Random 4-digit number
      const fullNumber = `+1${normalizedAreaCode}${exchange}${lineNumber}`;

      previewNumbers.push({
        id: `preview-${normalizedAreaCode}-${i}`,
        phoneNumber: fullNumber,
        number: fullNumber,
        provider: "vapi"
      });
    }

    logInfo("Preview numbers generated", {
      ...baseLog,
      context: { count: previewNumbers.length }
    });

    return json(200, {
      areaCode: normalizedAreaCode,
      numbers: previewNumbers,
      source: "vapi-preview",
      info: "Preview numbers shown. Actual number will be provisioned on submission."
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

