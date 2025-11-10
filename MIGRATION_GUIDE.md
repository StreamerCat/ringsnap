# RingSnap Supabase Migration Guide

## Overview
This guide walks you through migrating from Lovable.ai's managed Supabase to your own Supabase instance.

**What we're migrating:**
- ✅ Complete database schema (18+ migrations)
- ✅ All 37 edge functions
- ✅ RLS policies and security rules
- ✅ Custom database functions and triggers

**What we're NOT migrating:**
- ❌ User data (starting fresh)
- ❌ Production data (clean slate)

**Estimated Time:** 2-3 hours

---

## Phase 1: Create New Supabase Project (10 minutes)

### Step 1: Create Project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **"New Project"**
3. Fill in details:
   - **Name:** `RingSnap` (or your preferred name)
   - **Database Password:** Generate a strong password (save this!)
   - **Region:** Choose closest to your users (e.g., `us-east-1`)
   - **Pricing Plan:** Free tier is fine to start

4. Click **"Create new project"**
5. Wait ~2 minutes for provisioning

### Step 2: Gather Credentials

Once your project is ready, go to **Project Settings > API**:

1. **Project URL:** `https://xxxxxxxxxxxxx.supabase.co`
2. **Project Reference ID:** The subdomain (e.g., `xxxxxxxxxxxxx`)
3. **anon/public key:** Copy the `anon public` key
4. **service_role key:** Copy the `service_role` key (⚠️ Keep secret!)

**Save these in a secure location - you'll need them soon!**

---

## Phase 2: Install Supabase CLI (5 minutes)

### Option A: Using npm (Recommended)
```bash
npm install -g supabase
```

### Option B: Using Homebrew (macOS)
```bash
brew install supabase/tap/supabase
```

### Option C: Using Scoop (Windows)
```bash
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

### Verify Installation
```bash
supabase --version
# Should output: supabase 1.x.x
```

---

## Phase 3: Link Project (5 minutes)

### Step 1: Login to Supabase
```bash
supabase login
```
This will open a browser window to authenticate.

### Step 2: Link Your Project
```bash
cd /home/user/ringsnap

# Link to your new project
supabase link --project-ref YOUR_PROJECT_REF

# Example:
# supabase link --project-ref abcdefghijklmnop
```

When prompted:
- **Enter database password:** Use the password you created earlier

### Step 3: Verify Link
```bash
supabase status
```
You should see your project details.

---

## Phase 4: Apply Database Migrations (15 minutes)

### Step 1: Review Migrations
```bash
ls -l supabase/migrations/
```

You should see 18+ migration files in chronological order.

### Step 2: Apply All Migrations
```bash
# Push all migrations to your new instance
supabase db push
```

This will:
- Upload all SQL migration files
- Execute them in order
- Create all tables, functions, triggers, and policies

### Step 3: Verify Schema
```bash
# Check applied migrations
supabase migration list

# Or check via SQL
supabase db execute --query "
SELECT * FROM supabase_migrations.schema_migrations
ORDER BY version;
"
```

### Expected Tables Created:
- `accounts` - Company/organization data
- `profiles` - User profiles
- `user_roles` - Role assignments
- `auth_tokens` - Magic links, invites
- `auth_events` - Security audit log
- `email_events` - Email tracking
- `passkeys` - WebAuthn credentials
- `user_sessions` - Session management
- `rate_limits` - Abuse prevention
- `staff_roles` - Staff permissions
- `account_members` - Team members
- `account_credits` - Billing credits
- `phone_numbers` - VAPI phone numbers
- `provisioning_queue` - Phone provisioning
- Plus more...

---

## Phase 5: Configure Edge Function Secrets (20 minutes)

### Step 1: Prepare Your Environment Variables

Create a file `supabase/.env.secrets` (⚠️ DO NOT COMMIT THIS):

```env
# Supabase (from your new project)
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PROFESSIONAL=price_...
STRIPE_PRICE_PREMIUM=price_...

# VAPI Configuration
VAPI_API_KEY=sk_...
VAPI_BASE_URL=https://api.vapi.ai

# Email Provider (Choose one)
# Option 1: Resend (recommended)
RESEND_PROD_KEY=re_...

# Option 2: SendGrid
# SENDGRID_API_KEY=SG.xxx...

# Twilio SMS (for onboarding)
TWILIO_ACCOUNT_SID=ACxxx...
TWILIO_AUTH_TOKEN=xxx...

# Application URLs
APP_URL=https://ringsnap.lovable.app
NOTIFY_EMAIL_FROM=noreply@getringsnap.com
NOTIFY_SMS_FROM=+1234567890

