# Signup Field Split Analysis - Step 1 vs Step 2

## Overview
This document defines the field split between Step 1 (Trial Creation) and Step 2 (Assistant Configuration) based on analysis of the canonical `create-trial` function and provisioning logic.

---

## STEP 1: Trial Creation (Minimum Required Fields)

**Purpose**: Create Supabase user + account + profile + Stripe customer + subscription

**Route**: `/start`

**Required Fields** (validated by `create-trial` Zod schema):
1. **name** - User's full name (for auth user and profile)
2. **email** - Email address (for auth user and Stripe customer)
3. **phone** - Phone number (validated format, anti-abuse check)
4. **companyName** - Business name (for account record and Stripe metadata)
5. **trade** - Primary service type (e.g., "plumbing", "HVAC", "electrical")
6. **paymentMethodId** - Stripe payment method ID (from Stripe CardElement)

**Auto-filled/Defaulted Fields**:
- **planType** - Defaults to `"starter"` (can be upgraded later)
- **source** - Set to `"website"` for self-serve signups
- **leadId** - Optional, if user came from lead capture

**Optional but Beneficial for Step 1**:
- **zipCode** - Used for billing_state and area_code (has fallback to "CA"/"415")
- **website** - Business website (can be inferred from email domain)

**What Happens After Step 1**:
- Stripe customer + subscription created
- Account, profile, and user roles created atomically via `create_account_transaction`
- Provisioning job queued with status `"queued"`
- User redirected to Step 2 (`/onboarding-chat`)

---

## STEP 2: Assistant Configuration

**Purpose**: Collect additional context for AI assistant provisioning

**Route**: `/onboarding-chat`

**Fields to Collect** (all optional, have defaults):
1. **businessHours** - Operating hours (default: "Monday-Friday 8am-5pm")
2. **emergencyPolicy** - After-hours/emergency handling (default: "Available 24/7 for emergencies")
3. **serviceArea** - Geographic service area description
4. **assistantGender** - Voice gender preference (default: "female")
5. **primaryGoal** - Main assistant objective: `book_appointments | capture_leads | answer_questions | take_orders`
6. **wantsAdvancedVoice** - Premium voice cloning option (default: false)
7. **booking_mode** - How appointments are booked: `sms_only | direct_calendar` (default: "sms_only")
8. **calendar_provider** - If direct booking: `google | microsoft | apple | external_link`
9. **calendar_external_link** - External booking URL (e.g., Calendly)
10. **assistant_tone** - Personality: `formal | friendly | casual` (default: "friendly")
11. **call_priority** - Array of priorities: `['new_leads', 'existing_customers', 'emergencies', 'everything']`
12. **destination_phone** - Phone number for call routing/transfers

**What Happens After Step 2**:
- Fields stored in `accounts` table via update
- Provisioning job metadata enriched
- Worker processes provisioning (creates Vapi assistant + phone number)
- User redirected to `/setup-status` or `/dashboard`

---

## Provisioning Job Metadata Structure

Fields from Step 1 used in provisioning:
```json
{
  "company_name": "from Step 1",
  "trade": "from Step 1",
  "area_code": "from Step 1 zipCode",
  "fallback_phone": "from Step 1 phone"
}
```

Fields from Step 2 enriching provisioning:
```json
{
  "service_area": "from Step 2",
  "business_hours": "from Step 2",
  "emergency_policy": "from Step 2",
  "company_website": "from Step 1 or Step 2",
  "assistant_gender": "from Step 2",
  "wants_advanced_voice": "from Step 2",
  "primary_goal": "from Step 2"
}
```

---

## Data Normalization Requirements

### Website Normalization (Step 1)
- **Input**: `acmeplumbing.com` or `owner@acmeplumbing.com`
- **Output**: `https://acmeplumbing.com`
- **Logic**:
  - If website provided, ensure `https://` protocol
  - If email domain is non-free (not gmail/yahoo/etc), infer website from domain

### Phone Normalization (Step 1)
- **Validation**: US format via `isValidPhoneNumber()` in `_shared/validators.ts`
- **Storage**: Normalized format (no validation transformation needed)

### Trade Normalization (Step 1 or Step 2)
- **Input**: `"plumbin"`, `"HVAC tech"`, `"electrical contractor"`
- **Output**: Canonical trade names: `"plumbing"`, `"HVAC"`, `"electrical"`
- **Logic**: Fuzzy matching to canonical list

### Business Hours Normalization (Step 2)
- **Input**: `"m-f 8-5"`, `"Mon-Fri 8am-5pm"`, `"24/7"`
- **Output**: JSON structure or clean text format
- **Logic**: Parse common formats into structured data

---

## Backend Functions Used

### Step 1
- **Edge Function**: `supabase/functions/create-trial/index.ts`
- **RPC Function**: `create_account_transaction()` (atomic account creation)
- **Tables**: `accounts`, `profiles`, `user_roles`, `provisioning_jobs`, `signup_attempts`

### Step 2
- **Update Function**: Standard Supabase update on `accounts` table
- **Tables**: `accounts` (update existing record)
- **Provisioning Worker**: `supabase/functions/provision-vapi/index.ts` (async)

---

## Frontend Components

### Step 1 Component
- **Path**: `src/pages/Start.tsx` (NEW - to be completely rewritten)
- **Features**:
  - Minimal form with 6 required fields
  - Stripe CardElement integration for payment
  - Website inference from email domain
  - Form validation before submission
  - Calls `create-trial` edge function
  - Redirects to `/onboarding-chat` on success

### Step 2 Component
- **Path**: `src/pages/OnboardingChat.tsx` (UPDATE - enhance for Step 2)
- **Features**:
  - AI-assisted chat interface for collecting configuration
  - Smart defaults for all fields
  - Can skip optional fields
  - Updates `accounts` table directly
  - Triggers provisioning status check
  - Redirects to `/setup-status` on completion

---

## Benefits of This Split

1. **Faster Time-to-Account**: Step 1 takes < 2 minutes vs 5-10 minutes for combined flow
2. **Better Conversion**: Users don't abandon due to form fatigue
3. **Clear Progress**: Two distinct phases with clear purpose
4. **Payment Confidence**: Payment captured early, before detailed config
5. **Flexibility**: Users can configure assistant later if they want to test quickly
6. **Provisioning Decoupled**: Assistant config doesn't block account creation
7. **Progressive Disclosure**: Complex options revealed after commitment

---

## Migration Path

1. **Phase 1** (This PR):
   - Archive `index-v2.ts` ✅
   - Rewrite `/start` for Step 1
   - Update `/onboarding-chat` for Step 2
   - Wire all "Start Free" CTAs to `/start`
   - Clean up duplicate signup routes

2. **Phase 2** (Future):
   - A/B test different field ordering in Step 2
   - Add "Skip for now" option in Step 2
   - Auto-populate fields from business website scraping
   - Add progress indicator across both steps

---

## Testing Checklist

- [ ] Step 1 creates account with minimal fields
- [ ] Step 1 captures payment method correctly
- [ ] Website normalization works (protocol, email inference)
- [ ] Step 1 redirects to Step 2 after success
- [ ] Step 2 loads existing account data
- [ ] Step 2 updates account fields correctly
- [ ] Step 2 triggers provisioning worker
- [ ] Provisioning worker uses fields from both steps
- [ ] All "Start Free" CTAs route to `/start`
- [ ] Legacy routes redirect appropriately
- [ ] Error handling works at each step
- [ ] User can log out and resume Step 2 later
