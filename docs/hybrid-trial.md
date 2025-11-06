# Hybrid Trial System

**Soft card requirement with cardless fallback**

## Overview

The hybrid trial system allows users to start a trial even if they skip adding a payment method. This increases signup conversion while still collecting payment methods from users who are willing to provide them.

### Two Trial Modes

1. **Card-Required Trial** (Recommended path)
   - User adds payment method during signup
   - Gets full 150 minutes of AI calling
   - Immediate phone number provisioning
   - No charge until trial ends (3 days)
   - `trial_type` = `'card_required'`
   - `has_payment_method` = `true`

2. **Cardless Trial** (Fallback path)
   - User skips payment step
   - Gets limited 30 minutes of AI calling
   - Still gets phone number (limited mode)
   - Prompted via email and banner to add card
   - `trial_type` = `'cardless'`
   - `has_payment_method` = `false`

---

## Architecture

### Database Schema

Added three columns to `accounts` table:

```sql
has_payment_method BOOLEAN NOT NULL DEFAULT false
trial_status TEXT NOT NULL DEFAULT 'active'
trial_type TEXT NOT NULL DEFAULT 'card_required'
```

**trial_status enum values:**
- `active` - Trial is currently active
- `pending_card` - Cardless trial, waiting for payment method
- `expired` - Trial period ended
- `converted` - User converted to paid subscription

**trial_type enum values:**
- `card_required` - Full trial with payment method
- `cardless` - Limited trial without payment method

### Analytics Events Table

Tracks trial funnel for optimization:

```sql
CREATE TABLE trial_events (
  id UUID PRIMARY KEY,
  account_id UUID REFERENCES accounts(id),
  event_type TEXT NOT NULL,
  event_data JSONB,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ
);
```

**Event types:**
- `trial_started` - User begins trial (with type: card_required or cardless)
- `payment_method_added` - User adds card
- `trial_promoted` - Cardless user upgrades to full trial
- `trial_expired` - Trial period ends

---

## Backend Endpoints

### 1. `create-setup-intent`

Creates Stripe Setup Intent for collecting payment method without charging.

**Request:**
```json
{
  "accountId": "uuid"
}
```

**Response:**
```json
{
  "clientSecret": "seti_xxx_secret_xxx",
  "customerId": "cus_xxx"
}
```

**Flow:**
1. Authenticate user via Supabase auth
2. Verify user owns the account
3. Find or create Stripe customer
4. Create Setup Intent
5. Return client_secret for frontend

### 2. `confirm-payment-method`

Attaches payment method to customer after successful Setup Intent confirmation.

**Request:**
```json
{
  "accountId": "uuid",
  "paymentMethodId": "pm_xxx"
}
```

**Response:**
```json
{
  "ok": true,
  "message": "Payment method added successfully"
}
```

**Flow:**
1. Authenticate user
2. Verify account ownership
3. Attach payment method to Stripe customer
4. Set as default payment method
5. Update account: `has_payment_method=true`, `trial_status='active'`
6. Log `payment_method_added` event

### 3. `skip-card-trial`

Handles cardless trial path when user skips payment.

**Request:**
```json
{
  "accountId": "uuid"
}
```

**Response:**
```json
{
  "ok": true,
  "message": "Cardless trial started",
  "trial_type": "cardless"
}
```

**Flow:**
1. Authenticate user
2. Verify account ownership
3. Update account: `trial_type='cardless'`, `trial_status='pending_card'`
4. Log `trial_started` event with `trial_type: 'cardless'`
5. TODO: Trigger activation email

---

## Frontend Components

### 1. `useSetupIntent` Hook

React hook managing Setup Intent lifecycle.

```typescript
const {
  clientSecret,      // Setup Intent client secret
  isLoading,        // Creating Setup Intent
  error,            // Error message if any
  isProcessing,     // Confirming or skipping
  isReady,          // Ready to show Stripe UI
  confirmSetup,     // Function to confirm and attach PM
  skipPayment,      // Function to start cardless trial
} = useSetupIntent({
  accountId,
  onSuccess: () => {},  // Called after payment added
  onSkip: () => {},     // Called after skip
});
```

**Usage:**
- Automatically creates Setup Intent on mount
- Handles Stripe confirmation
- Calls backend to attach payment method
- Manages all loading and error states