# Optional: Webhooks
# NOTIFY_WEBHOOK_URL=https://your-api.com/webhooks/phone-ready
```

### Step 2: Set Secrets in Supabase

```bash
# Set secrets one by one
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_PRICE_STARTER=price_...
supabase secrets set STRIPE_PRICE_PROFESSIONAL=price_...
supabase secrets set STRIPE_PRICE_PREMIUM=price_...
supabase secrets set VAPI_API_KEY=sk_...
supabase secrets set VAPI_BASE_URL=https://api.vapi.ai
supabase secrets set RESEND_PROD_KEY=re_...
supabase secrets set TWILIO_ACCOUNT_SID=ACxxx...
supabase secrets set TWILIO_AUTH_TOKEN=xxx...
supabase secrets set APP_URL=https://ringsnap.lovable.app
supabase secrets set NOTIFY_EMAIL_FROM=noreply@getringsnap.com
supabase secrets set NOTIFY_SMS_FROM=+1234567890

# For production deployments, also set:
supabase secrets set SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

### Step 3: Verify Secrets
```bash
supabase secrets list
```

---

## Phase 6: Deploy Edge Functions (30 minutes)

### Overview
You have 37 edge functions to deploy. We'll deploy them all at once.

### Step 1: Review Functions
```bash
ls -1 supabase/functions/
```

### Step 2: Deploy All Functions

**Option A: Deploy All at Once (Recommended)**
```bash
supabase functions deploy
```

This will deploy all 37 functions in one command.

**Option B: Deploy Individually (if needed)**
```bash
# Core authentication
supabase functions deploy send-magic-link
supabase functions deploy verify-magic-link
supabase functions deploy send-verification-code
supabase functions deploy verify-code
supabase functions deploy send-password-reset
supabase functions deploy require-step-up

# Onboarding & Signup
supabase functions deploy free-trial-signup
supabase functions deploy complete-onboarding
supabase functions deploy send-onboarding-sms
supabase functions deploy send-sms-confirmation
supabase functions deploy handle-referral-signup

# Staff Management
supabase functions deploy create-staff-user
supabase functions deploy create-staff-invite
supabase functions deploy accept-staff-invite
supabase functions deploy list-staff-users
supabase functions deploy manage-staff-role
supabase functions deploy manage-team-member

# Phone Provisioning
supabase functions deploy provision
supabase functions deploy provision-resources
supabase functions deploy provision_number
supabase functions deploy provision_number_retry
supabase functions deploy notify_number_ready
supabase functions deploy manage-phone-lifecycle
supabase functions deploy get-available-area-codes
supabase functions deploy search-vapi-numbers

# VAPI Integration
supabase functions deploy authorize-call
supabase functions deploy vapi-demo-call
supabase functions deploy test-vapi-integration

# Communication
supabase functions deploy handle-sms-inbound
supabase functions deploy send-forwarding-instructions

# Webhooks
supabase functions deploy stripe-webhook
supabase functions deploy resend-webhook

# Sales & Accounts
supabase functions deploy create-sales-account

# Billing & Usage
supabase functions deploy sync-usage
supabase functions deploy reset-monthly-usage

# Maintenance
supabase functions deploy cleanup-database
```

### Step 3: Verify Deployments
```bash
supabase functions list
```

You should see all 37 functions listed with status `ACTIVE`.

### Step 4: Test a Function
```bash
# Test a simple function
curl -i --location --request POST 'https://xxxxxxxxxxxxx.supabase.co/functions/v1/get-available-area-codes' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"zipCode":"10001"}'
```

---

## Phase 7: Update Application Configuration (10 minutes)

### Step 1: Update Environment Variables

Edit your `.env` file:

```bash
# Old Lovable.ai values (REMOVE)
# VITE_SUPABASE_URL="https://lytnlrkdccqmxgdmdxef.supabase.co"
# VITE_SUPABASE_PROJECT_ID="lytnlrkdccqmxgdmdxef"
# VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGc..."

# New Supabase values (ADD)
VITE_SUPABASE_URL="https://xxxxxxxxxxxxx.supabase.co"
VITE_SUPABASE_PROJECT_ID="xxxxxxxxxxxxx"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Stripe (keep existing)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Step 2: Update Supabase Config

Edit `supabase/config.toml`:

```toml
# Change from:
# project_id = "lytnlrkdccqmxgdmdxef"

# To:
project_id = "xxxxxxxxxxxxx"

