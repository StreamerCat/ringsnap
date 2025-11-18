# Rollback Reference - Signup Forms Modernization
## Date: 2025-11-18
## Session ID: 013qocYc4e6e9HCTtUR8Qi5F

---

## Purpose
This document serves as a reference point for rolling back signup form changes if needed. It captures the state of the system before modernization work began.

---

## Git State

### Current Branch
```
claude/modernize-signup-forms-013qocYc4e6e9HCTtUR8Qi5F
```

### Backup Branch (Local)
```
backup/forms-pre-update-20251118
```

### Recent Commits
```
f691afe Merge pull request #153 from StreamerCat/mprove-sales-signup-form
5016de4 feat: Enhance sales signup form UX and data model
b11f8d9 Merge pull request #152 from StreamerCat/claude/add-bot-secret-header-01XPEt9CDZaxH5JXSV721eSd
```

---

## Current Form Components

### 1. Homepage Self-Serve Trial Signup
**Component:** `/src/components/onboarding/SelfServeTrialFlow.tsx`
- 8-step modal dialog flow
- Steps: User Info → Business Basics → Business Advanced → Voice → Plan → Payment → Provisioning → Phone Ready
- Uses React Hook Form + Zod validation
- Integrated with Stripe Elements for payment
- Calls `free-trial-signup` edge function

### 2. Sales Signup Form
**Component:** `/src/components/SalesSignupForm.tsx` (822 lines)
- Single-page form with Card sections
- All fields visible at once
- Comprehensive business details collection
- Calls `create-sales-account` edge function
- Shows success modal after completion

### 3. Legacy Trial Signup
**Component:** `/src/components/signup/TrialSignupFlow.tsx`
- 4-step flow (may be deprecated)

---

## Current Form Fields

### Self-Serve Trial Flow
```typescript
{
  // Step 1: User Info
  name: string (required)
  email: string (required, email validation)
  phone: string (required, min 10 chars)

  // Step 2: Business Basics
  companyName: string (required)
  trade: string (required, dropdown)
  website: string (optional, URL)
  zipCode: string (required, 5 digits)

  // Step 3: Business Advanced
  primaryGoal: enum (optional)
  businessHours: string (optional)

  // Step 4: Voice
  assistantGender: enum['male', 'female'] (default: female)

  // Step 5: Plan
  planType: enum['starter', 'professional', 'premium']

  // Step 6: Payment
  // Stripe CardElement (creates paymentMethodId)
}
```

### Sales Signup Form
```typescript
{
  // Customer Info
  name: string (1-100 chars, required)
  email: string (valid email, max 255, required)
  phone: string (US phone format, required)
  companyName: string (1-200 chars, required)
  website: string (auto-formatted https://, required)
  trade: string (required, dropdown)

  // Business Details
  serviceArea: string (1-200 chars, required)
  businessHours: object (structured day/time format)
  emergencyPolicy: string (10-1000 chars, required)
  zipCode: string (5 digits, required)
  assistantGender: enum['male', 'female'] (default: female)
  referralCode: string (8 chars, optional)

  // Sales Config
  planType: enum['starter', 'professional', 'premium']
  salesRepName: string (1-100 chars, required)

  // Payment
  // Stripe CardElement (creates paymentMethodId)
}
```

---

## API Contracts

### Edge Function: free-trial-signup
**Endpoint:** `/supabase/functions/free-trial-signup/index.ts`

**Request Body:**
```typescript
{
  name: string
  email: string
  phone: string
  areaCode: string (3 digits)
  companyName?: string
  companyWebsite?: string
  trade?: string
  wantsAdvancedVoice?: boolean
  zipCode?: string
  assistantGender?: 'female' | 'male'
  referralCode?: string
  source?: string
  planType: 'starter' | 'professional' | 'premium'
  paymentMethodId: string
  deviceFingerprint?: string
}
```

**Response:**
```typescript
{
  ok: boolean
  user_id: string
  account_id: string
  email: string
  password: string (for auto-login)
  stripe_customer_id: string
  subscription_id: string
  trial_end_date: string
  plan_type: string
  message: string
}
```

