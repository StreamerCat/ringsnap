# Fix: Invite Team/Members Flow

## Description

This PR fixes the broken "Invite team/members" functionality. Previously, the invite flow would fail if the invited user already existed in the system, or if a user was re-invited. This update ensures that existing users are correctly added to the team and prevents duplicate invites.

## Changes

### Backend

- **`supabase/functions/manage-team-member/index.ts`**:
  - Refactored `invite` action to check for existing users before attempting to create them.
  - Implemented logic to add existing users to the `account_members` table if they are not already a member.
  - Added checks to prevent re-inviting users who are already members of the team.
  - Improved logging for invite attempts.
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

## Verification

- [ ] Manual verification in Dashboard > Team > Invite Member.
- [ ] Automated tests pass (requires `SUPABASE_SERVICE_ROLE_KEY`).

## Related Issues

- Fixes "Invite team/members" function being reported as broken.