# Keep all function configurations as-is
```

### Step 3: Update Client Configuration (if needed)

The file `src/integrations/supabase/client.ts` should automatically pick up the new env vars, but verify:

```typescript
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
```

---

## Phase 8: Test & Verify (30 minutes)

### Step 1: Rebuild Application
```bash
npm run build
```

### Step 2: Start Dev Server
```bash
npm run dev
```

### Step 3: Test Core Functionality

#### A. Database Connection
Open browser console and test:
```javascript
// In browser console
const { data, error } = await supabase.from('accounts').select('count')
// Should return count: 0 (no errors)
```

#### B. Authentication Flow
1. Try to sign up with test email
2. Check if magic link function triggers
3. Verify no errors in Network tab

#### C. Edge Functions
Check Supabase dashboard > Edge Functions > Logs for any errors

### Step 4: Verify in Supabase Dashboard

1. **Database**
   - Go to Database > Tables
   - Verify all tables exist
   - Check RLS policies are enabled

2. **Edge Functions**
   - Go to Edge Functions
   - Verify 37 functions are deployed
   - Check recent logs for errors

3. **Authentication**
   - Go to Authentication > Users
   - Should be empty (fresh start)
   - Settings should be configured

---

## Phase 9: Production Deployment

### Update Production Environment

If deploying to Vercel/Netlify/etc:

1. Update environment variables in your hosting platform:
   ```
   VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
   VITE_SUPABASE_PROJECT_ID=xxxxxxxxxxxxx
   VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGc...
   VITE_STRIPE_PUBLISHABLE_KEY=pk_live_... (for production)
   ```

2. Redeploy application

3. Monitor for errors

---

## Troubleshooting

### Issue: Migration fails with "table already exists"
**Solution:** Your migrations might be partially applied. Check which migrations are applied:
```bash
supabase migration list
```

### Issue: Edge function deployment fails
**Solution:** Check function logs:
```bash
supabase functions logs FUNCTION_NAME
```

### Issue: "Failed to fetch" errors in app
**Solution:**
1. Verify VITE_SUPABASE_URL is correct
2. Check browser console for CORS errors
3. Verify anon key is correct

### Issue: "JWT expired" or auth errors
**Solution:**
1. Check that service_role key is set correctly in secrets
2. Verify anon key in .env file
3. Clear browser local storage and try again

### Issue: Stripe webhooks not working
**Solution:**
1. Update webhook URL in Stripe dashboard to point to new Supabase instance
2. New URL format: `https://xxxxxxxxxxxxx.supabase.co/functions/v1/stripe-webhook`

---

## Post-Migration Checklist

- [ ] All 18+ migrations applied successfully
- [ ] All 37 edge functions deployed
- [ ] All secrets configured
- [ ] Application .env updated
- [ ] Test signup flow works
- [ ] Test authentication works
- [ ] Edge functions responding
- [ ] No console errors
- [ ] RLS policies working
- [ ] Stripe test payment works
- [ ] VAPI integration works (if applicable)
- [ ] SMS/Email sending works
- [ ] Production environment updated
- [ ] Old Lovable instance documented (for reference)

---

## Rollback Plan (Just in Case)

If anything goes wrong, you can quickly rollback:

1. Change `.env` back to Lovable credentials:
   ```env
   VITE_SUPABASE_URL="https://lytnlrkdccqmxgdmdxef.supabase.co"
   VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGc..."
   ```

2. Rebuild and redeploy

3. Debug issue in new instance without affecting users

---

## Next Steps After Migration

1. **Configure Auth Providers** (if needed)
   - Email (already configured)
   - OAuth (Google, GitHub, etc.)

2. **Set up Backups**
   - Enable Point-in-Time Recovery (PITR) for Pro plan
   - Schedule regular database backups

3. **Configure Storage** (if needed)
   - Create storage buckets for user uploads
   - Configure RLS policies for storage

4. **Set up Monitoring**
   - Enable Supabase logs
   - Set up error alerting

5. **Update External Services**
   - Stripe webhook URLs
   - VAPI webhooks
   - Twilio webhooks
   - Any other external integrations

---

## Support & Resources

- **Supabase Docs:** https://supabase.com/docs
- **Supabase CLI Reference:** https://supabase.com/docs/reference/cli
- **Edge Functions Guide:** https://supabase.com/docs/guides/functions
- **Database Migrations:** https://supabase.com/docs/guides/cli/local-development#database-migrations

---

## Success! 🎉

Once completed, you now have:
- ✅ Full control over your Supabase instance
- ✅ Access to service role keys
- ✅ Direct SQL access when needed
- ✅ No vendor lock-in
- ✅ Clean, fresh database
- ✅ All edge functions deployed
- ✅ Better scalability options

Your RingSnap application is now running on your own managed infrastructure!