**Process Flow:**
1. Validate phone number format
2. Check disposable email blacklist
3. IP rate limiting (3 trials per 30 days)
4. Phone number reuse check (30 days)
5. Create Supabase auth user
6. Create account record
7. Create profile record
8. Assign owner role
9. Create Stripe customer
10. Create Stripe subscription (3-day trial)
11. Queue async Vapi provisioning (background)
12. Log signup attempt
13. Return credentials for auto-login

### Edge Function: create-sales-account
**Endpoint:** `/supabase/functions/create-sales-account/index.ts`

**Request Body:**
```typescript
{
  customerInfo: {
    name: string
    email: string
    phone: string
    companyName: string
    website: string
    trade?: string
    serviceArea?: string
    businessHours?: object
    emergencyPolicy?: string
    salesRepName?: string
    planType: string
    zipCode?: string
    assistantGender?: 'female' | 'male'
    referralCode?: string
  }
  paymentMethodId: string
}
```

**Response:**
```typescript
{
  success: boolean
  userId: string
  accountId: string
  stripeCustomerId: string
  subscriptionId: string
  tempPassword: string
  subscriptionStatus: string
  ringSnapNumber: string | null
  provisioned: boolean
  provisioningMessage: string
}
```

**Process Flow:**
1. Create Stripe customer with metadata
2. Attach payment method to customer
3. Set default payment method
4. Create Stripe subscription (no trial, active immediately)
5. Verify subscription is active
6. Generate secure temp password
7. Create Supabase auth user (email confirmed)
8. Wait for database trigger or create account manually
9. Update account with sales-specific fields
10. Process referral code if provided
11. Queue async provisioning (background)
12. Return temp password and account info

### Edge Function: provision-resources
**Endpoint:** `/supabase/functions/provision-resources/index.ts`

**Request Body:**
```typescript
{
  accountId: string
  email: string
  name: string
  phone: string
  areaCode: string
  zipCode?: string
  company_name?: string
  trade?: string
  assistant_gender?: 'female' | 'male'
  wants_advanced_voice?: boolean
}
```

**Vapi API Calls:**
1. **Create Phone Number**
   - POST `https://api.vapi.ai/phone-number`
   - Body: `{ provider: 'vapi', name, fallbackDestination, numberDesiredAreaCode }`
   - Returns: `{ id, number }`

2. **Create Assistant**
   - POST `https://api.vapi.ai/assistant`
   - Body: `{ name, model, voice, firstMessage }`
   - Voice IDs: 'michael' (male), 'sarah' (female)
   - Returns: `{ id }`

3. **Link Phone to Assistant**
   - PATCH `https://api.vapi.ai/phone-number/{phoneId}`
   - Body: `{ assistantId }`

**Database Updates:**
1. Insert into `phone_numbers` table
2. Insert into `assistants` table
3. Update `accounts` table with provisioning results
4. Generate and insert referral code
5. Send welcome email via Resend

---

## Stripe Integration

### Customer Creation
```javascript
stripe.customers.create({
  email: string
  name: string
  phone: string
  payment_method: string (trial flow only)
  invoice_settings: { default_payment_method }
  metadata: {
    company_name: string
    source: string
    trade: string
    user_id: string
    sales_rep: string (sales flow only)
  }
})
```

### Subscription Creation
```javascript
stripe.subscriptions.create({
  customer: customerId
  items: [{ price: priceId }]
  trial_period_days: 3 (trial flow only)
  payment_behavior: 'default_incomplete' (trial) | undefined (sales)
  metadata: {
    user_id: string
    trial_signup: 'true' (trial only)
    sales_rep: string (sales only)
    plan_type: string
  }
})
```

### Price IDs (Environment Variables)
- `STRIPE_PRICE_STARTER` - $297/month (≤80 calls)
- `STRIPE_PRICE_PROFESSIONAL` - $797/month (≤160 calls)
- `STRIPE_PRICE_PREMIUM` - $1497/month (>160 calls)

