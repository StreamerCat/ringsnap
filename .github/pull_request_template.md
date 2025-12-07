# Fix: Account Creation Schema Errors

## Summary
This PR fixes all schema mismatches in the signup flow that were causing account creation and provisioning to fail.

## Problems Fixed

### 1. `create-trial` Function
- ❌ **Invalid columns in accounts insert**: `name`, `phone`, `owner_id`
- ❌ **Invalid column in profiles insert**: `role`
- ❌ **Invalid columns in provisioning_jobs insert**: `job_type`, `metadata`, `correlation_id`

### 2. `provision-vapi` Worker
- ❌ **Invalid column in query**: `retry_after`

## Changes Made

### `supabase/functions/create-trial/index.ts`
1. Removed `name` and `phone` from accounts insert (belong in profiles table)
2. Removed `owner_id` from accounts insert (column doesn't exist)
3. Removed `role` from profiles upsert, added separate `user_roles` insert
4. Removed `job_type`, `metadata`, `correlation_id` from provisioning_jobs insert

### `supabase/functions/provision-vapi/index.ts`
1. Removed `retry_after` from job query filter
2. Removed `retry_after` from failed job updates

### Frontend Changes
- Added `ProvisioningStatus.tsx` page for post-signup UX
- Updated `Dashboard.tsx` with provisioning status banner
- Modified `OnboardingChat.tsx` to redirect to status page after signup
- Updated `App.tsx` with new route

## Testing
- ✅ Account creation works
- ✅ User authentication works
- ✅ Provisioning job created successfully
- ⏳ Vapi provisioning (pending deployment)

## Deployment Notes
After merging, the GitHub Actions workflow will auto-deploy both functions.

## Related Issues
Fixes account creation errors during signup flow.
