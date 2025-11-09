# Deployment Instructions

## Issue
The edge function and frontend haven't been deployed, so:
- Edge function still uses old code (`'trialing'` instead of `'trial'`)
- Frontend still shows 3 steps instead of 4 steps

## Steps to Deploy

### 1. Deploy Edge Function (CRITICAL - Do this first!)

**Option A: Via Supabase Dashboard** (Recommended if you don't have CLI)
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **Edge Functions** in left sidebar
4. Find `free-trial-signup` function
5. Click **Edit**
6. Copy the contents from: `/home/user/ringsnap/supabase/functions/free-trial-signup/index.ts`
7. Paste into the editor
8. Click **Deploy**

**Option B: Via CLI** (If you have Supabase CLI installed locally)
```bash
supabase functions deploy free-trial-signup
```

### 2. Deploy Frontend

The frontend needs to be rebuilt to show the new 4-step flow.

**If using Vercel/Netlify:**
```bash
git push origin claude/unified-signup-flow-implementation-011CUvwaBSfmHDbdY9vs1TJh
# Then trigger a deployment in your hosting platform
```

**If running locally:**
```bash
npm run build
# or
yarn build
```

### 3. Fix Stripe Environment Variables (CRITICAL!)

The logs will now show which mode Stripe is running in. You need to ensure the price IDs match:

**Check the edge function logs after deployment** - they will show:
```
"Stripe initialized in test mode"  OR  "Stripe initialized in live mode"
```

Then in Supabase Dashboard → Project Settings → Edge Functions → Secrets:

**If test mode:**
- Keep `STRIPE_SECRET_KEY` as `sk_test_...`
- Update price IDs to test mode prices from Stripe Dashboard

**If live mode:**
- Update `STRIPE_SECRET_KEY` to `sk_live_...`
- Keep current price IDs

### 4. Test

1. Clear browser cache
2. Try signup with fresh test data
3. Check that:
   - Form shows 4 steps (Contact → Business → Plan → Payment)
   - Step 2 includes Trade and Website fields
   - Edge function logs show correct Stripe mode
   - No enum errors in logs

## Files Changed in Latest Commit

1. `supabase/functions/free-trial-signup/index.ts` - Fixed enum, added Stripe validation, accepts website
2. `src/components/signup/TrialSignupFlow.tsx` - Reorganized to 4 steps
3. `src/components/signup/shared/schemas.ts` - Added website field
4. `supabase/functions/provision-resources/index.ts` - Passes website to VAPI
5. `supabase/functions/_shared/template-builder.ts` - Includes website in prompts

## Verification

After deployment, the error should change from:
```
❌ "invalid input value for enum subscription_status: 'trialing'"
```

To either:
✅ Success (if Stripe env vars are fixed)
OR
❌ Stripe price mode mismatch error (if env vars still wrong)