### Webhooks
**Handler:** `/supabase/functions/stripe-webhook/index.ts`
- Processes subscription updates
- Handles payment events
- Updates account status

---

## Vapi Integration

### Phone Number Provisioning
- Provider: 'vapi'
- Area code selection from ZIP code lookup
- Fallback destination: user's phone number
- Linked to primary assistant

### Assistant Configuration
- Model: GPT-4o-mini (OpenAI)
- Voice Provider: 11labs
- Voice Options:
  - Female: 'sarah'
  - Male: 'michael'
- System prompt: Generated from business details
- First message: Dynamic greeting with company name

---

## Database Schema

### Tables Modified During Signup

**accounts**
```sql
- id (uuid, PK)
- company_name (text)
- company_domain (text)
- trade (text)
- subscription_status ('trial' | 'active' | 'past_due' | 'canceled')
- trial_start_date (timestamp)
- trial_end_date (timestamp)
- provisioning_status ('pending' | 'provisioning' | 'completed' | 'failed')
- stripe_customer_id (text)
- stripe_subscription_id (text)
- vapi_phone_number (text)
- vapi_assistant_id (text)
- phone_number_area_code (text)
- plan_type ('starter' | 'professional' | 'premium')
- sales_rep_name (text)
- service_area (text)
- business_hours (jsonb)
- emergency_policy (text)
- billing_state (text)
```

**profiles**
```sql
- id (uuid, PK, FK to auth.users)
- account_id (uuid, FK to accounts)
- name (text)
- phone (text)
- is_primary (boolean)
- source (text)
```

**user_roles**
```sql
- user_id (uuid, FK to auth.users)
- role ('owner' | 'manager' | 'staff')
```

**signup_attempts** (audit log)
```sql
- email (text)
- phone (text)
- ip_address (text)
- device_fingerprint (text)
- success (boolean)
- blocked_reason (text)
- created_at (timestamp)
```

---

## Email Notifications

### Service: Resend
- API Key: `RESEND_PROD_KEY`
- From Address: `welcome@getringsnap.com`

### Welcome Email (with phone number)
- Subject: "Your RingSnap line is live - start catching every call"
- Contains: Forwarding instructions (*72 command)
- Sent after successful provisioning

### Welcome Email (without phone number)
- Subject: "Your RingSnap account setup is underway"
- Fallback message while provisioning completes

---

## Rate Limiting

### IP-Based (Trial Signup Only)
- 3 successful signups per IP address per 30 days
- Tracked in `signup_attempts` table
- Returns 429 status code when exceeded

### Phone Number (Trial Signup Only)
- Phone number cannot be reused within 30 days
- Checked against `profiles.phone` creation date
- Returns 400 status code if reused

### Disposable Email Blocking
- Checks against blacklist of disposable domains
- Returns 400 status code if detected

---

## Validation Rules

### Email
- Must be valid email format
- Max 255 characters
- Not a disposable email domain (trial only)
- Case-insensitive duplicate check

### Phone
- US phone number format: (XXX) XXX-XXXX
- Regex: `/^(\+1[\s\-]?)?(\(?\d{3}\)?[\s\-]?)\d{3}[\s\-]?\d{4}$/`
- Auto-formatted on input
- 10 or 11 digits (with optional +1 prefix)

### ZIP Code
- Exactly 5 digits
- Regex: `/^\d{5}$/`
- Used for area code lookup

### Website
- Auto-formatted to include `https://`
- Accepts email format (extracts domain)
- Max 255 characters

### Company Name
- 1-200 characters
- Required for sales flow
- Optional for trial (auto-derived from email domain if not generic)

### Business Hours (Sales)
- Structured object format:
```typescript
{
  [day: string]: {
    open: boolean
    openTime: string  // "08:00"
    closeTime: string // "17:00"
  }
}
```

---

## Existing Helper Utilities

**Location:** `/src/components/signup/shared/utils.ts`

