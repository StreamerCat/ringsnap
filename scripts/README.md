# Migration Scripts

This directory contains automated scripts to help you migrate from Lovable.ai's managed Supabase to your own Supabase instance.

## Quick Start

Run these scripts in order:

```bash
# 1. Set up and link to new Supabase project
./scripts/setup-new-supabase.sh

# 2. Apply all database migrations
./scripts/migrate-schema.sh

# 3. Configure edge function secrets
./scripts/configure-secrets.sh

# 4. Deploy all edge functions
./scripts/deploy-functions.sh

# 5. Update your .env file
./scripts/update-env.sh
```

## Scripts Overview

### 1. `setup-new-supabase.sh`
**Purpose:** Initialize connection to your new Supabase project

**What it does:**
- Checks if Supabase CLI is installed
- Logs you into Supabase
- Links your local project to the new remote instance
- Verifies connection

**Prerequisites:**
- Supabase CLI installed (`npm install -g supabase`)
- New Supabase project created at https://supabase.com/dashboard

**Usage:**
```bash
./scripts/setup-new-supabase.sh
```

---

### 2. `migrate-schema.sh`
**Purpose:** Apply all database migrations to your new instance

**What it does:**
- Lists all migration files (18+ SQL files)
- Pushes migrations to remote database
- Creates all tables, functions, triggers, and RLS policies
- Verifies migrations were applied successfully

**Prerequisites:**
- Project must be linked (run `setup-new-supabase.sh` first)

**Usage:**
```bash
./scripts/migrate-schema.sh
```

**Tables created:**
- accounts, profiles, user_roles
- auth_tokens, auth_events, email_events
- passkeys, user_sessions, rate_limits
- staff_roles, account_members, account_credits
- phone_numbers, provisioning_queue
- And more...

---

### 3. `configure-secrets.sh`
**Purpose:** Set up environment variables for edge functions

**What it does:**
- Guides you through configuring all required secrets
- Supports interactive mode or loading from .env file
- Sets secrets in Supabase for edge functions to use

**Prerequisites:**
- Project must be linked

