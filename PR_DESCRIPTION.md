# Fix Provisioning E.164 Regression + Onboarding Guardrails

## Summary

Fixes a provisioning failure caused by unformatted phone numbers being passed to Vapi, and adds server-side onboarding state management with guardrail UI components.

## Root Cause

The `provision-phone-number` and `provision-vapi` Edge Functions were passing `phone` values directly to Vapi's `fallbackDestination.number` without E.164 normalization. Formatted strings like `(303) 555-1234` caused Vapi to reject with:

```
{"message":["fallbackDestination.number must be a valid phone number in E.164 format."]}
```

## Changes

### Phase 0: E.164 Fix (Critical)

| File | Change |
|------|--------|
| `validators.ts` | `formatPhoneE164` now returns `null` on invalid input. Added `tryFormatPhoneE164` with logging. |
| `provision-phone-number/index.ts` | Uses `tryFormatPhoneE164` + `VAPI_FALLBACK_E164` env var fallback. Omits `fallbackDestination` if invalid (Vapi accepts this). |
| `provision-vapi/index.ts` | Same pattern for consistency. |
| `validators.test.ts` | Unit tests verifying null-return on invalid inputs. |

### Phase 1-5: Onboarding Guardrails

| Phase | Description |
|-------|-------------|
| 1 | RPC migration: `get_onboarding_state` (uses `phone_number_id` join), `track_onboarding_event` |
| 2 | `useOnboardingState` hook with polling |
| 3 | Dashboard `OnboardingUiGuardrail` + Phones tab `OnboardingRecoveryPanel` |
| 4 | `detect-test-call-alert` cron function |
| 5 | CI path triggers for onboarding components |

## Testing

- [x] Vapi API docs confirm `fallbackDestination` is optional
- [x] Unit tests for `formatPhoneE164` pass
- [ ] Manual: Create trial and verify provisioning completes

## Rollback

### Quick Rollback (ActivationStepper)

```typescript
// In src/pages/Activation.tsx, line 21
const USE_NEW_FLOW = false;  // Change to false
```

### Full Rollback (Edge Functions)

```bash
# Revert to previous commit
git checkout main -- supabase/functions/provision-phone-number/index.ts
git checkout main -- supabase/functions/provision-vapi/index.ts
git checkout main -- supabase/functions/_shared/validators.ts

# Redeploy
npx supabase functions deploy provision-phone-number --no-verify-jwt
npx supabase functions deploy provision-vapi --no-verify-jwt
```

### Rollback RPC (if needed)

```sql
-- Run in Supabase SQL Editor
DROP FUNCTION IF EXISTS get_onboarding_state(UUID);
DROP FUNCTION IF EXISTS track_onboarding_event(TEXT, JSONB);
```

## Checklist

- [x] Migrations applied
- [x] Edge Functions deployed
- [x] Branch pushed
- [ ] PR merged to main