```typescript
// Email domain detection
isGenericEmail(email: string): boolean

// Extract company name from business email
extractCompanyNameFromEmail(email: string): string

// Phone number formatting
formatPhoneNumber(value: string): string

// Phone number validation
validatePhoneNumber(phone: string): boolean
```

**Generic Email Domains:**
- gmail.com, yahoo.com, hotmail.com, outlook.com
- icloud.com, aol.com, protonmail.com, mail.com
- live.com, msn.com, ymail.com

---

## Error Messages

### Trial Signup Errors
- 429: "Trial limit reached for this location. Please contact support."
- 400: "This phone number was recently used for a trial"
- 400: "Please use a valid business or personal email address" (disposable)
- 409: "This email is already registered. Please sign in instead."
- 400: "Invalid phone number format"

### Sales Signup Errors
- Zod validation errors (field-specific)
- Stripe errors (payment method, subscription)
- "Subscription not active. Status: {status}"
- "Missing credentials in account creation response"

---

## Rollback Procedures

### Quick Rollback (Code Only)
```bash
# Switch to backup branch
git checkout backup/forms-pre-update-20251118

# Create new main branch from backup
git checkout -b main-restored

# Force push if necessary (CAUTION)
git push origin main-restored --force
```

### Partial Rollback (Specific File)
```bash
# Restore single file from backup
git checkout backup/forms-pre-update-20251118 -- src/components/SalesSignupForm.tsx

# Restore directory
git checkout backup/forms-pre-update-20251118 -- src/components/onboarding/
```

### Full System Rollback
1. Restore code from backup branch
2. Verify all edge functions are unchanged
3. Check Stripe webhook configuration
4. Verify Vapi API credentials
5. Test signup flow end-to-end
6. Monitor error logs for 24 hours

---

## Dependencies Currently Installed

```json
{
  "react-hook-form": "^7.61.1",
  "zod": "^3.25.76",
  "@hookform/resolvers": "^3.10.0",
  "@stripe/react-stripe-js": "^5.3.0",
  "@stripe/stripe-js": "^8.3.0",
  "@tanstack/react-query": "^5.83.0",
  "sonner": "^1.7.4",
  "lucide-react": "^0.462.0"
}
```

---

## Key Files to Monitor

### Frontend Components
- `/src/components/SalesSignupForm.tsx`
- `/src/components/onboarding/SelfServeTrialFlow.tsx`
- `/src/components/signup/shared/schemas.ts`
- `/src/components/signup/shared/utils.ts`

### Edge Functions
- `/supabase/functions/free-trial-signup/index.ts`
- `/supabase/functions/create-sales-account/index.ts`
- `/supabase/functions/provision-resources/index.ts`
- `/supabase/functions/stripe-webhook/index.ts`

### Shared Utilities
- `/supabase/functions/_shared/logging.ts`
- `/supabase/functions/_shared/validators.ts`
- `/supabase/functions/_shared/area-code-lookup.ts`
- `/supabase/functions/_shared/template-builder.ts`

---

## Testing Checklist Before Rollback

- [ ] Test trial signup flow (full end-to-end)
- [ ] Test sales signup flow (full end-to-end)
- [ ] Verify Stripe customer creation
- [ ] Verify Stripe subscription creation
- [ ] Verify Vapi phone provisioning
- [ ] Verify Vapi assistant creation
- [ ] Check database records created correctly
- [ ] Test email delivery (Resend)
- [ ] Verify auto-login after trial signup
- [ ] Test error handling (invalid inputs, rate limits)
- [ ] Check webhook processing
- [ ] Monitor application logs

---

## Contact Information

**Session ID:** 013qocYc4e6e9HCTtUR8Qi5F
**Branch:** claude/modernize-signup-forms-013qocYc4e6e9HCTtUR8Qi5F
**Created:** 2025-11-18
**Backup Branch:** backup/forms-pre-update-20251118 (local only)

---

## Notes

- All changes will maintain backward compatibility with existing edge functions
- No database schema changes required
- Stripe and Vapi API contracts will remain unchanged
- Focus on UI/UX improvements and better validation messages
- Smart email detection utilities already exist and will be enhanced
