# Phone Provisioning - Complete Implementation & Merge Guide

## Overview

This branch implements a complete phone provisioning system for RingSnap's onboarding, moving phone number creation from a search-based flow to a provisioning-based flow at the end of onboarding.

## Key Changes

### 1. Database Migrations
**File**: `supabase/migrations/20251107130000_add_phone_provisioning.sql`
- Adds provisioning infrastructure to `accounts` table
- Creates new tables: `phone_number_notifications`, `provisioning_logs`
- Sets up RLS policies and indexes

### 2. Edge Functions (3 new functions)
- **`supabase/functions/provision_number/index.ts`** - Main provisioning endpoint
- **`supabase/functions/provision_number_retry/index.ts`** - Scheduled retry (every 5 min)
- **`supabase/functions/notify_number_ready/index.ts`** - Email/SMS notifications

### 3. React Component
**File**: `src/components/OnboardingNumberStep.tsx`
- New component for phone provisioning step
- 5 UI states: idle, loading, success, pending, error
- Integrated into onboarding wizard as Step 3

### 4. Onboarding Wizard Refactor
**File**: `src/components/OnboardingWizard.tsx` (MODIFIED)
**Key Changes**:
- **Step 1** (was phone search) → Business Details (company, trade, voice)
- **Step 2** (was business details) → Availability (hours, optional)
- **Step 3** (was availability) → Phone Provisioning (NEW, replaces search)

### 5. Documentation
- `IMPLEMENTATION_SUMMARY.md` - Quick-start guide
- `docs/PHONE_PROVISIONING.md` - Complete technical reference
- `.env.provisioning.example` - Environment variable template

## Why These Changes?

### UX Improvements
1. **Better flow**: Users set up business info → set availability → provision number
2. **Account-first**: Phone provisioning happens only after account exists
3. **Clear pending states**: Users understand when setup is happening in background
4. **No blank screens**: Always shows clear status and next steps

### Technical Benefits
1. **Server-side provisioning**: All Vapi API calls are server-side only
2. **Async handling**: Numbers can complete provisioning in background
3. **Proper error handling**: Clear messages and retry logic
4. **Structured logging**: Full audit trail and debugging capability

## Files Modified

```
NEW FILES:
  supabase/functions/provision_number/index.ts
  supabase/functions/provision_number_retry/index.ts
  supabase/functions/notify_number_ready/index.ts
  src/components/OnboardingNumberStep.tsx
  supabase/migrations/20251107130000_add_phone_provisioning.sql
  IMPLEMENTATION_SUMMARY.md
  docs/PHONE_PROVISIONING.md
  .env.provisioning.example

MODIFIED FILES:
  src/components/OnboardingWizard.tsx
    - Reorganized step order
    - Removed phone search/selection
    - Integrated OnboardingNumberStep
    - Updated validation schemas
    - Updated UI labels/descriptions
```

## Implementation Flow

### User Journey
```
1. Enter company details (Step 1)
   ↓
2. Set availability (Step 2) [optional]
   ↓
3. Provision phone number (Step 3)
   ├→ Enter area code
   ├→ System calls provision_number function
   ├→ Either:
   │  ├→ Number activates in 20s → Show success
   │  └→ Still pending → Show pending state, continue later
   └→ Click "Complete Setup" to finish onboarding
```

### Backend Flow
```
provision_number (Edge Function)
├→ Validate input
├→ Create phone via Vapi API
├→ Poll for 20 seconds
├→ Upsert to database
└→ Return: active (200) or pending (202)

[Every 5 minutes]
provision_number_retry (Scheduled Function)
├→ Find pending numbers
├→ Poll Vapi for latest status
├→ If active:
│  ├→ Update database
│  ├→ Send notifications
│  └→ Log success
└→ Increment retry counter
```

## Resolving GitHub Merge Conflicts

If you see "too many conflicts to resolve" in GitHub:

### Option 1: Accept Current Branch (Recommended)
This keeps all provisioning changes since our branch is based on main.

### Option 2: Manual Merge (if needed)
```bash
git fetch origin main
git merge origin/main
# Resolve any conflicts in src/components/OnboardingWizard.tsx
# If conflicts, keep our version (the reorganized one)
git add .
git commit -m "Merge main into phone provisioning branch"
git push
```

### Option 3: Rebase (cleanest)
```bash
git fetch origin main
git rebase origin/main
# If conflicts, resolve them
git rebase --continue
git push --force-with-lease
```

## Testing Checklist

Before merging:
- [ ] Migrations run successfully in Supabase
- [ ] Edge functions deployed
- [ ] Environment variables set
- [ ] Scheduled function configured (cron: `*/5 * * * *`)
- [ ] Onboarding wizard displays all 3 steps correctly
- [ ] Step 1: Company name, trade, voice selection work
- [ ] Step 2: Business hours optional field works
- [ ] Step 3: Phone provisioning shows all states (idle, loading, success, pending, error)
- [ ] Invalid area code shows error
- [ ] Valid area code provisions number or shows pending
- [ ] UI never blanks (always shows status)

## Deployment Instructions

After merging:

1. **Apply migration**
   ```bash
   # In Supabase: SQL Editor → Copy & execute migration
   ```

2. **Deploy functions**
   ```bash
   supabase functions deploy provision_number
   supabase functions deploy provision_number_retry
   supabase functions deploy notify_number_ready
   ```

3. **Set environment variables** (Supabase dashboard)
   ```
   VAPI_API_KEY=sk_...
   SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   NOTIFY_EMAIL_FROM=noreply@getringsnap.com
   APP_URL=https://app.getringsnap.com
   SENDGRID_API_KEY= or RESEND_API_KEY=
   TWILIO_ACCOUNT_SID= (optional)
   TWILIO_AUTH_TOKEN= (optional)
   NOTIFY_SMS_FROM= (optional)
   ```

4. **Enable scheduled function**
   - Supabase Dashboard → Functions → provision_number_retry
   - Enable scheduling, set cron: `*/5 * * * *`

5. **Test end-to-end**
   - Go through onboarding
   - Verify all steps work
   - Check database for records
   - Monitor Edge Function logs

## Commit History

The branch contains 5 logical commits:

1. `c7f3ebc` - Implement phone provisioning infrastructure (migration + main function)
2. `c10da1f` - Add provisioning retry, notification, and UI components
3. `6a1037c` - Add comprehensive provisioning documentation and environment template
4. `21afe59` - Add implementation summary and quick-start guide
5. `5dbac28` - Integrate OnboardingNumberStep as Step 4 in onboarding wizard
6. `65eea34` - Reorganize onboarding wizard: Move phone provisioning to final step (LATEST)

Each commit is self-contained and can be reviewed independently.

## Notes for Reviewers

1. **OnboardingWizard.tsx**: Significant reorganization, but logic is preserved
2. **New functions**: Follow project patterns (logging, error handling, CORS)
3. **Component**: Uses existing shadcn/ui and React Hook Form patterns
4. **Database**: Additive changes only (no destructive migrations)
5. **RLS**: Implemented to prevent cross-user access
6. **Environment**: No secrets committed, all in template

## Questions or Issues?

Refer to:
- `IMPLEMENTATION_SUMMARY.md` - Quick overview
- `docs/PHONE_PROVISIONING.md` - Complete technical reference
- Edge Function logs in Supabase dashboard
- Provisioning logs in database (`provisioning_logs` table)

---

**Branch**: `claude/fix-vapi-phone-provisioning-011CUuBskTsM45rjDdCgEViu`
**Status**: Ready for review and merge
**Last updated**: 2025-11-07
