# Hybrid Onboarding Flow - Implementation Plan

## Phase 0: Discovery Summary

### Current Signup Flows
**Self-Serve Flow** (`SelfServeTrialFlow.tsx`):
- 8-step wizard: User Info → Business Basics → Business Advanced → Voice → Plan → Payment → Provisioning → Phone Ready
- Calls `create-trial` edge function with full payload
- Frontend polls for provisioning completion

**Sales-Guided Flow** (`SalesGuidedTrialFlow.tsx`):
- 5-step wizard: Combined Form → Plan → Payment → Provisioning → Phone Ready
- Also calls `create-trial` with `source='sales'`

### Current Edge Functions
1. **create-trial** (`/supabase/functions/create-trial/index.ts`)
   - Unified signup handler for both website and sales
   - Creates Stripe customer + subscription
   - Calls `create_account_transaction()` RPC (atomic)
   - Enqueues provisioning job
   - Returns account_id, temp password, provisioning_status='pending'

2. **provision-vapi** (`/supabase/functions/provision-vapi/index.ts`)
   - Async worker (30s cron)
   - Processes provisioning_jobs queue
   - Creates Vapi assistant + provisions phone
   - Updates accounts table with vapi_assistant_id, vapi_phone_number
   - Exponential backoff retry logic

### Current Schema (Relevant Tables)
**accounts**:
- Company-level data
- stripe_customer_id, stripe_subscription_id
- vapi_assistant_id, vapi_phone_number
- provisioning_stage, provisioning_status, provisioning_error
- assistant_gender ('male'|'female')
- company_name, trade, company_website
- service_area, business_hours, emergency_policy
- signup_channel ('website'|'sales')

**profiles**:
- User-level data (linked to auth.users)
- account_id (FK to accounts)
- name, phone
- is_primary, source

**provisioning_jobs**:
- Async job queue
- account_id, user_id, job_type, status, metadata
- retry_after (for exponential backoff)

### Shared Utilities (Reusable)
- `_shared/logging.ts` - Structured logging
- `_shared/auth-utils.ts` - Auth helpers, rate limiting
- `_shared/email-service.ts` - Email sending
- `_shared/template-builder.ts` - Vapi prompt generation
- `_shared/validators.ts` - Phone/email validation

### Key Insights
1. **Stripe logic**: In create-trial function, can be extracted to shared helper
2. **Vapi logic**: In provision-vapi function, can be reused
3. **Account creation**: Uses `create_account_transaction()` RPC (atomic)
4. **Provisioning pattern**: Already async via provisioning_jobs queue
5. **Auth pattern**: Supabase auth with useUser() hook

---

## Implementation Plan

### Phase 1: Data Model Extensions

#### 1.1 Add Booking Preferences to accounts table
```sql
ALTER TABLE accounts ADD COLUMN booking_mode TEXT DEFAULT 'sms_only' CHECK (booking_mode IN ('sms_only', 'direct_calendar'));
ALTER TABLE accounts ADD COLUMN default_appointment_duration_minutes INTEGER DEFAULT 60;
ALTER TABLE accounts ADD COLUMN calendar_provider TEXT CHECK (calendar_provider IN ('google', 'microsoft', 'apple', 'external_link', NULL));
ALTER TABLE accounts ADD COLUMN calendar_external_link TEXT;
ALTER TABLE accounts ADD COLUMN service_hours JSONB;
```

#### 1.2 Add Onboarding Status to profiles table
```sql
ALTER TABLE profiles ADD COLUMN onboarding_status TEXT DEFAULT 'not_started' CHECK (onboarding_status IN ('not_started', 'collecting', 'ready_to_provision', 'provisioning', 'active', 'provision_failed'));
```

#### 1.3 Add Assistant Config (if not exists in accounts)
```sql
-- Already have assistant_gender in accounts
ALTER TABLE accounts ADD COLUMN assistant_tone TEXT DEFAULT 'friendly' CHECK (assistant_tone IN ('formal', 'friendly', 'casual'));
ALTER TABLE accounts ADD COLUMN call_priority TEXT[] DEFAULT ARRAY['everything'];
```

**Files to modify:**
- Create new migration: `supabase/migrations/20251125_hybrid_onboarding_schema.sql`

---

### Phase 2: /start Route (Lightweight Signup)

**New files:**
- `src/pages/Start.tsx` - Main page component
- `src/components/start/StartSignupForm.tsx` - Simple email/password form

