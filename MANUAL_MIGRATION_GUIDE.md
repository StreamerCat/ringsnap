# Manual Supabase Migration Guide (No CLI Required)

## ✅ Your New Supabase Project

- **Project ID:** `rmyvvbqnccpfeyowidrq`
- **Project URL:** `https://rmyvvbqnccpfeyowidrq.supabase.co`
- **Anon Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` ✓

---

## 🎯 Migration Steps Overview

1. **Apply Database Migrations** (10 min) - Run consolidated SQL file
2. **Deploy Edge Functions** (30-45 min) - Manual deployment via dashboard
3. **Update Application Config** (5 min) - Update .env file
4. **Test & Verify** (10 min) - Confirm everything works

**Total Time: ~1 hour**

---

## Step 1: Apply Database Migrations (10 minutes)

### Option A: Use Consolidated SQL File (RECOMMENDED - Fastest)

1. **Open Supabase SQL Editor**
   - Go to: https://supabase.com/dashboard/project/rmyvvbqnccpfeyowidrq/sql/new
   - Or navigate to: Dashboard → SQL Editor → New Query

2. **Copy the Consolidated Migration**
   - Open file: `scripts/consolidated-migration.sql` (2,463 lines)
   - Select All (Ctrl+A / Cmd+A)
   - Copy (Ctrl+C / Cmd+C)

3. **Paste and Execute**
   - Paste into SQL Editor
   - Click **"Run"** button (or F5)
   - Wait ~30-60 seconds for execution

4. **Verify Success**
   - You should see "Success. No rows returned" or similar
   - Go to Dashboard → Database → Tables
   - You should see 18+ tables created:
     - accounts
     - profiles
     - user_roles
     - auth_tokens
     - auth_events
     - email_events
     - passkeys
     - user_sessions
     - rate_limits
     - staff_roles
     - account_members
     - account_credits
     - phone_numbers
     - provisioning_queue
     - And more...

### Option B: Run Migrations One-by-One (Alternative)

If the consolidated file is too large or has issues:

1. Go to SQL Editor
2. Run each migration file in `supabase/migrations/` in chronological order:
   - Start with `20251027211152_*.sql`
   - End with `20251108000003_*.sql`
3. Execute each one and verify before moving to the next

---

## Step 2: Deploy Edge Functions (30-45 minutes)

Unfortunately, edge functions cannot be deployed via SQL Editor. You have **3 options**:

### Option A: Install Supabase CLI Locally (RECOMMENDED)

If you have a local machine with npm:

```bash
# On your local machine
npm install -g supabase

# Clone/download the repository
git clone <your-repo> ringsnap
cd ringsnap

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref rmyvvbqnccpfeyowidrq

# Deploy all functions
supabase functions deploy
```

This will deploy all 37 functions in one command.

### Option B: Use GitHub Actions / CI/CD (Automated)

Create `.github/workflows/deploy-functions.yml`:

```yaml
name: Deploy Supabase Functions

on:
  push:
    branches: [main]
    paths:
      - 'supabase/functions/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1

      - name: Deploy functions
        run: |
          supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_ID }}
          supabase functions deploy
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
```

### Option C: Manual Deployment via Dashboard (Time-consuming)

For each of the 37 functions, you would need to:

1. Go to https://supabase.com/dashboard/project/rmyvvbqnccpfeyowidrq/functions
2. Click "Create Function"
3. Copy the function code from `supabase/functions/FUNCTION_NAME/index.ts`
4. Paste and save

**This is tedious for 37 functions - Options A or B are much better!**

---

## Step 3: Configure Edge Function Secrets

### Required Secrets:

You need to configure these environment variables for your edge functions:

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `SUPABASE_URL` | Your new project URL | `https://rmyvvbqnccpfeyowidrq.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key | Get from Dashboard → Settings → API |
| `STRIPE_SECRET_KEY` | Stripe API key | `sk_test_...` or `sk_live_...` |
| `STRIPE_PRICE_STARTER` | Starter plan price ID | `price_...` |
| `STRIPE_PRICE_PROFESSIONAL` | Professional plan price ID | `price_...` |
| `STRIPE_PRICE_PREMIUM` | Premium plan price ID | `price_...` |
| `VAPI_API_KEY` | VAPI API key | `sk_...` |
| `VAPI_BASE_URL` | VAPI base URL | `https://api.vapi.ai` |
| `RESEND_PROD_KEY` | Resend API key (for emails) | `re_...` |
| `TWILIO_ACCOUNT_SID` | Twilio account SID | `ACxxx...` |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | `xxx...` |
| `APP_URL` | Your application URL | `https://ringsnap.lovable.app` |
| `NOTIFY_EMAIL_FROM` | From email address | `noreply@getringsnap.com` |
| `NOTIFY_SMS_FROM` | From phone number | `+1234567890` |

### How to Set Secrets:

**Via Supabase CLI (Easiest):**
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set VAPI_API_KEY=sk_...
# ... etc for all secrets
```

**Via Dashboard:**
1. Go to https://supabase.com/dashboard/project/rmyvvbqnccpfeyowidrq/settings/functions
2. Scroll to "Edge Function Secrets"
3. Add each secret key/value pair
4. Click "Save"

---

## Step 4: Update Application Configuration (5 minutes)

### Update .env File

Replace the old Lovable Supabase credentials with your new ones:

```bash
# Old (Lovable - REMOVE)
# VITE_SUPABASE_URL="https://lytnlrkdccqmxgdmdxef.supabase.co"
# VITE_SUPABASE_PROJECT_ID="lytnlrkdccqmxgdmdxef"
# VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGci..."

