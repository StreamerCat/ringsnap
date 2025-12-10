# Async provisioning + Idempotent create-trial + Auth Hardening

## Summary

This PR implements async provisioning with comprehensive idempotency, compensation logic, and webhook hardening. Additionally, it **hardens the authentication and onboarding flows** to resolve critical issues for returning users, recurring lead capture errors, and password reset failures.

### Problem Solved
- ✅ **Auth & Signup:** Fixed JSON errors for returning users on `/start` by adding robust session validation and auto-signout for invalid states.
- ✅ **Existing Users:** Resolved 406 errors for users with missing profiles by using `maybeSingle()` and redirecting to onboarding instead of crashing.
- ✅ **Signup Leads:** Fixed "Failed to fetch" errors and "duplicate key" constraints by implementing robust client-side upsert logic for lead capture.
- ✅ **Idempotency:** Resolved "duplicate key" errors in lead capture by implementing upsert logic for existing emails.
- ✅ **Password Reset:** Fixed "no valid recovery session" error by ensuring session checks complete before user interaction and handling URL error parameters.
- ✅ **Linting:** Resolved all blocking lint errors and warnings across the codebase.
- ✅ Duplicate account creation from repeated API calls
- ✅ Orphaned Stripe customers when DB creation fails
- ✅ Stalled provisioning from inline Vapi failures blocking signup
- ✅ No retry mechanism for provisioning failures
- ✅ Missing webhook signature validation (security risk)
- ✅ Duplicate webhook event processing

## Files Changed

**Authentication & Onboarding (New):**
- `src/pages/Start.tsx`: Hardened session checks and error handling.
- `src/pages/PasswordReset.tsx`: Fixed session race conditions and added loading states.
- `src/pages/OnboardingChat.tsx`: Improved duplicate error handling.
- `src/components/SalesSignupForm.tsx`: Fixed regex patterns.
- `src/components/signup/shared/enhanced-schemas.ts`: Fixed regex patterns.
- `eslint.config.js`: Updated to ignore Deno functions (fix false positives).

**Database Migrations (4):**
- `supabase/migrations/20251123000001_idempotency_results.sql`
- `supabase/migrations/20251123000002_provisioning_timestamps.sql`
- `supabase/migrations/20251123000003_stripe_events.sql`
- `supabase/migrations/20251123999999_rollback_async_provisioning.sql`

**Edge Functions (3):**
- `supabase/functions/create-trial/index.ts` (refactored, -571 +302 lines)
- `supabase/functions/provision-vapi/index.ts` (new, 612 lines)
- `supabase/functions/stripe-webhook/index.ts` (+116 -3 lines)

**Frontend Components (1):**
- `src/components/onboarding/shared/ProvisioningStatus.tsx` (+151 -43 lines)

**Total:** ~15 files changed

## How to Test

1.  **Returning Users:** Visit `/start` as a logged-in user. You should be redirected correctly instead of seeing a JSON error.
2.  **Password Reset:** Request a password reset link, click it, and verify the page loads in a "Verifying link..." state before allowing input. Ensure password reset succeeds and redirects to dashboard.
3.  **Signup:** Attempt to sign up with an existing email on the lead form. The flow should proceed gracefully without crashing.

## Rollback Plan

Emergency rollback available via `20251123999999_rollback_async_provisioning.sql` migration.

**Ready for staging deployment and smoke testing.**