**Logic:**
1. Email + password signup using Supabase auth
2. On success:
   - Create profiles row (or ensure exists)
   - Create basic accounts row with minimal data
   - Set profiles.onboarding_status = 'not_started'
3. Redirect to /onboarding

**Reuse:**
- Supabase auth utilities from `src/lib/auth/`
- Existing form components and styling

**Route:** Add to `src/App.tsx`

---

### Phase 3: /onboarding Route (Scripted Chat Style)

**New files:**
- `src/pages/OnboardingChat.tsx` - Main chat page
- `src/components/onboarding-chat/ChatMessage.tsx` - Chat bubble component
- `src/components/onboarding-chat/ChatInput.tsx` - User input component
- `src/components/onboarding-chat/ChatButtons.tsx` - Button choices
- `src/components/onboarding-chat/ServiceHoursEditor.tsx` - Custom hours UI

**Chat Flow Steps:**
1. Welcome message
2. Ask business name → Save to accounts.company_name
3. Ask business website → Save to accounts.company_website (suggest from email domain)
4. Ask routing phone → Save to accounts (need column for destination_phone)
5. Ask service hours → Save to accounts.service_hours (preset buttons or custom)
6. Ask voice gender → Save to accounts.assistant_gender
7. Ask tone → Save to accounts.assistant_tone
8. Ask booking preference → Save to accounts.booking_mode
   - "Text me to confirm" → 'sms_only'
   - "Book directly (coming soon)" → 'direct_calendar' (with note)
   - Optionally collect calendar_external_link
9. Review summary
10. On confirm:
    - Set profiles.onboarding_status = 'ready_to_provision'
    - Call provision-account edge function
    - Redirect to /setup-status

**Implementation notes:**
- Deterministic flow (not LLM-driven)
- Each answer writes directly to Supabase
- Use existing Supabase client hooks
- Typing indicators for feel
- Consider using a lightweight chat UI library (e.g., react-chat-elements) OR build custom with existing components

**Dependencies to evaluate:**
- Check if we need a chat library or can build custom
- Prefer custom if simple enough

---

### Phase 4: /setup-status Route

**New files:**
- `src/pages/SetupStatus.tsx` - Main status page

**Logic:**
1. Fetch profiles.onboarding_status
2. Show state:
   - 'provisioning' → "Setting up your assistant..." (loading)
   - 'active' → "Ready! Here's your phone number: {vapi_phone_number}"
   - 'provision_failed' → "Something went wrong. [Retry Setup]"
3. Retry button:
   - Calls provision-account again
   - Sets status back to 'provisioning'

**Reuse:**
- Similar to existing `ProvisioningStatus.tsx` component
- Poll accounts table for updates

---

### Phase 5: provision-account Edge Function

**New files:**
- `supabase/functions/provision-account/index.ts` - Main function
- `supabase/functions/_shared/stripe-helpers.ts` - Extracted Stripe logic
- `supabase/functions/_shared/vapi-helpers.ts` - Extracted Vapi logic

**Input:**
```json
{
  "account_id": "uuid",
  "user_id": "uuid",
  "source": "trial"
}
```

**Logic:**
1. Load account, profile, config from DB
2. Validate required fields
3. Create Stripe customer (if not exists) using extracted helper
4. Create Stripe subscription using extracted helper
5. Create Vapi assistant using extracted helper
6. Provision Vapi phone using extracted helper
7. Update accounts with stripe_customer_id, stripe_subscription_id
8. Enqueue provisioning_jobs for async Vapi provisioning OR do inline
9. On success: Set profiles.onboarding_status = 'active'
10. On failure: Set profiles.onboarding_status = 'provision_failed'

**Extraction plan:**
- Extract Stripe customer creation from create-trial
- Extract Stripe subscription creation from create-trial
- Reuse Vapi assistant creation from provision-vapi
- Reuse Vapi phone provisioning from provision-vapi

**Error handling:**
- Detailed error codes and messages
- Log to provisioning_jobs with error_code, error_message
- Return safe error response to frontend

---

### Phase 6: Booking Flow Interface (SMS Only)

**New files:**
- `supabase/functions/booking-schedule/index.ts` - Booking endpoint
- `src/lib/sms.ts` - SMS helper (if not exists)

**Endpoint:** `POST /booking/schedule`

**Input:**
```json
{
  "account_id": "uuid",
  "customer_name": "string",
  "customer_phone": "string",
  "job_type": "string",
  "preferred_time_range": "string"
}
```

