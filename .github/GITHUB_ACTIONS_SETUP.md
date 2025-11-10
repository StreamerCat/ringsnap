# GitHub Actions Setup for Supabase Function Deployment

This guide walks you through setting up automated Supabase function deployment via GitHub Actions.

---

## 📋 Prerequisites

1. Your code is pushed to GitHub
2. You have admin access to the GitHub repository

---

## 🔑 Step 1: Get Supabase Access Token

1. Go to: https://supabase.com/dashboard/account/tokens
2. Click **"Generate New Token"**
3. Give it a name (e.g., "GitHub Actions")
4. Copy the token (starts with `sbp_...`)
5. **Save this token** - you'll need it in the next step

---

## ⚙️ Step 2: Configure GitHub Secrets

1. Go to your GitHub repository: https://github.com/YOUR_USERNAME/ringsnap
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"** and add each of these:

### Required Secrets:

| Secret Name | Value |
|-------------|-------|
| `SUPABASE_ACCESS_TOKEN` | `sbp_...` (from Step 1) |
| `SUPABASE_PROJECT_REF` | `rmyvvbqnccpfeyowidrq` |
| `SUPABASE_DB_PASSWORD` | Your database password (from project creation) |
| `SUPABASE_URL` | `https://rmyvvbqnccpfeyowidrq.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJteXZ2YnFuY2NwZmV5b3dpZHJxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjc4NDQ2MywiZXhwIjoyMDc4MzYwNDYzfQ.js8G1sw5IDjeO1QuYpx8y-FGuMd1Udzen9Gwpkl-HDo` |
| `STRIPE_SECRET_KEY` | `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` |
| `STRIPE_PRICE_STARTER` | `price_1SMav5IdevV48BnpEEIRKvk5` |
| `STRIPE_PRICE_PROFESSIONAL` | `price_1SMaw9IdevV48BnpJkUs1UY0` |
| `STRIPE_PRICE_PREMIUM` | `price_1SMawyIdevV48BnpM9r2mk2g` |
| `VAPI_API_KEY` | `d381d067-abc9-41f7-a695-df5ec29ecb86` |
| `VAPI_BASE_URL` | `https://api.vapi.ai` |
| `RESEND_PROD_KEY` | `re_WMpZGcuY_PEHTgpxGQAVDfW7WoPvmn2VC` |
| `APP_URL` | `https://ringsnap.lovable.app` |
| `NOTIFY_EMAIL_FROM` | `noreply@getringsnap.com` |

### How to Add Each Secret:

For each secret above:
1. Click **"New repository secret"**
2. Enter the **Name** (exactly as shown in left column)
3. Enter the **Secret** (value from right column)
4. Click **"Add secret"**

---

## 🚀 Step 3: Trigger Deployment

Once all secrets are configured, you have two options:

### Option A: Manual Trigger (Immediate)

1. Go to: **Actions** tab in your GitHub repository
2. Click **"Deploy Supabase Functions"** workflow
3. Click **"Run workflow"** dropdown
4. Select branch: `claude/investigate-supabase-migration-011CUzW8XaWHtuYnPks1rFv9`
5. Click **"Run workflow"** button

This will deploy all 37 functions immediately!

### Option B: Push Code (Automatic)

The workflow automatically runs when you push changes to:
- `main` branch
- `claude/investigate-supabase-migration-011CUzW8XaWHtuYnPks1rFv9` branch
- Any files in `supabase/functions/**`

---

## ✅ Step 4: Verify Deployment

1. Watch the workflow run in the **Actions** tab
2. It should take ~3-5 minutes to deploy all 37 functions
3. Check for ✅ green checkmark when complete
4. Verify functions at: https://supabase.com/dashboard/project/rmyvvbqnccpfeyowidrq/functions

---

## 🔍 Troubleshooting

### "Error: Invalid access token"
- Regenerate token at https://supabase.com/dashboard/account/tokens
- Update `SUPABASE_ACCESS_TOKEN` secret in GitHub

### "Error: Project not found"
- Verify `SUPABASE_PROJECT_REF` is exactly: `rmyvvbqnccpfeyowidrq`

### "Error: Invalid database password"
- Check `SUPABASE_DB_PASSWORD` matches your project password
- Reset password at: https://supabase.com/dashboard/project/rmyvvbqnccpfeyowidrq/settings/database

### Workflow doesn't run
- Ensure secrets are added to the correct repository
- Check workflow file is in `.github/workflows/` directory
- Verify branch name matches in workflow trigger

---

## 📝 What Happens When Workflow Runs:

1. ✅ Checks out your code
2. ✅ Installs Supabase CLI
3. ✅ Links to your project
4. ✅ Configures all edge function secrets
5. ✅ Deploys all 37 functions
6. ✅ Shows success/failure status

---

## 🎯 After Successful Deployment:

- ✅ All 37 edge functions deployed
- ✅ Secrets configured
- ✅ Functions ready to use
- ✅ Auto-deploy on future pushes

---

## 🔐 Security Notes:

- Never commit secrets to git
- Secrets are encrypted by GitHub
- Only accessible during workflow runs
- Rotate tokens periodically

---

## 📚 Resources:

- Supabase CLI Docs: https://supabase.com/docs/reference/cli
- GitHub Actions Docs: https://docs.github.com/en/actions
- GitHub Secrets: https://docs.github.com/en/actions/security-guides/encrypted-secrets
