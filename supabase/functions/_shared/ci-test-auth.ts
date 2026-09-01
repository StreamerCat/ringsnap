const CI_SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000;
const RUN_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const HEX_SIGNATURE_PATTERN = /^[a-f0-9]{64}$/;

export type CiTestAuthorization = {
  authorized: boolean;
  runId: string | null;
  reason?: string;
};

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;

  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Authenticate a CI-only test request without exposing the service-role key.
 * The signature is HMAC-SHA256(`${runId}:${timestamp}`), expires after five
 * minutes, and is valid only when all three headers are present.
 */
export async function verifyCiTestRequest(
  req: Request,
  secret: string,
  nowMs = Date.now(),
): Promise<CiTestAuthorization> {
  const runId = req.headers.get("x-ringsnap-ci-run-id")?.trim() ?? "";
  const timestampRaw = req.headers.get("x-ringsnap-ci-timestamp")?.trim() ?? "";
  const providedSignature = req.headers.get("x-ringsnap-ci-signature")?.trim().toLowerCase() ?? "";

  if (!secret) return { authorized: false, runId: null, reason: "missing_server_secret" };
  if (!RUN_ID_PATTERN.test(runId)) return { authorized: false, runId: null, reason: "invalid_run_id" };
  if (!/^\d{13}$/.test(timestampRaw)) return { authorized: false, runId: null, reason: "invalid_timestamp" };
  if (!HEX_SIGNATURE_PATTERN.test(providedSignature)) {
    return { authorized: false, runId: null, reason: "invalid_signature_format" };
  }

  const timestamp = Number(timestampRaw);
  if (!Number.isSafeInteger(timestamp) || Math.abs(nowMs - timestamp) > CI_SIGNATURE_MAX_AGE_MS) {
    return { authorized: false, runId: null, reason: "expired_signature" };
  }

  const expectedSignature = await hmacSha256Hex(secret, `${runId}:${timestampRaw}`);
  if (!constantTimeEqual(expectedSignature, providedSignature)) {
    return { authorized: false, runId: null, reason: "signature_mismatch" };
  }

  return { authorized: true, runId };
}