### 2. `SecureTrialStep` Component

Payment step UI with Stripe Payment Element.

```tsx
<SecureTrialStep
  accountId={account.id}
  onPaymentAdded={() => {}}
  onSkipped={() => {}}
  trialDays={3}
/>
```

**Features:**
- Beautiful headline: "Secure Your Free Trial"
- Shows benefits (150 minutes, no charge, instant number)
- Stripe Payment Element with tabs layout
- "Secure My Trial" button (primary action)
- "Skip for now" button (secondary action)
- Trust signals: "Secured by Stripe", "Cancel anytime"
- Responsive design

### 3. `LimitedTrialBanner` Component

Alert banner for cardless trial users.

```tsx
<LimitedTrialBanner
  accountId={account.id}
  minutesUsed={15}
  minutesLimit={30}
  onPaymentAdded={() => {}}
  onDismiss={() => {}}
/>
```

**Features:**
- Shows usage: "15 of 30 minutes used"
- Lists benefits of upgrading
- Warning state when >70% used
- "Unlock Full Trial" CTA
- Opens payment dialog on click
- Dismissible with X button

### 4. `HybridOnboardingFlow` Component

Wrapper managing payment + wizard flow.

```tsx
<HybridOnboardingFlow
  open={isOpen}
  onOpenChange={setIsOpen}
  onSuccess={() => {}}
  accountId={account.id}
  hasPaymentMethod={account.has_payment_method}
  initialProfile={profile}
  defaultPhone={phone}
/>
```

**Flow Logic:**
- If `!hasPaymentMethod`: Show `SecureTrialStep`
- After payment or skip: Show `OnboardingWizard`
- If `hasPaymentMethod`: Skip directly to wizard

---

## User Flows

### Flow A: User Adds Payment Method

```
Signup
  ↓
SecureTrialStep rendered
  ↓
User enters card (4242 4242 4242 4242 for test)
  ↓
Stripe validates card
  ↓
Frontend calls confirmSetup()
  ↓
Stripe Setup Intent confirmed
  ↓
Frontend calls confirm-payment-method endpoint
  ↓
Backend attaches PM to customer
  ↓
Database updated: has_payment_method=true, trial_type='card_required'
  ↓
Analytics event: payment_method_added
  ↓
OnboardingWizard shown (phone selection, business details)
  ↓
Full provisioning (150 minutes, all features)
```

### Flow B: User Skips Payment

```
Signup
  ↓
SecureTrialStep rendered
  ↓
User clicks "Skip for now"
  ↓
Frontend calls skipPayment()
  ↓
Backend calls skip-card-trial endpoint
  ↓
Database updated: trial_type='cardless', trial_status='pending_card'
  ↓
Analytics event: trial_started (cardless)
  ↓
Email sent: "Activate Your Trial" (TODO)
  ↓
OnboardingWizard shown
  ↓
Limited provisioning (30 minutes)
  ↓
Dashboard shown with LimitedTrialBanner
  ↓
User can upgrade anytime via banner
```

### Flow C: Cardless User Upgrades Later

```
Dashboard loads
  ↓
LimitedTrialBanner shown (trial_type='cardless')
  ↓
User clicks "Unlock Full Trial"
  ↓
Payment dialog opens with SecureTrialStep
  ↓
User adds card
  ↓
Backend updates: has_payment_method=true, trial_type='card_required'
  ↓
Analytics event: trial_promoted
  ↓
Banner disappears
  ↓
Full access granted (150 minutes unlocked)
```

---

## Environment Variables

Required for hybrid trial to work:

```bash
# Stripe (required)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_SECRET_KEY=sk_test_xxx

# Supabase (already set)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx

# Email (for activation emails - TODO)
RESEND_API_KEY=re_xxx
EMAIL_FROM="RingSnap <support@getringsnap.com>"

# Trial configuration (optional, defaults shown)
TRIAL_LENGTH_DAYS=3
LIMITED_TRIAL_CAP_MINUTES=30
TRIAL_REMINDER_DELAY_HOURS=24
```

---

## Testing

### Test Cards (Stripe)

Use these test cards:

