# Existing Supabase Instance Assessment Guide

## Step 1: Gather Information About Existing Instance

### A. Check Database Schema

Run this in your existing Supabase SQL Editor:

```sql
-- Get all tables in public schema
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Get detailed table structures
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- Check for existing migrations tracking
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'schema_migrations'
) as has_migrations_table;

-- If migrations table exists, check what's been applied
SELECT * FROM supabase_migrations.schema_migrations ORDER BY version;
```

### B. List All Edge Functions

Run this command locally (you'll need Supabase CLI linked to existing instance):

```bash
# First, link to your existing instance
supabase link --project-ref YOUR_EXISTING_PROJECT_REF

# List all deployed functions
supabase functions list

# OR use the Supabase API
curl https://YOUR_PROJECT.supabase.co/functions/v1/ \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### C. Check for Existing Data

```sql
-- Check row counts for critical tables
SELECT
  schemaname,
  tablename,
  n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;

-- Check auth.users
SELECT COUNT(*) as user_count FROM auth.users;

-- Check if there's production data
SELECT
  EXISTS(SELECT 1 FROM auth.users WHERE created_at < NOW() - INTERVAL '7 days') as has_old_users,
  (SELECT COUNT(*) FROM auth.users) as total_users;
```

### D. Check RLS Policies

```sql
-- List all RLS policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### E. Check Database Functions

```sql
-- List all custom functions
SELECT
  n.nspname as schema,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type
FROM pg_proc p
LEFT JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY function_name;
```

## Step 2: Compare with Your Codebase

### Tables in Your Codebase (from migrations):

1. accounts
2. profiles
3. user_roles
4. auth_tokens
5. auth_events
6. email_events
7. passkeys
8. user_sessions
9. rate_limits
10. staff_roles
11. account_members
12. account_credits
13. phone_numbers (from provisioning)
14. provisioning_queue
15. And more...

### Edge Functions in Your Codebase (37 total):

- accept-staff-invite
- authorize-call
- cleanup-database
- complete-onboarding
- create-sales-account
- create-staff-invite
- create-staff-user
- free-trial-signup
- get-available-area-codes
- handle-referral-signup
- handle-sms-inbound
- list-staff-users
- manage-phone-lifecycle
- manage-staff-role
- manage-team-member
- notify_number_ready
- provision
- provision-resources
- provision_number
- provision_number_retry
- require-step-up
- resend-webhook
- reset-monthly-usage
- search-vapi-numbers
- send-forwarding-instructions
- send-magic-link
- send-onboarding-sms
- send-password-reset
- send-sms-confirmation
- send-verification-code
- stripe-webhook
- sync-usage
- test-vapi-integration
- vapi-demo-call
- verify-code
- verify-magic-link

## Step 3: Decision Matrix

### Choose **NEW PROJECT** if:
- ✓ Existing instance has NO production data (or only test data)
- ✓ Existing schema differs significantly from your migrations
- ✓ Table structures don't match
- ✓ You want a clean, predictable migration
- ✓ Existing instance has < 10 users or test data only
- ✓ Edge functions are different or outdated

### Choose **EXISTING PROJECT** if:
- ✓ Has valuable production data (>10 active users, real transactions)
- ✓ Schema mostly matches your migrations
- ✓ You need to preserve existing user accounts
- ✓ Downtime for data migration is problematic
- ✓ Existing setup is recent and maintained

## Step 4: Hybrid Approach (RECOMMENDED if unsure)

If you're unsure, you can:
1. Create a NEW staging project to test the full migration
2. Keep existing project for production data
3. Test everything in new project first
4. Then decide:
   - Migrate data from existing → new project, OR
   - Fix existing project to match migrations

## Step 5: Assessment Checklist

Fill this out after running the queries above:

```
EXISTING INSTANCE ASSESSMENT
============================

Database Schema:
[ ] Number of tables in existing instance: _______
[ ] Number of tables in codebase migrations: 18+
[ ] Tables match: YES / NO / PARTIAL

Data Volume:
[ ] Total users in auth.users: _______
[ ] Oldest user created_at: _______
[ ] Total rows across all tables: _______
[ ] Has production data: YES / NO

Edge Functions:
[ ] Number of deployed functions: _______
[ ] Number of functions in codebase: 37
[ ] Functions match: YES / NO / PARTIAL

Migrations:
[ ] Has schema_migrations table: YES / NO
[ ] Number of applied migrations: _______
[ ] Migration versions match codebase: YES / NO

Critical Decision Factors:
[ ] Production users will be affected: YES / NO
[ ] Data loss is acceptable: YES / NO
[ ] Time to migrate data: _______ hours estimated
[ ] Schema conflicts exist: YES / NO

RECOMMENDATION: NEW PROJECT / EXISTING PROJECT / HYBRID
```

## Next Steps Based on Decision

### If NEW PROJECT:
```bash
cd /home/user/ringsnap
# Proceed with fresh migration plan
```

### If EXISTING PROJECT:
```bash
# We'll create reconciliation scripts to:
# 1. Drop conflicting tables/functions
# 2. Apply missing migrations
# 3. Deploy missing edge functions
```

### If HYBRID:
```bash
# Create new project for testing
# Export data from existing
# Import to new once validated
```
