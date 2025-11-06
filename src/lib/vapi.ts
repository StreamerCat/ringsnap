const AREA_CODE_REGEX = /^\d{3}$/;
const SEARCH_TIMEOUT_MS = 8000;

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  if (error instanceof DOMException) {
    return error.name === "AbortError";
  }

  if (error instanceof Error) {
    return error.name === "AbortError";
  }

  return false;
}

function normalizeNumbers(payload: unknown): string[] {
  const normalize = (value: unknown): string | null => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed.length ? trimmed : null;
    }

    if (value && typeof value === "object") {
      const candidate =
        (value as Record<string, unknown>).number ??
        (value as Record<string, unknown>).phoneNumber ??
        (value as Record<string, unknown>).value;
      return typeof candidate === "string" && candidate.trim().length ? candidate : null;
    }

    return null;
  };

  if (Array.isArray(payload)) {
    return payload.map(normalize).filter((value): value is string => Boolean(value));
  }

  if (payload && typeof payload === "object") {
    const candidateList =
      (payload as Record<string, unknown>).numbers ??
      (payload as Record<string, unknown>).data;

    if (Array.isArray(candidateList)) {
      return candidateList.map(normalize).filter((value): value is string => Boolean(value));
    }
  }

  return [];
}

export async function searchNumbersByAreaCode(areaCode: string, signal?: AbortSignal): Promise<string[]> {
  const trimmed = areaCode.trim();
  if (!AREA_CODE_REGEX.test(trimmed)) {
    throw new RangeError("Area code must be exactly 3 digits");
  }

  const controller = new AbortController();
  const abortController = () => {
    controller.abort();
  };

  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, SEARCH_TIMEOUT_MS);

  if (signal) {
    if (signal.aborted) {
      abortController();
    } else {
      signal.addEventListener("abort", abortController);
    }
  }

  try {
    const params = new URLSearchParams({ areaCode: trimmed });
    const response = await fetch(`/api/vapi/search-numbers?${params.toString()}`, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      let message = `Request failed with status ${response.status}`;

      try {
        const errorJson = await response.clone().json();
        if (errorJson && typeof errorJson === "object") {
          const errorMessage =
            typeof (errorJson as Record<string, unknown>).error === "string"
              ? (errorJson as Record<string, unknown>).error
              : typeof (errorJson as { error?: { message?: string } }).error?.message === "string"
              ? (errorJson as { error?: { message?: string } }).error?.message
              : null;

          if (errorMessage) {
            message = errorMessage;
          }
        }
      } catch {
        try {
          const errorText = await response.text();
          if (errorText.trim().length) {
            message = errorText.trim();
          }
        } catch {
          // ignore secondary parsing errors
        }
      }

      throw new Error(message);
    }

    const payload = await response.json();
    return normalizeNumbers(payload);
  } catch (error) {
    if (isAbortError(error)) {
      if (timedOut) {
        throw new Error("Request timed out while searching for phone numbers");
      }

      throw error;
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Failed to search for phone numbers");
  } finally {
    clearTimeout(timeoutId);
    if (signal) {
      signal.removeEventListener("abort", abortController);
    }
  }
}
