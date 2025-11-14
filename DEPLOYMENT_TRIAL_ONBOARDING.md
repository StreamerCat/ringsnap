# Trial Onboarding System - Deployment Guide

This guide walks through deploying the dual-flow trial onboarding system (self-serve + sales-guided).

## 📋 Pre-Deployment Checklist

- [ ] Stripe account configured with trial periods enabled
- [ ] Vapi API key obtained
- [ ] Supabase project set up
- [ ] Environment variables configured
- [ ] Database backup completed

## 🗄️ Step 1: Database Migrations

Run migrations in order (critical for data integrity):

```bash
# 1. Add source tracking to accounts and profiles
psql -h <your-db-host> -U postgres -d ringsnap -f supabase/migrations/20251113000001_add_source_tracking.sql

# 2. Enhance provisioning_jobs table for async job tracking
psql -h <your-db-host> -U postgres -d ringsnap -f supabase/migrations/20251113000002_enhance_provisioning_jobs.sql

# 3. Add primary_goal column for AI configuration
psql -h <your-db-host> -U postgres -d ringsnap -f supabase/migrations/20251113000003_add_primary_goal.sql
```

**Verify migrations:**
```sql
-- Check source column exists
SELECT source, COUNT(*) FROM accounts GROUP BY source;

-- Check provisioning_jobs enhancements
SELECT job_type, status, COUNT(*) FROM provisioning_jobs GROUP BY job_type, status;

-- Check primary_goal column
SELECT primary_goal, COUNT(*) FROM accounts GROUP BY primary_goal;
```

## ☁️ Step 2: Deploy Backend Function

Deploy the unified create-trial edge function:

```bash
# Navigate to Supabase functions directory
cd supabase/functions

# Deploy create-trial function
supabase functions deploy create-trial

# Verify deployment
supabase functions list
```

**Set function secrets:**
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_your_key_here
supabase secrets set VAPI_API_KEY=your_vapi_key_here
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Verify secrets
supabase secrets list
```

**Test endpoint:**
```bash
curl -X POST https://your-project.supabase.co/functions/v1/create-trial \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "phone": "5551234567",
    "companyName": "Test Company",
    "trade": "Plumbing",
    "assistantGender": "female",
    "planType": "starter",
    "paymentMethodId": "pm_test_card",
    "source": "website"
  }'
```

## 🎨 Step 3: Deploy Frontend Components

All frontend code is already in your repository. Build and deploy:

```bash
# Install dependencies (if not already done)
npm install

# Build application
npm run build

# Deploy to your hosting provider
# For Vercel:
vercel --prod

# For Netlify:
netlify deploy --prod

# For custom hosting:
# Upload contents of dist/ to your web server
```

## 🔧 Step 4: Environment Variables

**Frontend (.env.production):**
```bash
# Stripe
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your_publishable_key
VITE_STRIPE_PRICE_STARTER=price_starter_id
VITE_STRIPE_PRICE_PROFESSIONAL=price_professional_id
VITE_STRIPE_PRICE_PREMIUM=price_premium_id

# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

**Backend (Supabase secrets - already set in Step 2):**
- STRIPE_SECRET_KEY
- VAPI_API_KEY
- STRIPE_WEBHOOK_SECRET

## 🧪 Step 5: Testing

### Run Unit Tests
```bash
npm run test
```

### Run Integration Tests
```bash
npm run test:integration
```

### Manual Testing Checklist

**Self-Serve Flow:**
- [ ] Navigate to `/trial` or `/onboarding/self-serve`
- [ ] Complete all 8 steps with test data
- [ ] Verify Stripe subscription created (check Stripe dashboard)
- [ ] Verify account created with `source='website'` (check database)
- [ ] Verify provisioning job created
- [ ] Wait for phone number provisioning (1-2 minutes)
- [ ] Receive phone number and test call

**Sales-Guided Flow:**
- [ ] Navigate to `/onboarding/sales`
- [ ] Complete all 5 steps with test data
- [ ] Verify sales rep name captured
- [ ] Verify account created with `source='sales'` (check database)
- [ ] Verify Stripe metadata includes `sales_rep`
- [ ] Test complete flow with sales rep

### Test Data
```javascript
// Self-serve test user
{
  name: "Test Self-Serve",
  email: "test-selfserve@example.com",
  phone: "5551111111",
  companyName: "Test Plumbing Co",
  trade: "Plumbing",
  website: "https://testplumbing.com",
  zipCode: "90210",
  assistantGender: "female",
  primaryGoal: "book_appointments",
  planType: "professional",
  source: "website"
}

// Sales test user
{
  name: "Test Sales",
  email: "test-sales@example.com",
  phone: "5552222222",
  companyName: "Test HVAC Inc",
  trade: "HVAC",
  serviceArea: "Los Angeles",
  zipCode: "90001",
  assistantGender: "male",
  planType: "premium",
  salesRepName: "Demo Rep",
  source: "sales"
}
```

Use Stripe test cards:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`

## 🚀 Step 6: Route Configuration

Add routes to your application router:

**React Router example (src/App.tsx):**
```tsx
import { SelfServeTrialFlow, SalesGuidedTrialFlow } from "@/components/onboarding";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

const stripe = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

// In your routes:
<Routes>
  {/* Self-serve flow */}
  <Route
    path="/trial"
    element={
      <Elements stripe={stripe}>
        <SelfServeTrialFlow onSuccess={() => navigate("/dashboard")} />
      </Elements>
    }
  />

  {/* Sales-guided flow */}
  <Route
    path="/onboarding/sales"
    element={
      <Elements stripe={stripe}>
        <SalesGuidedTrialFlow onSuccess={() => navigate("/dashboard")} />
      </Elements>
    }
  />
