import { NextRequest } from "next/server";

const VAPI_BASE_URL = process.env.VAPI_BASE_URL ?? "https://api.vapi.ai";
const VAPI_SERVER_KEY = process.env.VAPI_SERVER_KEY ?? process.env.VAPI_API_KEY;
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

function jsonResponse(status: number, body: Record<string, unknown>) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
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

export async function GET(req: NextRequest) {
  const areaCode = req.nextUrl.searchParams.get("areaCode")?.trim();

  if (!areaCode) {
    return jsonResponse(400, {
      ok: false,
      error: {
        code: "missing_area_code",
        message: "The areaCode query parameter is required.",
      },
    });
  }

  if (!/^\d{3}$/.test(areaCode)) {
    return jsonResponse(400, {
      ok: false,
      error: {
        code: "invalid_area_code",
        message: "Area code must be exactly 3 digits.",
      },
    });
  }

  if (!VAPI_SERVER_KEY) {
    console.error("VAPI server key is not configured for search-numbers route");
    return jsonResponse(500, {
      ok: false,
      error: {
        code: "server_not_configured",
        message: "VAPI server key is not configured.",
      },
    });
  }

  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, SEARCH_TIMEOUT_MS);

  const abortUpstreamRequest = () => controller.abort();
  const requestSignal: AbortSignal | undefined = (req as Request).signal;

  if (requestSignal) {
    if (requestSignal.aborted) {
      abortUpstreamRequest();
    } else {
      requestSignal.addEventListener("abort", abortUpstreamRequest);
    }
  }

  try {
    const upstreamUrl = new URL("/phone-number/search", VAPI_BASE_URL);
    upstreamUrl.searchParams.set("areaCode", areaCode);
    upstreamUrl.searchParams.set("country", "US");

    const response = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${VAPI_SERVER_KEY}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      let message = `Upstream request failed with status ${response.status}`;
      let details: unknown = null;

      try {
        const errorJson = await response.clone().json();
        details = errorJson;
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
          // ignore parsing errors
        }
      }

      console.error("VAPI search-numbers upstream error", {
        status: response.status,
        message,
        details,
      });

      return jsonResponse(response.status, {
        ok: false,
        error: {
          code: "upstream_error",
          message,
          details,
        },
      });
    }

    const payload = await response.json();
    const numbers = normalizeNumbers(payload);

    return jsonResponse(200, {
      ok: true,
      numbers,
    });
  } catch (error) {
    if (isAbortError(error)) {
      const code = timedOut ? "upstream_timeout" : "request_aborted";
      const message = timedOut
        ? "The upstream Vapi search request timed out."
        : "The search request was aborted.";

      return jsonResponse(timedOut ? 504 : 499, {
        ok: false,
        error: {
          code,
          message,
        },
      });
    }

    console.error("Unexpected error in VAPI search-numbers route", error);
    const message = error instanceof Error ? error.message : "Unknown error";

    return jsonResponse(500, {
      ok: false,
      error: {
        code: "unexpected_error",
        message,
      },
    });
  } finally {
    clearTimeout(timeoutId);
    if (requestSignal) {
      requestSignal.removeEventListener("abort", abortUpstreamRequest);
    }
  }
}