```
Success: 4242 4242 4242 4242
Decline: 4000 0000 0000 0002
Insufficient funds: 4000 0000 0000 9995
3D Secure required: 4000 0027 6000 3184
```

**Expiry:** Any future date (e.g., 12/25)
**CVC:** Any 3 digits (e.g., 123)
**ZIP:** Any 5 digits (e.g., 12345)

### Test Scenarios

#### Scenario 1: Add Payment (Happy Path)
1. Sign up for trial
2. See "Secure Your Free Trial" screen
3. Enter test card `4242 4242 4242 4242`
4. Click "Secure My Trial"
5. ✅ Verify: Payment method added
6. ✅ Verify: Redirected to onboarding wizard
7. ✅ Verify: DB shows `has_payment_method=true`

#### Scenario 2: Skip Payment (Fallback Path)
1. Sign up for trial
2. See "Secure Your Free Trial" screen
3. Click "Skip for now"
4. ✅ Verify: Redirected to onboarding wizard
5. ✅ Verify: DB shows `trial_type='cardless'`
6. ✅ Verify: Limited banner shown on dashboard
7. ✅ Verify: Banner shows "30 minutes" limit

#### Scenario 3: Cardless User Upgrades
1. Sign up and skip payment
2. Go to dashboard
3. See limited trial banner
4. Click "Unlock Full Trial"
5. Enter test card in modal
6. ✅ Verify: Banner disappears
7. ✅ Verify: DB shows `has_payment_method=true`
8. ✅ Verify: Analytics shows `trial_promoted` event

#### Scenario 4: Payment Fails
1. Sign up for trial
2. See payment screen
3. Enter declining card `4000 0000 0000 0002`
4. Click "Secure My Trial"
5. ✅ Verify: Error message shown
6. ✅ Verify: Can retry with different card
7. ✅ Verify: Can still skip instead

---

## Database Queries

### Find Cardless Trials Pending Card
```sql
SELECT
  a.id,
  p.email,
  a.created_at,
  a.trial_end_date,
  DATE_PART('day', a.trial_end_date - NOW()) as days_remaining
FROM accounts a
JOIN profiles p ON p.account_id = a.id
WHERE a.trial_type = 'cardless'
  AND a.trial_status = 'pending_card'
  AND a.trial_end_date > NOW()
ORDER BY a.created_at DESC;
```

### Trial Conversion Funnel
```sql
SELECT
  trial_type,
  COUNT(*) as total,
  COUNT(CASE WHEN has_payment_method THEN 1 END) as with_payment,
  ROUND(
    COUNT(CASE WHEN has_payment_method THEN 1 END) * 100.0 / COUNT(*),
    2
  ) as payment_rate
FROM accounts
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY trial_type;
```

### Recent Trial Events
```sql
SELECT
  te.event_type,
  te.created_at,
  a.trial_type,
  a.has_payment_method,
  p.email
FROM trial_events te
JOIN accounts a ON a.id = te.account_id
JOIN profiles p ON p.account_id = a.id
WHERE te.created_at > NOW() - INTERVAL '24 hours'
ORDER BY te.created_at DESC
LIMIT 100;
```

---

## Deployment Checklist

- [ ] Run database migration: `20251107000000_hybrid_trial_fields.sql`
- [ ] Deploy edge functions:
  - [ ] `create-setup-intent`
  - [ ] `confirm-payment-method`
  - [ ] `skip-card-trial`
- [ ] Set environment variables (Stripe keys, email config)
- [ ] Test with Stripe test cards
- [ ] Verify analytics events logging correctly
- [ ] Set up email templates (activation, reminders)
- [ ] Monitor trial conversion rates
- [ ] Set up alerts for failed payment methods

---

## Analytics & Metrics

### Key Metrics to Track

1. **Trial Start Rate**
   - % of signups that complete trial start
   - Compare card vs cardless

2. **Payment Method Addition Rate**
   - % of users who add payment on signup
   - % of cardless who upgrade later

3. **Trial Conversion Rate**
   - % of trials that convert to paid
   - Compare card vs cardless conversion

4. **Time to Payment Method**
   - How long cardless users take to add card
   - Identify optimal reminder timing

5. **Churn by Trial Type**
   - Do cardless users churn more?
   - ROI of collecting payment upfront

