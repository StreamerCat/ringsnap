# Supabase Security Advisor Fixes

## Summary

This PR addresses all findings from the Supabase Security Advisor without breaking signup flows, provisioning, or webhook handling.

### Changes

1. **Fix SECURITY DEFINER views** - Replace direct view access with secure RPC functions that check authorization
2. **Enable RLS on 8 tables** - Add row-level security with appropriate policies
3. **Fix function search_path** - Set search_path on all SECURITY DEFINER functions to prevent injection
4. **Tighten permissive policies** - Fix overly permissive policies on call_webhook_inbox and revenue_report_leads

---

## Migration Details

### Migration 1: Fix SECURITY DEFINER views (20260107000001)

**Problem:** Views with SECURITY DEFINER allowed any authenticated user to access admin data.

**Solution:**
- Created RPC functions with explicit authorization checks for admin views:
  - `rpc_admin_provisioning_status_counts()`
  - `rpc_admin_provisioning_failures()`
  - `rpc_admin_daily_call_stats()`
  - `rpc_admin_edge_function_error_feed()`
  - `rpc_admin_flagged_accounts()`
- Created account-scoped RPC functions for operator views:
  - `rpc_operator_dashboard_summary(_account_id)`
  - `rpc_daily_account_usage(_account_id)`
  - `rpc_account_service_hours(_account_id)`
  - `rpc_phone_number_identity(_vapi_phone_id)`
- Revoked direct SELECT on views from `authenticated` role
- Added `is_platform_staff()` helper function

**UI Updates Required:**
- `src/pages/AdminMonitoring.tsx` - Updated to use RPC functions instead of direct view queries
- `src/components/dashboard/OperatorOverview.tsx` - Updated to use RPC function

### Migration 2: Enable RLS on 8 tables (20260107000002)

**Problem:** These tables had RLS disabled:
- `provisioning_state_transitions` - Service role only
- `voice_library` - Read-only reference data
- `vapi_assistants` - Account-scoped + service role
- `vapi_numbers` - Account-scoped + service role
- `provisioning_jobs` - Account-scoped + service role
- `call_outcome_events` - Account-scoped
- `signup_leads` - User's own + service role
- `staff_roles` - User's own + admin read all

**Solution:** Enabled RLS and added appropriate policies for each table based on access patterns discovered in audit.

### Migration 3: Fix function search_path (20260107000003)

**Problem:** SECURITY DEFINER functions without explicit search_path are vulnerable to search_path injection attacks.

**Solution:** Set `search_path = public` on all SECURITY DEFINER functions, including a batch update for any we may have missed.

### Migration 4: Tighten permissive policies (20260107000004)

**Problem:**
1. `call_webhook_inbox` policy "Service role full access" was FOR ALL with true/true (applies to all roles)
2. `revenue_report_leads` policy allows anon INSERT with no validation

**Solution:**
1. Removed redundant policy (service role bypasses RLS anyway), added explicit admin-read-only policy
2. Added table constraints for validation (length limits, email format, numeric bounds)

---

## Access Matrix

| Object | Access Path | Notes |
|--------|-------------|-------|
| provisioning_state_transitions | Service role only | Audit logging from edge functions |
| voice_library | Authenticated read | Reference table |
| vapi_assistants | Service role + account read | Provisioning |
| vapi_numbers | Service role + account read | Provisioning |
| provisioning_jobs | Service role + account read | Provisioning queue |
| call_outcome_events | Account-scoped | Call outcomes |
| signup_leads | User's own + service role | Onboarding |
| staff_roles | User's own + admin view all | Auth checks |
| admin_* views | Revoked - use RPC | Admin dashboards |
| operator_* views | Revoked - use RPC | Operator dashboards |
| call_webhook_inbox | Service role + admin read | Webhook dead letter |
| revenue_report_leads | Anon insert + admin read | Lead capture |

---

## Smoke Test Checklist

### Pre-deployment Testing

Run these tests before deploying to production:

#### 1. Trial Signup Flow
- [ ] Navigate to signup page
- [ ] Complete signup form with valid email
- [ ] Verify email verification sent
- [ ] Complete email verification
- [ ] Confirm `accounts` row created
- [ ] Confirm `profiles` row created
- [ ] Confirm `provisioning_jobs` row created with status 'pending'