**Required secrets:**
- `SUPABASE_URL` - Your new Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (from Supabase dashboard)
- `STRIPE_SECRET_KEY` - Stripe API key
- `STRIPE_PRICE_STARTER/PROFESSIONAL/PREMIUM` - Stripe price IDs
- `VAPI_API_KEY` - VAPI API key
- `VAPI_BASE_URL` - VAPI base URL (default: https://api.vapi.ai)
- `RESEND_PROD_KEY` or `SENDGRID_API_KEY` - Email provider
- `TWILIO_ACCOUNT_SID` - Twilio account SID
- `TWILIO_AUTH_TOKEN` - Twilio auth token
- `APP_URL` - Your application URL
- `NOTIFY_EMAIL_FROM` - From email address
- `NOTIFY_SMS_FROM` - From phone number

**Usage:**
```bash
# Interactive mode
./scripts/configure-secrets.sh

# Or load from file
# 1. Create .env.secrets with your values
# 2. Run script and choose option 2
```

---

### 4. `deploy-functions.sh`
**Purpose:** Deploy all 37 edge functions to your new instance

**What it does:**
- Checks that secrets are configured
- Deploys all edge functions from `supabase/functions/`
- Verifies deployments
- Lists all deployed functions

**Prerequisites:**
- Project must be linked
- Secrets must be configured (run `configure-secrets.sh` first)

**Functions deployed (37 total):**

**Authentication:**
- send-magic-link, verify-magic-link
- send-verification-code, verify-code
- send-password-reset, require-step-up

**Onboarding:**
- free-trial-signup, complete-onboarding
- handle-referral-signup

**Staff Management:**
- create-staff-user, create-staff-invite
- accept-staff-invite, list-staff-users
- manage-staff-role, manage-team-member

**Phone Provisioning:**
- provision, provision-resources
- provision_number, provision_number_retry
- notify_number_ready, manage-phone-lifecycle
- get-available-area-codes, search-vapi-numbers

**VAPI Integration:**
- authorize-call, vapi-demo-call
- test-vapi-integration

**Communication:**
- handle-sms-inbound, send-sms-confirmation
- send-onboarding-sms, send-forwarding-instructions

**Webhooks:**
- stripe-webhook, resend-webhook

**Sales & Billing:**
- create-sales-account, sync-usage
- reset-monthly-usage

**Maintenance:**
- cleanup-database

**Usage:**
```bash
./scripts/deploy-functions.sh
```

---

### 5. `update-env.sh`
**Purpose:** Update your local .env file with new Supabase credentials

**What it does:**
- Creates backup of current .env file
- Updates Supabase URL, project ID, and anon key
- Updates supabase/config.toml
- Provides instructions for rebuilding app

**Prerequisites:**
- New Supabase project credentials ready

**Usage:**
```bash
./scripts/update-env.sh
```

You'll need:
- `VITE_SUPABASE_URL` - From Supabase dashboard → Settings → API
- `VITE_SUPABASE_PROJECT_ID` - The subdomain of your project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - The anon/public key from dashboard

---

## Assessment Scripts

### `check-existing-instance.ts`
**Purpose:** Analyze an existing Supabase instance to decide migration strategy

**Usage:**
```bash
export EXISTING_SUPABASE_URL="https://xxxxx.supabase.co"
export EXISTING_SUPABASE_SERVICE_KEY="eyJhbGc..."
npx tsx scripts/check-existing-instance.ts
```

### `compare-schemas.sql`
**Purpose:** SQL queries to compare existing schema with expected schema

**Usage:**
Run queries in Supabase SQL Editor to compare schemas.

---

## Troubleshooting

### "Supabase CLI not found"
**Solution:**
```bash
npm install -g supabase
# or
brew install supabase/tap/supabase
```

### "Project not linked"
**Solution:**
```bash
./scripts/setup-new-supabase.sh
```

### "Migration failed"
**Solution:**
1. Check database password is correct
2. Verify you have admin access
3. Check Supabase dashboard for errors
4. Try: `supabase migration list` to see which migrations applied

### "Function deployment failed"
**Solution:**
1. Ensure all secrets are configured: `supabase secrets list`
2. Check function logs: `supabase functions logs FUNCTION_NAME`
3. Verify you have correct permissions
4. Try deploying one function at a time to identify the issue

### "Permission denied" when running scripts
**Solution:**
```bash
chmod +x scripts/*.sh
```

---

## Complete Migration Workflow

```bash
# Step 1: Create new Supabase project at https://supabase.com/dashboard
# Step 2: Run migration scripts

# Initialize
./scripts/setup-new-supabase.sh

# Apply schema
./scripts/migrate-schema.sh

# Configure secrets
./scripts/configure-secrets.sh

# Deploy functions
./scripts/deploy-functions.sh

# Update local config
./scripts/update-env.sh

# Rebuild and test
npm run build
npm run dev

# Deploy to production
# (Update env vars in your hosting platform)
```

---

## Post-Migration Checklist

After running all scripts:

- [ ] All migrations applied (check with `supabase migration list`)
- [ ] All 37 functions deployed (check with `supabase functions list`)
- [ ] All secrets configured (check with `supabase secrets list`)
- [ ] .env file updated with new credentials
- [ ] Application builds successfully (`npm run build`)
- [ ] Test signup flow works
- [ ] Test authentication works
- [ ] Edge functions responding (check logs in dashboard)
- [ ] No console errors in browser
- [ ] Production environment updated

---

## Getting Help

- **Supabase Docs:** https://supabase.com/docs
- **CLI Reference:** https://supabase.com/docs/reference/cli
- **Full Migration Guide:** See `MIGRATION_GUIDE.md` in project root

---

## Safety Notes

- 🔒 **Never commit secrets** - Keep `.env.secrets` in `.gitignore`
- 💾 **Backups are automatic** - Scripts create `.backup` files
- ⚠️ **Test first** - Run on staging before production
- 🔄 **Rollback ready** - Keep old credentials until migration verified
