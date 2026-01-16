# Fix: Invite Team/Members Flow

## Description

This PR fixes the broken "Invite team/members" functionality. Previously, the invite flow would fail if the invited user already existed in the system, or if a user was re-invited.

Additionally, this PR **fixes an issue where invite emails were silently failing** due to unhandled API errors and environment variable configuration issues.

## Changes

### Backend

- **`supabase/functions/manage-team-member/index.ts`**:
  - Refactored `invite` action to check for existing users before attempting to create them.
  - Implemented logic to add existing users to the `account_members` table if they are not already a member.
  - Added checks to prevent re-inviting users who are already members of the team.
  - **Email Reliability**:
    - Added robust checking for `RESEND_PROD_KEY` (and `RESEND_API_KEY` fallback).
    - Added explicit logging of email sending results (success/failure) to Supabase Logs.
    - Fixed syntax errors and import paths to ensure successful deployment.
- **`supabase/functions/_shared/email-templates.ts`**:
  - Updated `buildTeamInviteEmail` to accept an optional `tempPassword`.
  - Modified email template to display "Login with your existing account" if no temporary password is provided.

### Frontend

- **`src/components/dashboard/TeamTab.tsx`**:
  - Enhanced error handling to display specific, user-friendly messages (e.g., "This user is already a member of the team").

### Tests

- Added `tests/invite_member.test.ts` to verify:
  - Inviting a completely new user.
  - Inviting an existing user (should bind to team).
  - Inviting a user already in the team (should fail gracefully).

## Deployment Notes

- This PR includes changes to the `manage-team-member` Edge Function.
- **Action Required**: The function must be deployed for changes to take effect.

  ```bash
  npx supabase functions deploy manage-team-member
  ```

## Verification

- [ ] Manual verification in Dashboard > Team > Invite Member.
- [ ] Verify email is received (check Spam).
- [ ] Verify logs in Supabase Dashboard show "Team invite email sent successfully".
