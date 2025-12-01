# RingSnap MVP Deployment Checklist

## Required Environment Variables

### Frontend (Vite - VITE_ prefix)
```bash
# Stripe
VITE_STRIPE_PUBLISHABLE_KEY="pk_live_..." # Production publishable key

# Supabase
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_PROJECT_ID="your-project-id"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJh..." # Anon key

# Bot Access (Optional - for automated testing)
VITE_JULES_SECRET="your-secure-random-secret"
```

### Backend (Supabase Edge Functions)
```bash
# Supabase
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJh..." # Service role key (SECRET!)

# Vapi AI
VAPI_API_KEY="your-vapi-api-key"
VAPI_BASE_URL="https://api.vapi.ai"

# Stripe
STRIPE_SECRET_KEY="sk_live_..." # Production secret key
STRIPE_PRICE_STARTER="price_..." # Starter plan price ID
STRIPE_PRICE_PROFESSIONAL="price_..." # Professional plan price ID
STRIPE_PRICE_PREMIUM="price_..." # Premium plan price ID

# Resend Email
RESEND_PROD_KEY="re_..." # Production API key
EMAIL_FROM="RingSnap <noreply@getringsnap.com>"
EMAIL_REPLY_TO="support@getringsnap.com"
EMAIL_STREAM="transactional"

# Twilio SMS
TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="your-twilio-auth-token"
TWILIO_PHONE_NUMBER="+15551234567"

# Auth Configuration
SITE_URL="https://app.getringsnap.com" # Production domain
AUTH_MAGIC_LINK_TTL_MINUTES="20"
AUTH_INVITE_TTL_HOURS="48"
```

## Pre-Deployment Checklist

### 1. Database Migrations
- [ ] Run all migrations in order:
  ```sql
  20251118000001_create_signup_leads.sql
  20251201000001_add_signup_leads_metadata.sql
  20251201000002_create_customer_leads.sql
  20251201000003_operator_dashboard_views.sql
  ```
- [ ] Verify RLS policies are enabled
- [ ] Test queries with read-only user

### 2. Edge Functions
- [ ] Deploy all functions:
  ```bash
  supabase functions deploy create-trial
  supabase functions deploy capture-signup-lead
  supabase functions deploy sync-usage
  supabase functions deploy booking-schedule
  ```
- [ ] Set environment secrets:
  ```bash
  supabase secrets set STRIPE_SECRET_KEY=sk_live_...
  supabase secrets set TWILIO_AUTH_TOKEN=...
  supabase secrets set VAPI_API_KEY=...
  supabase secrets set RESEND_PROD_KEY=...
  ```
- [ ] Test each function with curl/Postman

### 3. Stripe Configuration
- [ ] Create production products and prices
- [ ] Update price IDs in env vars
- [ ] Configure webhooks to point to production
- [ ] Test trial signup end-to-end

### 4. Vapi Configuration
- [ ] Create production phone numbers
- [ ] Configure post-call webhook to `sync-usage`
- [ ] Configure booking webhook to `booking-schedule`
- [ ] Test call flow end-to-end

### 5. Twilio Configuration
- [ ] Verify production phone number
- [ ] Add production callback URLs
- [ ] Test SMS delivery
- [ ] Monitor SMS logs

### 6. Resend Email
- [ ] Verify domain
- [ ] Add SPF/DKIM records
- [ ] Test email delivery
- [ ] Configure webhooks for bounces

### 7. Frontend Build
- [ ] Build with production env vars:
  ```bash
  npm run build
  ```
- [ ] Test build locally:
  ```bash
  npm run preview
  ```
- [ ] Deploy to hosting (Vercel/Netlify)

### 8. Security
- [ ] Enable RLS on all tables
- [ ] Audit service role key usage
- [ ] Rotate secrets if needed
- [ ] Enable rate limiting
- [ ] Configure CORS properly

### 9. Monitoring
- [ ] Set up Supabase logs monitoring
- [ ] Configure error tracking (Sentry)
- [ ] Set up uptime monitoring
- [ ] Create runbook for common issues

### 10. Testing
- [ ] Signup flow (AI-assisted)
- [ ] Traditional signup fallback
- [ ] Phone call → lead creation
- [ ] Appointment booking → SMS
- [ ] Operator dashboard loads
- [ ] Usage tracking accurate

## Post-Deployment Verification

### Critical Paths
1. **Signup Flow**:
   - Visit `/signup`
   - Complete AI-assisted signup
   - Verify account created
   - Verify Stripe subscription active
   - Verify provisioning job created

2. **Call→Lead Pipeline**:
   - Make test call to Vapi number
   - Verify usage_log created
   - Verify customer_lead created
   - Verify dashboard shows data

3. **Booking Flow**:
   - Request appointment via call
   - Verify appointment record created
   - Verify SMS sent to operator
   - Check Twilio logs

4. **Operator Dashboard**:
   - Log in as operator
   - Navigate to "Today" tab
   - Verify calls, leads, appointments display
   - Verify real-time updates work

## Rollback Plan

If critical issues arise:

1. **Database**:
   - Keep backup before migration
   - Rollback command: `supabase db reset`

2. **Edge Functions**:
   - Redeploy previous version
   - Or disable problematic function

3. **Frontend**:
   - Revert to previous deployment
   - Update DNS if needed

## Support Contacts

- Supabase Support: support@supabase.io
- Stripe Support: https://support.stripe.com
- Twilio Support: https://support.twilio.com
- Vapi Support: support@vapi.ai

## Notes

- Keep `.env.example` updated with new vars
- Document any manual database changes
- Update this checklist as process evolves
