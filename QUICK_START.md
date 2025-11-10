# 🚀 Quick Start: 3-Step Migration

Your Supabase instance is configured and ready! Follow these 3 simple steps:

---

## ✅ Already Done For You:

- ✅ New Supabase project created (`rmyvvbqnccpfeyowidrq`)
- ✅ `.env` file updated with new credentials
- ✅ `config.toml` updated with new project ID
- ✅ Consolidated migration SQL file generated (2,463 lines)
- ✅ API keys collected and ready
- ✅ All configuration files prepared

---

## 🎯 Step 1: Apply Database Schema (5 minutes)

### Option A: SQL Editor (Easiest - No Password Needed)

1. **Open Supabase SQL Editor:**
   - Go to: https://supabase.com/dashboard/project/rmyvvbqnccpfeyowidrq/sql/new

2. **Open the migration file:**
   - File: `scripts/consolidated-migration.sql`
   - Open it in your text editor

3. **Copy & Paste:**
   - Select All (Ctrl+A / Cmd+A)
   - Copy (Ctrl+C / Cmd+C)
   - Paste into Supabase SQL Editor
   - Click **"Run"** button (or press F5)

4. **Wait ~30-60 seconds**

5. **Verify:**
   - Go to: Dashboard → Database → Tables
   - You should see 18+ tables created

**✅ That's it for the database!**

---

### Option B: Automated with Password

If you have your database password:

```bash
./scripts/complete-migration.sh
```

This will:
- Connect directly to PostgreSQL
- Apply all migrations automatically
- Verify tables created
- Save secrets configuration

---

## 🎯 Step 2: Deploy Edge Functions (10 minutes)

### On Your Local Machine (Recommended)

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
cd ringsnap
supabase link --project-ref rmyvvbqnccpfeyowidrq

# Configure secrets
supabase secrets set SUPABASE_URL="https://rmyvvbqnccpfeyowidrq.supabase.co"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJteXZ2YnFuY2NwZmV5b3dpZHJxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjc4NDQ2MywiZXhwIjoyMDc4MzYwNDYzfQ.js8G1sw5IDjeO1QuYpx8y-FGuMd1Udzen9Gwpkl-HDo"
supabase secrets set STRIPE_SECRET_KEY="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"
supabase secrets set STRIPE_PRICE_STARTER="price_1SMav5IdevV48BnpEEIRKvk5"
supabase secrets set STRIPE_PRICE_PROFESSIONAL="price_1SMaw9IdevV48BnpJkUs1UY0"
supabase secrets set STRIPE_PRICE_PREMIUM="price_1SMawyIdevV48BnpM9r2mk2g"
supabase secrets set VAPI_API_KEY="d381d067-abc9-41f7-a695-df5ec29ecb86"
supabase secrets set VAPI_BASE_URL="https://api.vapi.ai"
supabase secrets set RESEND_PROD_KEY="re_WMpZGcuY_PEHTgpxGQAVDfW7WoPvmn2VC"
supabase secrets set APP_URL="https://ringsnap.lovable.app"
supabase secrets set NOTIFY_EMAIL_FROM="noreply@getringsnap.com"

# Deploy all 37 functions
supabase functions deploy
```

**That's it!** All functions will deploy in ~2-3 minutes.

---

## 🎯 Step 3: Test Application (5 minutes)

```bash
# Rebuild application
npm run build

# Start dev server
npm run dev
```

Open http://localhost:5173 and test:
- ✅ Page loads without errors
- ✅ No console errors
- ✅ Try signing up with test email
- ✅ Check that requests go to new Supabase URL

---

## 🎉 Done!

Your RingSnap application is now running on your own Supabase instance!

### What You Have Now:

- ✅ Full control over database
- ✅ Access to all Supabase features
- ✅ No vendor lock-in
- ✅ Clean database (no old data)
- ✅ All 37 edge functions ready to deploy
- ✅ Complete schema with RLS policies

---

## 📊 Migration Status

### ✅ Completed:
- Project configuration
- Environment variables
- Migration files prepared
- Secrets configured

### ⏳ To Do:
1. Apply database schema (Step 1 above)
2. Deploy edge functions (Step 2 above)
3. Test application (Step 3 above)

---

## 🔧 Troubleshooting

### "No tables found"
- Make sure you completed Step 1 (Apply Database Schema)
- Check SQL Editor for errors

### "Function not found" errors
- Complete Step 2 (Deploy Edge Functions)
- Check: https://supabase.com/dashboard/project/rmyvvbqnccpfeyowidrq/functions

### "Auth errors" or "Invalid JWT"
- Verify `.env` has correct `VITE_SUPABASE_PUBLISHABLE_KEY`
- Clear browser local storage
- Rebuild: `npm run build`

---

## 📚 Full Documentation

- **Detailed Guide:** `MANUAL_MIGRATION_GUIDE.md`
- **CLI Migration:** `MIGRATION_GUIDE.md`
- **Scripts README:** `scripts/README.md`

---

## 🆘 Need Help?

1. Check the detailed guides above
2. Review Supabase docs: https://supabase.com/docs
3. Check dashboard logs for errors

---

**Ready to start? Go to Step 1 above! ☝️**
