import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyCiTestRequest } from '../../supabase/functions/_shared/ci-test-auth.ts';

const secret = 'local-service-role-test-secret';
const runId = 'ci-run-12345678';
const timestamp = 1_788_300_000_000;

function requestWithSignature(signingSecret = secret, requestTimestamp = timestamp) {
  const signature = createHmac('sha256', signingSecret)
    .update(`${runId}:${requestTimestamp}`)
    .digest('hex');

  return new Request('https://example.test', {
    headers: {
      'x-ringsnap-ci-run-id': runId,
      'x-ringsnap-ci-timestamp': requestTimestamp.toString(),
      'x-ringsnap-ci-signature': signature,
    },
  });
}

describe('CI test request authentication', () => {
  it('accepts a current valid signature', async () => {
    await expect(verifyCiTestRequest(requestWithSignature(), secret, timestamp)).resolves.toEqual({
      authorized: true,
      runId,
    });
  });

  it('rejects unsigned and forged requests', async () => {
    await expect(verifyCiTestRequest(new Request('https://example.test'), secret, timestamp))
      .resolves.toMatchObject({ authorized: false });
    await expect(verifyCiTestRequest(requestWithSignature('wrong-secret'), secret, timestamp))
      .resolves.toMatchObject({ authorized: false, reason: 'signature_mismatch' });
  });

  it('rejects expired signatures', async () => {
    await expect(verifyCiTestRequest(requestWithSignature(), secret, timestamp + 6 * 60 * 1000))
      .resolves.toMatchObject({ authorized: false, reason: 'expired_signature' });
  });
});