### Example Dashboards

**Funnel:**
```
Signups: 1000
 ├─ Added Payment: 700 (70%)
 └─ Skipped: 300 (30%)
    └─ Later Added: 90 (30% of skips)

Total with Payment: 790 (79%)
```

**Cohort Analysis:**
```
Card-Required Trial:
- 7-day retention: 85%
- 30-day conversion: 45%

Cardless Trial:
- 7-day retention: 65%
- 30-day conversion: 25%
- Upgrade rate: 30%
```

---

## Email Templates (TODO)

### Activation Email (Immediate)

**Sent:** When user skips payment
**Subject:** "You're in — activate your RingSnap trial in one step"

```
Hey [Name],

Welcome to RingSnap! 🎉

You have access to your dashboard and 30 minutes of trial calling.

To unlock your full 150-minute trial:
[Add Payment Method] → (deep link to /onboarding)

No charge during your 3-day trial. Cancel anytime.

Questions? Just reply to this email.

— The RingSnap Team
```

### Reminder Email (T+24h)

**Sent:** 24 hours after skip (configurable)
**Subject:** "Finish activating your RingSnap trial"

```
Hey [Name],

You started your RingSnap trial yesterday!

Quick reminder: You have 30 minutes on your limited trial.

Unlock your full trial (150 minutes):
[Activate Full Trial] → (deep link)

Still 2 days left in your trial. No charge until it ends.

— The RingSnap Team
```

---

## Future Enhancements

### Short Term (1-2 weeks)
- [ ] Email integration (activation + reminders)
- [ ] Admin dashboard to view trial types
- [ ] A/B test: 30 vs 60 minute cardless limit
- [ ] Track referral source by trial type

### Medium Term (1-2 months)
- [ ] Smart reminder timing (based on usage)
- [ ] In-app notifications for cardless users
- [ ] Slack/Discord integration for trial events
- [ ] Export trial events to analytics platform

### Long Term (3-6 months)
- [ ] ML model to predict payment likelihood
- [ ] Dynamic trial length based on engagement
- [ ] Personalized upgrade messaging
- [ ] Integration with CRM for sales follow-up

---

## Troubleshooting

### Issue: Setup Intent Creation Fails

**Symptom:** Error on payment screen, no Stripe UI
**Cause:** Missing or invalid Stripe keys
**Solution:**
1. Check `STRIPE_SECRET_KEY` is set in Supabase env
2. Verify key starts with `sk_test_` (test) or `sk_live_` (prod)
3. Check Supabase function logs for detailed error

### Issue: Payment Method Not Attaching

**Symptom:** Card entered but `has_payment_method` stays false
**Cause:** Setup Intent confirmation failed or webhook not received
**Solution:**
1. Check browser console for Stripe errors
2. Verify Stripe webhook endpoint configured
3. Check Supabase function logs for `confirm-payment-method` errors
4. Manually update DB if needed:
```sql
UPDATE accounts SET has_payment_method = true WHERE id = 'xxx';
```

### Issue: Limited Banner Not Showing

**Symptom:** Cardless user doesn't see banner
**Cause:** Component not mounted or wrong trial_type
**Solution:**
1. Check account record: `SELECT trial_type, has_payment_method FROM accounts WHERE id = 'xxx'`
2. Verify should be: `trial_type='cardless'` AND `has_payment_method=false`
3. Hard refresh browser to clear stale data
4. Check React component is imported in Onboarding.tsx

### Issue: Analytics Events Not Logging

**Symptom:** `trial_events` table empty
**Cause:** RPC function not found or permissions issue
**Solution:**
1. Verify migration ran: `SELECT * FROM trial_events LIMIT 1;`
2. Test RPC manually:
```sql
SELECT log_trial_event(
  'account-id',
  'test_event',
  '{"test": true}'::jsonb
);
```
3. Check edge function logs for errors

---

## Support

For questions or issues:
- **Code:** Check edge function logs in Supabase Dashboard
- **Database:** Run diagnostic queries above
- **Stripe:** Check Stripe Dashboard → Logs
- **Email:** support@getringsnap.com

---

**Last Updated:** 2025-11-07
**Version:** 1.0.0
**Author:** Claude (Anthropic)