#### 2. Provisioning Flow
- [ ] Confirm provisioning job transitions to 'in_progress'
- [ ] Verify Twilio phone number provisioned
- [ ] Verify Vapi assistant created
- [ ] Verify Vapi phone number linked
- [ ] Confirm provisioning status becomes 'provisioned'
- [ ] Check `provisioning_state_transitions` has audit entries (via service role)

#### 3. Admin Dashboard Access
- [ ] Login as platform_owner user
- [ ] Navigate to /admin/monitoring
- [ ] Verify provisioning status counts load (uses rpc_admin_provisioning_status_counts)
- [ ] Verify daily call stats load (uses rpc_admin_daily_call_stats)
- [ ] Verify flagged accounts load (uses rpc_admin_flagged_accounts)
- [ ] Verify edge function errors load (uses rpc_admin_edge_function_error_feed)

#### 4. Operator Dashboard Access
- [ ] Login as regular account user
- [ ] Navigate to operator dashboard
- [ ] Verify dashboard summary loads (uses rpc_operator_dashboard_summary)
- [ ] Verify calls today data loads

#### 5. Non-Admin Access Denied
- [ ] Login as regular account user (not platform_owner/platform_admin)
- [ ] Attempt to call admin RPC functions directly
- [ ] Verify "Unauthorized" error returned
- [ ] Verify cannot SELECT from admin_* views directly

#### 6. Webhook Processing
- [ ] Trigger test webhook from Vapi
- [ ] Verify call_logs entry created
- [ ] Verify customer_leads entry created (if applicable)
- [ ] If webhook fails, verify call_webhook_inbox entry created

#### 7. Lead Capture
- [ ] Navigate to revenue calculator page (public)
- [ ] Submit form with valid data
- [ ] Verify revenue_report_leads entry created
- [ ] Test with invalid email format - should be rejected
- [ ] Test with excessively long name - should be rejected

#### 8. Staff Role Checks
- [ ] Verify staff can read their own role from staff_roles
- [ ] Verify platform_admin can read all staff_roles
- [ ] Verify regular users cannot modify staff_roles

---

## Notes for Josh

### Dashboard Setting Required

The Security Advisor flagged "Leaked password protection disabled". This is a Supabase Dashboard setting:

1. Go to Supabase Dashboard
2. Navigate to Authentication > Settings
3. Enable "Leaked password protection"

This checks passwords against known breached databases during signup/password changes.

### Potential Breaking Changes

None expected. All changes are:
- Additive (new RPC functions)
- More restrictive (RLS policies deny by default)
- Backwards compatible (service role bypasses RLS)

### Coordinated Frontend Changes

The following files were updated to use RPC functions instead of direct view access:
- `src/pages/AdminMonitoring.tsx` - All admin queries now use `rpc_admin_*` functions
- `src/components/dashboard/OperatorOverview.tsx` - Uses `rpc_operator_dashboard_summary`

### Rollback Plan

If issues occur:
1. The migrations are reversible - views still exist with service_role access
2. To restore authenticated access to views: `GRANT SELECT ON view_name TO authenticated`
3. To disable RLS on a table: `ALTER TABLE table_name DISABLE ROW LEVEL SECURITY`

However, rolling back would re-expose the security vulnerabilities.

### What Will NOT Break

- Trial signup (uses service role via edge functions)
- Stripe subscription creation (uses service role)
- Provisioning jobs (uses service role)
- Call webhooks (uses service role)
- Revenue calculator leads (anon INSERT still allowed with validation)

---

## Files Changed

### Migrations (new)
- `supabase/migrations/20260107000001_fix_security_definer_views.sql`
- `supabase/migrations/20260107000002_enable_rls_security_tables.sql`
- `supabase/migrations/20260107000003_fix_function_search_path.sql`
- `supabase/migrations/20260107000004_tighten_permissive_policies.sql`

### Frontend (updated)
- `src/pages/AdminMonitoring.tsx` - Use RPC functions
- `src/components/dashboard/OperatorOverview.tsx` - Use RPC function
