import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { authorizePlatformStaff } from '../../supabase/functions/_shared/staff-authorization.ts';
import { safeInternalRedirect } from '../../src/lib/auth/safe-redirect.ts';
import { generateReferralCode, generateVerificationCode } from '../../supabase/functions/_shared/validators.ts';

function client({ role = 'platform_admin', valid = true, roleError = null } = {}) {
  return {
    auth: { getUser: async token => ({ data: { user: valid && token === 'valid-user-token' ? { id: 'staff-user' } : null }, error: null }) },
    from: table => {
      assert.equal(table, 'staff_roles');
      return { select: column => {
        assert.equal(column, 'role');
        return { eq: (key, value) => {
          assert.equal(key, 'user_id'); assert.equal(value, 'staff-user');
          return { maybeSingle: async () => ({ data: role ? { role } : null, error: roleError }) };
        } };
      } };
    },
  };
}
const request = token => new Request('https://example.test', { headers: token ? { Authorization: `Bearer ${token}` } : {} });

test('rejects missing, malformed, forged, and public API credentials', async () => {
  for (const token of [null, 'forged', 'public-anon-key', 'service-role-key']) {
    assert.equal((await authorizePlatformStaff(request(token), client())).status, 401);
  }
  assert.equal((await authorizePlatformStaff(new Request('https://example.test', { headers: { Authorization: 'Basic valid-user-token' } }), client())).status, 401);
});

test('only current platform admins and owners can use diagnostic utilities', async () => {
  for (const role of ['platform_admin', 'platform_owner']) {
    assert.equal(await authorizePlatformStaff(request('valid-user-token'), client({ role })), null);
  }
  for (const role of ['sales', 'support', 'viewer', 'owner', null]) {
    assert.equal((await authorizePlatformStaff(request('valid-user-token'), client({ role }))).status, 403);
  }
});

test('authorization fails closed when Auth or role lookup fails', async () => {
  assert.equal((await authorizePlatformStaff(request('valid-user-token'), client({ valid: false }))).status, 401);
  assert.equal((await authorizePlatformStaff(request('valid-user-token'), client({ roleError: new Error('database unavailable') }))).status, 403);
  const unavailable = { auth: { getUser: async () => { throw new Error('auth unavailable'); } } };
  assert.equal((await authorizePlatformStaff(request('valid-user-token'), unavailable)).status, 403);
});

test('rejects unsafe authentication redirects, preserving valid deep links', () => {
  for (const path of ['/dashboard', '/settings/security?updated=1', '/resources/call-handling#intro']) assert.equal(safeInternalRedirect(path), path);
  for (const path of [null, '', 'https://evil.test', '//evil.test', '/\\evil.test', '/%5cevil.test', '/%2fevil.test', '/%252fevil.test', '/%0a/evil.test', 'javascript:alert(1)', '/bad%']) assert.equal(safeInternalRedirect(path), null);
});


test('preserves encoded query and fragment data after authentication', () => {
  for (const path of [
    '/dashboard?search=after%20hours',
    '/dashboard?discount=100%25',
    '/dashboard#after%20hours',
    '/dashboard?next=https%3A%2F%2Fexample.test%2F',
    '/dashboard?search=C%3A%5Ctemp',
  ]) assert.equal(safeInternalRedirect(path), path);
});

test('rejects raw control characters even in query and fragment values', () => {
  for (const path of [
    '/dashboard?q=one' + String.fromCharCode(10) + 'two',
    '/dashboard#one' + String.fromCharCode(9) + 'two',
  ]) assert.equal(safeInternalRedirect(path), null);
});

test('verification and referral codes use crypto randomness and retain their formats', () => {
  const original = Math.random;
  Math.random = () => { throw new Error('Insecure random source used'); };
  try {
    for (let i = 0; i < 100; i++) {
      assert.match(generateVerificationCode(), /^[1-9][0-9]{5}$/);
      assert.match(generateReferralCode(), /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
    }
  } finally { Math.random = original; }
});

test('retired database cleanup cannot access credentials or delete records', () => {
  const source = readFileSync(new URL('../../supabase/functions/cleanup-database/index.ts', import.meta.url), 'utf8');
  assert.match(source, /status: 410/);
  assert.doesNotMatch(source, /createClient|deleteUser|SERVICE_ROLE|\.delete\(/);
});