# New (Your Supabase - ADD)
VITE_SUPABASE_URL="https://rmyvvbqnccpfeyowidrq.supabase.co"
VITE_SUPABASE_PROJECT_ID="rmyvvbqnccpfeyowidrq"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJteXZ2YnFuY2NwZmV5b3dpZHJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3ODQ0NjMsImV4cCI6MjA3ODM2MDQ2M30.5spxwzpTQ8k6sDnh312L1ooW2g6ILQ37KaqHYC_5-lE"

# Keep Stripe and other configs as-is
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Update supabase/config.toml

```toml
# Change from:
# project_id = "lytnlrkdccqmxgdmdxef"

# To:
project_id = "rmyvvbqnccpfeyowidrq"

# Keep all function configurations as-is
```

---

## Step 5: Test & Verify (10 minutes)

### 1. Rebuild Application
```bash
npm run build
```

### 2. Start Dev Server
```bash
npm run dev
```

### 3. Test in Browser

Open http://localhost:5173 and test:

- ✅ Page loads without errors
- ✅ Open DevTools Console - no connection errors
- ✅ Try to sign up with test email
- ✅ Check Network tab - requests go to new Supabase URL

### 4. Verify in Supabase Dashboard

**Database:**
- Go to Dashboard → Database → Tables
- Tables should be populated with test data

**Auth:**
- Go to Dashboard → Authentication → Users
- You should see test users if you signed up

**Edge Functions:**
- Go to Dashboard → Edge Functions → Logs
- Check for any errors (should be clean or empty)

**API Logs:**
- Go to Dashboard → Logs → API
- Should see requests coming in

---

## Step 6: Deploy to Production

### Update Production Environment Variables

In your hosting platform (Vercel, Netlify, etc.):

```env
VITE_SUPABASE_URL=https://rmyvvbqnccpfeyowidrq.supabase.co
VITE_SUPABASE_PROJECT_ID=rmyvvbqnccpfeyowidrq
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJteXZ2YnFuY2NwZmV5b3dpZHJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3ODQ0NjMsImV4cCI6MjA3ODM2MDQ2M30.5spxwzpTQ8k6sDnh312L1ooW2g6ILQ37KaqHYC_5-lE

# For production, also update:
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_... (production Stripe key)
```

### Update External Webhooks

Update webhook URLs in external services:

**Stripe:**
- Go to Stripe Dashboard → Developers → Webhooks
- Update webhook endpoint:
  - Old: `https://lytnlrkdccqmxgdmdxef.supabase.co/functions/v1/stripe-webhook`
  - New: `https://rmyvvbqnccpfeyowidrq.supabase.co/functions/v1/stripe-webhook`

**Twilio (if configured):**
- Update SMS webhook URLs in Twilio console

**VAPI (if configured):**
- Update webhook URLs in VAPI dashboard

---

## Troubleshooting

### "Table already exists" error
- Some migrations may have already been applied
- Check which tables exist: Dashboard → Database → Tables
- Skip migrations that create existing tables

### "Function not found" error
- Edge function not deployed
- Check: Dashboard → Edge Functions
- Deploy missing function

### "Invalid JWT" or auth errors
- Check VITE_SUPABASE_PUBLISHABLE_KEY is correct
- Verify it matches: Dashboard → Settings → API → anon public key

### "CORS error"
- Check VITE_SUPABASE_URL is correct
- Clear browser cache and local storage
- Rebuild application

### Database connection timeout
- Check database is active
- Verify network connectivity
- Check firewall rules

---

## Post-Migration Checklist

- [ ] All 18+ tables created in database
- [ ] All 37 edge functions deployed
- [ ] All secrets configured
- [ ] .env file updated
- [ ] config.toml updated
- [ ] Application builds successfully
- [ ] Local dev server works
- [ ] Test user signup works
- [ ] No console errors
- [ ] Production deployed
- [ ] Stripe webhooks updated
- [ ] External webhooks updated
- [ ] Old Lovable instance archived

---

## Getting Your Service Role Key

You'll need this for edge function secrets:

1. Go to https://supabase.com/dashboard/project/rmyvvbqnccpfeyowidrq/settings/api
2. Find "service_role" key under "Project API keys"
3. Click to reveal (⚠️ Keep this secret!)
4. Copy the key starting with `eyJhbGc...`

---

## Next Steps After Migration

1. **Monitor Performance**
   - Check Dashboard → Logs regularly
   - Set up error alerts

2. **Enable Backups** (Recommended)
   - Go to Dashboard → Database → Backups
   - Enable Point-in-Time Recovery (Pro plan)

3. **Configure Auth Providers** (if needed)
   - Dashboard → Authentication → Providers
   - Enable OAuth (Google, GitHub, etc.)

4. **Set up Storage** (if needed)
   - Dashboard → Storage
   - Create buckets for file uploads

5. **Review Security**
   - Check RLS policies: Dashboard → Database → Policies
   - Review auth settings
   - Set up rate limiting if needed

---

## Success! 🎉

Once complete, you have:
- ✅ Full control over your Supabase instance
- ✅ Access to all features and configurations
- ✅ Clean database with no legacy data
- ✅ All edge functions operational
- ✅ No vendor lock-in

Your RingSnap application is now running on your own Supabase infrastructure!
