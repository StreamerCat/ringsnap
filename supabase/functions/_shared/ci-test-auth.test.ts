import { verifyCiTestRequest } from "./ci-test-auth.ts";

async function sign(secret: string, message: string): Promise<string> {
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

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("verifyCiTestRequest accepts a current valid signature", async () => {
  const secret = "local-service-role-test-secret";
  const runId = "ci-run-12345678";
  const timestamp = 1_788_300_000_000;
  const signature = await sign(secret, `${runId}:${timestamp}`);
  const request = new Request("https://example.test", {
    headers: {
      "x-ringsnap-ci-run-id": runId,
      "x-ringsnap-ci-timestamp": timestamp.toString(),
      "x-ringsnap-ci-signature": signature,
    },
  });

  const result = await verifyCiTestRequest(request, secret, timestamp);
  assert(result.authorized, `expected authorization, got ${result.reason}`);
  assert(result.runId === runId, "expected the signed run ID");
});

Deno.test("verifyCiTestRequest rejects unsigned and forged requests", async () => {
  const timestamp = 1_788_300_000_000;
  const unsigned = await verifyCiTestRequest(new Request("https://example.test"), "secret", timestamp);
  assert(!unsigned.authorized, "unsigned request should be rejected");

  const runId = "ci-run-12345678";
  const forged = new Request("https://example.test", {
    headers: {
      "x-ringsnap-ci-run-id": runId,
      "x-ringsnap-ci-timestamp": timestamp.toString(),
      "x-ringsnap-ci-signature": await sign("wrong-secret", `${runId}:${timestamp}`),
    },
  });
  const forgedResult = await verifyCiTestRequest(forged, "correct-secret", timestamp);
  assert(!forgedResult.authorized, "forged request should be rejected");
});

Deno.test("verifyCiTestRequest rejects expired signatures", async () => {
  const secret = "local-service-role-test-secret";
  const runId = "ci-run-12345678";
  const timestamp = 1_788_300_000_000;
  const request = new Request("https://example.test", {
    headers: {
      "x-ringsnap-ci-run-id": runId,
      "x-ringsnap-ci-timestamp": timestamp.toString(),
      "x-ringsnap-ci-signature": await sign(secret, `${runId}:${timestamp}`),
    },
  });

  const result = await verifyCiTestRequest(request, secret, timestamp + 6 * 60 * 1000);
  assert(!result.authorized, "expired request should be rejected");
});
