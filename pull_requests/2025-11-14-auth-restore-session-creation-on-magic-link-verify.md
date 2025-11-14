# Pull Request

## Problem
verify-magic-link consumed tokens atomically but stopped returning a usable session; clients could not become authenticated after following a magic link. AuthLogin referenced a missing device-nonce helper.

## Fix
atomically consume token, then create/find user, set a temporary password, sign in server-side to obtain session tokens and return them to the client. MagicCallback now sets the session via supabase.auth.setSession. Added generateDeviceNonce helper in AuthLogin. Token hashing uses HMAC-SHA256 with the service role key (must match send-magic-link).

## Tests
run e2e/playwright/magic-link.spec.ts with EMAIL_TEST_INBOX_URL; manual magic-link flow test described.

## Notes
Ensure send-magic-link uses the same HMAC scheme/secret; changing hashing on prod invalidates outstanding links without a compatibility path.