</Routes>
```

## 📊 Step 7: Analytics & Monitoring

### Database Queries for Monitoring

**Trial signups by source:**
```sql
SELECT
  source,
  COUNT(*) as signups,
  COUNT(CASE WHEN subscription_status = 'active' THEN 1 END) as conversions,
  ROUND(100.0 * COUNT(CASE WHEN subscription_status = 'active' THEN 1 END) / COUNT(*), 2) as conversion_rate
FROM accounts
WHERE created_at > now() - interval '30 days'
GROUP BY source;
```

**Sales rep performance:**
```sql
SELECT
  sales_rep_name,
  COUNT(*) as trials,
  COUNT(CASE WHEN subscription_status = 'active' THEN 1 END) as conversions,
  SUM(CASE
    WHEN plan_type = 'starter' THEN 297
    WHEN plan_type = 'professional' THEN 497
    WHEN plan_type = 'premium' THEN 797
  END) as total_mrr
FROM accounts
WHERE source = 'sales'
  AND created_at > now() - interval '30 days'
GROUP BY sales_rep_name
ORDER BY conversions DESC;
```

**Provisioning success rate:**
```sql
SELECT
  job_type,
  status,
  COUNT(*) as count,
  ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - created_at))), 2) as avg_duration_seconds
FROM provisioning_jobs
WHERE created_at > now() - interval '7 days'
GROUP BY job_type, status;
```

### Set Up Alerts

Monitor these metrics:
- Provisioning job failures (status='failed')
- Stripe payment failures
- Trial conversion rate drops
- Average provisioning time spikes

## 🔄 Step 8: Webhook Configuration

Ensure Stripe webhooks are configured:

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-project.supabase.co/functions/v1/stripe-webhook`
3. Select events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

4. Copy webhook signing secret
5. Update Supabase secret:
   ```bash
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_your_secret
   ```

## 🎯 Step 9: Feature Flags (Optional)

If using feature flags, enable the new flows:

```bash
# Example with LaunchDarkly or similar
FEATURE_SELF_SERVE_TRIAL=true
FEATURE_SALES_GUIDED_TRIAL=true
```

## ✅ Post-Deployment Verification

### Automated Checks
```bash
# Health check
curl https://your-project.supabase.co/functions/v1/create-trial/health

# Database connectivity
npm run db:check

# Stripe connectivity
npm run stripe:check
```

### Manual Verification Checklist
- [ ] Self-serve flow completes successfully
- [ ] Sales-guided flow completes successfully
- [ ] Stripe subscriptions created correctly
- [ ] Source tracking working (check database)
- [ ] Provisioning jobs completing (check Vapi dashboard)
- [ ] Phone numbers assigned to accounts
- [ ] Test calls work
- [ ] Email notifications sent (if configured)
- [ ] Analytics queries return expected data

## 🔙 Rollback Plan

If issues arise, rollback in reverse order:

1. **Disable routes** - Remove/disable new onboarding routes
2. **Revert frontend** - Deploy previous version
3. **Keep backend** - Unified create-trial is backwards compatible
4. **Keep migrations** - Additive only, safe to keep

**Emergency rollback:**
```bash
# Revert to previous deployment
vercel rollback  # or your hosting provider's rollback command

# Database rollback (ONLY if critical issues)
# Note: Source tracking is additive, safe to keep
# Only rollback if absolutely necessary
```

## 📚 Documentation

Update your team documentation with:
- Link to self-serve flow: `/trial`
- Link to sales flow: `/onboarding/sales`
- Test card numbers for demos
- Sales rep onboarding guide
- Analytics dashboard links

## 🎓 Training

**For Sales Team:**
1. Review sales-guided flow walkthrough
2. Practice with test accounts
3. Learn provisioning wait time pitch
4. Understand call forwarding setup
5. Know how to demo the AI receptionist

**For Support Team:**
1. Understand both flows
2. Know how to check provisioning status
3. Troubleshooting guide for common issues
4. Escalation process for failures

## 🐛 Common Issues & Solutions

**Issue: Provisioning stuck in "pending"**
- Check Vapi API key is correct
- Check provisioning_jobs table for errors
- Verify Vapi account has available phone numbers

**Issue: Stripe payment fails**
- Check Stripe API keys (live vs test)
- Verify webhook is receiving events
- Check customer email is valid

**Issue: Source not tracking**
- Verify migration ran successfully
- Check frontend is passing `source` parameter
- Query database: `SELECT source FROM accounts WHERE id = 'xxx'`

## 📞 Support Contacts

- **Database Issues:** DBA team
- **Stripe Issues:** Payments team
- **Vapi Issues:** AI/Voice team
- **Frontend Issues:** Frontend team

---

## Summary

**Total Deployment Time:** ~2-3 hours

**Steps:**
1. ✅ Run migrations (5 min)
2. ✅ Deploy backend function (15 min)
3. ✅ Deploy frontend (30 min)
4. ✅ Configure environment variables (10 min)
5. ✅ Testing (60 min)
6. ✅ Route configuration (15 min)
7. ✅ Analytics setup (15 min)
8. ✅ Webhook configuration (10 min)
9. ✅ Post-deployment verification (30 min)

**Result:** Two production-ready trial flows sharing infrastructure, zero code duplication! 🎉
