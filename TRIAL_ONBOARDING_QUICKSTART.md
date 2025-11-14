# Trial Onboarding - Quick Start Checklist

Fast-track deployment guide for the dual-flow trial onboarding system.

## ⚡ 5-Minute Deploy (Minimum Viable)

### 1. Run Migrations (2 min)
```bash
cd supabase/migrations
psql $DATABASE_URL -f 20251113000001_add_source_tracking.sql
psql $DATABASE_URL -f 20251113000002_enhance_provisioning_jobs.sql
psql $DATABASE_URL -f 20251113000003_add_primary_goal.sql
```

### 2. Deploy Backend (1 min)
```bash
cd supabase/functions
supabase functions deploy create-trial
supabase secrets set STRIPE_SECRET_KEY=$YOUR_STRIPE_KEY
supabase secrets set VAPI_API_KEY=$YOUR_VAPI_KEY
```

### 3. Update Frontend Env (30 sec)
```bash
echo "VITE_STRIPE_PUBLISHABLE_KEY=pk_test_..." >> .env.production
echo "VITE_STRIPE_PRICE_PROFESSIONAL=price_..." >> .env.production
```

### 4. Deploy Frontend (1 min)
```bash
npm run build && vercel --prod
```

### 5. Test (30 sec)
```bash
# Open: https://yourapp.com/trial
# Use card: 4242 4242 4242 4242
# Complete flow
```

## ✅ Pre-Flight Checklist

**Before deploying:**
- [ ] Database backup completed
- [ ] Stripe test mode working
- [ ] Vapi API key obtained
- [ ] Environment variables ready
- [ ] Git branch created: `feature/trial-onboarding`

## 📦 Files Generated

### Database (3 files)
```
supabase/migrations/
├── 20251113000001_add_source_tracking.sql
├── 20251113000002_enhance_provisioning_jobs.sql
└── 20251113000003_add_primary_goal.sql
```

### Backend (1 file + 1 test)
```
supabase/functions/
└── create-trial/
    ├── index.ts
    └── create-trial.test.ts
```

### Frontend - Shared Components (8 files)
```
src/components/onboarding/shared/
├── UserInfoForm.tsx
├── BusinessBasicsForm.tsx
├── BusinessAdvancedForm.tsx
├── VoiceSelector.tsx
├── PlanSelector.tsx
├── PaymentForm.tsx
├── ProvisioningStatus.tsx
└── PhoneReadyPanel.tsx
```

### Frontend - Orchestrators (2 files)
```
src/components/onboarding/
├── SelfServeTrialFlow.tsx       # 8-step self-serve
└── SalesGuidedTrialFlow.tsx     # 5-step sales-guided
```

### Frontend - Utilities (4 files)
```
src/components/onboarding/
├── types.ts        # TypeScript interfaces
├── utils.ts        # Utility functions
├── constants.ts    # Plans, trades, configs
└── index.ts        # Public exports
```

### Tests (5 files)
```
src/components/onboarding/__tests__/
├── utils.test.ts
├── UserInfoForm.test.tsx
├── PlanSelector.test.tsx
├── integration.test.tsx
└── setup.ts
```

### Documentation (3 files)
```
/
├── DEPLOYMENT_TRIAL_ONBOARDING.md    # Full deployment guide
├── TRIAL_ONBOARDING_QUICKSTART.md    # This file
└── src/components/onboarding/README.md # Component docs
```

**Total: 27 files generated** ✨

## 🔗 Add Routes

**In your app router (e.g., App.tsx):**

```tsx
import { SelfServeTrialFlow, SalesGuidedTrialFlow } from "@/components/onboarding";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

const stripe = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

// Add these routes:
<Route
  path="/trial"
  element={
    <Elements stripe={stripe}>
      <SelfServeTrialFlow onSuccess={() => navigate("/dashboard")} />
    </Elements>
  }
/>

<Route
  path="/onboarding/sales"
  element={
    <Elements stripe={stripe}>
      <SalesGuidedTrialFlow onSuccess={() => navigate("/dashboard")} />
    </Elements>
  }
/>
```

