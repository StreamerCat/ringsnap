# Database Migration Regression Report
**Date:** 2025-12-08
**Migration:** `20251208000001_fix_account_schema.sql`

## Status
- **Codebase:** Updated to use `account_members` and new `phone_numbers` fields.
- **Verification:** Static analysis & Typecheck PASSED.
- **Environment:** Local Docker unavailable; Migration and E2E tests pending deployment.

## Checklist
- [x] **Migration Created:** `20251208000001_fix_account_schema.sql`
  - Backfills missing `account_members`.
  - Adds `provider` / `provider_id` to `phone_numbers`.
  - Creates `call_logs`.
  - Drops `user_roles`.
- [x] **Code Updates:**
  - `create-trial`: Now writes to `account_members` (Role: 'owner').
  - `provision-vapi`: Writes `provider`='vapi' and `vapi_phone_id`.
  - `free-trial-signup`: Deprecated function updated to match schema.
  - Tests: Updated usage of `user_roles` to `account_members`.
- [x] **Type Safety:** `npm run typecheck` passed (Frontend/Source).
- [ ] **Deployment Needed:**
  1. Run `npx supabase migration up` (or via Dashboard).
  2. Deploy Edge Functions: `create-trial`, `provision-vapi`, `free-trial-signup`.
- [ ] **E2E Verification Needed:**
  - Run `./test_e2e_signup.sh` after deployment.

## Risk Assessment
- **High Risk:** The migration drops `user_roles`. If any code (outside of what was grepped) relies on this table, it will break.
  - *Mitigation:* Extensive grep search performed on `src` and `supabase/functions`.
- **Medium Risk:** `account_members` policies must be active for users to access data.
  - *Mitigation:* Migration ensures policies are enabled.

## Next Steps for User
1. **Apply Migration:** Execute the SQL migration on your Supabase project.
2. **Deploy Functions:** Update the edge functions on Supabase.
3. **Run Test:** Execute `./test_e2e_signup.sh` to confirm the flow works against the live environment.