**Logic:**
1. Read accounts.booking_mode
2. If 'sms_only':
   - Store appointment request in new `appointments` table
   - Send SMS to account owner with proposed time
   - Include calendar_external_link if present
3. If 'direct_calendar':
   - For Phase 1: Same as sms_only with TODO comment
   - TODO: Add calendar integration here (Phase 2)
   - Log message: "Direct calendar booking not yet implemented"

**Schema addition:**
```sql
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id),
  customer_name TEXT,
  customer_phone TEXT,
  job_type TEXT,
  preferred_time_range TEXT,
  status TEXT DEFAULT 'pending_confirmation',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

### Phase 7: Wiring and Cutover

**Steps:**
1. Add /start, /onboarding, /setup-status to App.tsx routing
2. Update homepage CTAs to link to /start instead of opening modal
3. Add feature flag (env var or config):
   - `ENABLE_HYBRID_ONBOARDING=true`
   - If true: Direct to /start
   - If false: Use existing flow
4. Mark legacy flows:
   - Move SelfServeTrialFlow, SalesGuidedTrialFlow to `/src/components/onboarding/legacy/`
   - Add deprecation comments
5. Update /sales page:
   - Keep sales flow for now (or add toggle)
   - Later: Consider adapting to new flow

**Testing checklist:**
- [ ] New user signup at /start
- [ ] Complete onboarding chat at /onboarding
- [ ] Provisioning succeeds and shows in /setup-status
- [ ] Provisioning failure shows retry button
- [ ] SMS booking stores appointment and sends SMS
- [ ] Existing flows still work (if feature flag off)

---

## Files to Create

### Frontend
- [ ] `src/pages/Start.tsx`
- [ ] `src/pages/OnboardingChat.tsx`
- [ ] `src/pages/SetupStatus.tsx`
- [ ] `src/components/start/StartSignupForm.tsx`
- [ ] `src/components/onboarding-chat/ChatMessage.tsx`
- [ ] `src/components/onboarding-chat/ChatInput.tsx`
- [ ] `src/components/onboarding-chat/ChatButtons.tsx`
- [ ] `src/components/onboarding-chat/ServiceHoursEditor.tsx`

### Backend
- [ ] `supabase/functions/provision-account/index.ts`
- [ ] `supabase/functions/booking-schedule/index.ts`
- [ ] `supabase/functions/_shared/stripe-helpers.ts`
- [ ] `supabase/functions/_shared/vapi-helpers.ts`

### Database
- [ ] `supabase/migrations/20251125_hybrid_onboarding_schema.sql`

---

## Files to Modify

### Frontend
- [ ] `src/App.tsx` - Add new routes
- [ ] `src/pages/index.tsx` or homepage - Update CTA links

### Backend
- [ ] None (extract logic, don't modify existing functions)

---

## Dependencies to Add

**To evaluate:**
- Chat UI library (e.g., react-chat-elements, react-chat-ui) - OR build custom
- SMS library (if not already present)

**Prefer:**
- Build custom chat UI using existing components
- Use existing SMS mechanism if available

---

## Migration Strategy

1. **Phase 1-6**: Implement all new features alongside existing flows
2. **Phase 7**: Add feature flag, test thoroughly
3. **Cutover**: Enable feature flag for new users
4. **Monitor**: Watch for issues, keep legacy flows as fallback
5. **Deprecate**: After stable period, archive legacy flows

---

## Key Principles

✅ **DO:**
- Reuse existing helpers (logging, auth, validators)
- Extract shared Stripe/Vapi logic into _shared
- Keep schema changes minimal (add columns, don't drop)
- Use existing provisioning_jobs pattern
- Write deterministic chat flow (no LLM)
- Add clear TODO comments for Phase 2 calendar integration

❌ **DON'T:**
- Break existing signup flows
- Create duplicate tables for existing concepts
- Invent new env variables without documenting
- Do massive rewrites
- Add dependencies without evaluation

---

## Next Steps

1. ✅ Phase 0 complete: Discovery done
2. → Phase 1: Create database migration
3. → Phase 2: Implement /start route
4. → Phase 3: Implement /onboarding chat route
5. → Phase 4: Implement /setup-status route
6. → Phase 5: Create provision-account function
7. → Phase 6: Create booking-schedule endpoint
8. → Phase 7: Wire up and test end-to-end