## 🧪 Quick Test Script

```bash
#!/bin/bash

echo "🧪 Testing Trial Onboarding..."

# 1. Test migrations
echo "1. Checking migrations..."
psql $DATABASE_URL -c "SELECT source FROM accounts LIMIT 1;" || echo "❌ Migration failed"

# 2. Test backend
echo "2. Testing create-trial endpoint..."
curl -X POST $SUPABASE_URL/functions/v1/create-trial \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","phone":"5551234567","companyName":"Test Co","trade":"Plumbing","assistantGender":"female","planType":"starter","paymentMethodId":"pm_test","source":"website"}' \
  || echo "❌ Backend test failed"

# 3. Test frontend build
echo "3. Testing frontend build..."
npm run build || echo "❌ Build failed"

echo "✅ Tests complete!"
```

## 🎯 Verification Commands

**Check migrations:**
```sql
SELECT source, COUNT(*) FROM accounts GROUP BY source;
SELECT job_type, status, COUNT(*) FROM provisioning_jobs GROUP BY job_type, status;
SELECT primary_goal, COUNT(*) FROM accounts WHERE primary_goal IS NOT NULL GROUP BY primary_goal;
```

**Check backend deployed:**
```bash
supabase functions list | grep create-trial
```

**Check secrets:**
```bash
supabase secrets list
```

**Check frontend built:**
```bash
ls -lh dist/
```

## 🚀 Go Live Checklist

**Switch to production:**
- [ ] Change Stripe keys to live (pk_live_..., sk_live_...)
- [ ] Update Stripe price IDs to live prices
- [ ] Configure Stripe webhook for live mode
- [ ] Set Supabase secrets to production values
- [ ] Test with real credit card (will be refunded)
- [ ] Monitor first 10 signups closely
- [ ] Set up analytics tracking
- [ ] Brief sales team on sales-guided flow

## 📊 Monitor These Metrics

**First 24 hours:**
- Trial signups by source (website vs sales)
- Provisioning success rate
- Payment success rate
- Time to provision phone numbers

**Query:**
```sql
SELECT
  source,
  COUNT(*) as signups,
  COUNT(CASE WHEN provisioning_status = 'active' THEN 1 END) as provisioned,
  COUNT(CASE WHEN subscription_status = 'active' THEN 1 END) as paid
FROM accounts
WHERE created_at > now() - interval '24 hours'
GROUP BY source;
```

## 🐛 Common Issues - Quick Fixes

| Issue | Fix |
|-------|-----|
| "create-trial function not found" | `supabase functions deploy create-trial` |
| "Payment failed" | Check Stripe keys in `.env` and Supabase secrets |
| "Provisioning stuck" | Check Vapi API key: `supabase secrets list` |
| "Source is null" | Re-run migration: `20251113000001_add_source_tracking.sql` |
| "Build error" | `npm install && npm run build` |

## 📞 Emergency Contacts

**Deploy failed?** Rollback:
```bash
vercel rollback  # or your hosting provider's command
```

**Database issue?** Contact DBA team

**Payment issue?** Check Stripe dashboard → Developers → Logs

## 🎉 Success Criteria

You're done when:
- ✅ Self-serve flow completes end-to-end
- ✅ Sales-guided flow completes end-to-end
- ✅ Both create accounts with correct `source`
- ✅ Provisioning completes in <2 minutes
- ✅ Phone numbers work for test calls
- ✅ Analytics queries return data

## 📚 Full Documentation

For detailed information, see:
- **Deployment Guide:** `DEPLOYMENT_TRIAL_ONBOARDING.md`
- **Component Docs:** `src/components/onboarding/README.md`
- **Architecture:** `src/components/onboarding/README.md` (Architecture Principles section)

---

**Estimated total deployment time: 30-45 minutes** (including testing)

**Questions?** Check the full deployment guide or contact the engineering team.
