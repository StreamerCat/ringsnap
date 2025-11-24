export interface PhoneNumberSearchParams {
  areaCode: string;
  limit?: number;
  signal?: AbortSignal;
}

export interface PhoneNumberOption {
  id: string;
  phoneNumber: string;
  formatted?: string;
  provider?: string;
  raw?: unknown;
}

export interface NumberSearchResult {
  numbers: PhoneNumberOption[];
  areaCode: string;
  source?: string;
  suggestions?: string[];
  error?: string;
}

function ensureEnvironment(variable: string | undefined, name: string): string {
  if (!variable) {
    throw new Error(`Missing ${name} environment variable`);
  }
  return variable;
}

function extractNumbers(payload: unknown): PhoneNumberOption[] {
  if (!payload) return [];
  const collection: unknown[] = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as Record<string, unknown>)?.numbers)
      ? ((payload as Record<string, unknown>).numbers as unknown[])
      : Array.isArray((payload as Record<string, unknown>)?.data)
        ? ((payload as Record<string, unknown>).data as unknown[])
        : [];

  return collection
    .map((entry) => {
      if (!entry) return null;
      if (typeof entry === "string") {
        return { id: entry, phoneNumber: entry, raw: entry } satisfies PhoneNumberOption;
      }

      if (typeof entry !== "object") return null;

      const record = entry as Record<string, unknown>;
      const phoneCandidate =
        typeof record.phoneNumber === "string"
          ? record.phoneNumber
          : typeof record.number === "string"
            ? record.number
            : typeof record.phone_number === "string"
              ? record.phone_number
              : typeof record.value === "string"
                ? record.value
                : null;

      if (!phoneCandidate) return null;

      const identifier =
        typeof record.id === "string"
          ? record.id
          : typeof record.sid === "string"
            ? record.sid
            : phoneCandidate;

      return {
        id: identifier,
        phoneNumber: phoneCandidate,
        provider: typeof record.provider === "string" ? record.provider : undefined,
        raw: entry
      } satisfies PhoneNumberOption;
    })
    .filter(Boolean) as PhoneNumberOption[];
}

export async function searchAvailablePhoneNumbers(
  params: PhoneNumberSearchParams
): Promise<NumberSearchResult> {
  const { areaCode, limit = 5, signal } = params;
  const normalizedAreaCode = areaCode.replace(/\D/g, "").slice(0, 3);

  if (normalizedAreaCode.length !== 3) {
    throw new Error("Area code must include three digits");
  }

  const supabaseUrl = ensureEnvironment(import.meta.env.VITE_SUPABASE_URL, "VITE_SUPABASE_URL");
  const supabaseAnonKey = ensureEnvironment(
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    "VITE_SUPABASE_ANON_KEY"
  );

  const response = await fetch(`${supabaseUrl}/functions/v1/search-vapi-numbers`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${supabaseAnonKey}`,
      apikey: supabaseAnonKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ areaCode: normalizedAreaCode, limit }),
    signal
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Failed to search for phone numbers");
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const numbers = extractNumbers(payload);

  const suggestionsRaw = payload.suggestions;
  const suggestions = Array.isArray(suggestionsRaw)
    ? (suggestionsRaw.filter((value) => typeof value === "string") as string[])
    : undefined;

  return {
    numbers,
    areaCode: typeof payload.areaCode === "string" ? payload.areaCode : normalizedAreaCode,
    source: typeof payload.source === "string" ? payload.source : undefined,
    suggestions,
    error: typeof payload.error === "string" ? payload.error : undefined
  } satisfies NumberSearchResult;
}

