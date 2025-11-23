# Async provisioning + idempotent create-trial + webhook hardening

## Summary

This PR implements async provisioning with comprehensive idempotency, compensation logic, and webhook hardening to eliminate duplicate accounts, orphaned Stripe customers, and stalled provisioning.

### Problem Solved
- ✅ Duplicate account creation from repeated API calls
- ✅ Orphaned Stripe customers when DB creation fails
- ✅ Stalled provisioning from inline Vapi failures blocking signup
- ✅ No retry mechanism for provisioning failures
- ✅ Missing webhook signature validation (security risk)
- ✅ Duplicate webhook event processing

## Files Changed

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

**Total:** 8 files changed, ~1,500 lines added/modified

## How to Test

See full testing instructions in the complete PR description (too large for initial PR body).

## Rollback Plan

Emergency rollback available via `20251123999999_rollback_async_provisioning.sql` migration.

**Ready for staging deployment and smoke testing.**
