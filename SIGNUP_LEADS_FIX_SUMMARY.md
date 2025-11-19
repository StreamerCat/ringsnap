# Signup Leads & Trial Validation Fix Summary

## Issues Fixed

### 1. **Zod Validation Error for `leadId`**
**Problem**: Frontend was sending `leadId: null` but Zod schema expected `string.uuid()`, causing validation failure with error: `invalid_type: expected string, received null`.

**Solution**:
- Changed schema from `z.string().uuid().nullable().optional()` to `z.union([z.string().uuid(), z.null(), z.undefined()]).optional()`
- Added `normalizePayload()` helper that converts `null` or `""` to `undefined` for all optional fields
- This ensures clean handling of missing/null/empty values

**Location**: `supabase/functions/create-trial/index.ts:94`

### 2. **signup_leads Insert Failures (400 PGRST204)**
**Problem**: Frontend components were trying to insert into `signup_leads` table which may not exist or have incorrect RLS policies.

**Solution**:
- Verified migration file exists: `supabase/migrations/20251118000001_create_signup_leads.sql`
- Migration creates table with correct schema and RLS policies allowing anonymous inserts
- All three signup components use correct field names: `email`, `full_name`, `phone`, `source`, `signup_flow`, `ip_address`, `user_agent`

**Components affected**:
- `src/components/wizard/SalesSignupWizard.tsx` (line 158-166)
- `src/components/signup/TrialSignupFlow.tsx` (line 149-157)
- `src/components/onboarding/SelfServeTrialFlow.tsx` (line 137-145)

### 3. **Enhanced Logging**
**Added comprehensive logging at key checkpoints**:
- Raw request body logged with correlation ID (line 243-252)
- Payload validation success (line 285-293)
- All major steps already had logging:
  - Stripe customer created (line 409-416)
  - Stripe subscription created (line 473-481)
  - Auth user created (line 547-550)
  - Account created (line 641-645)
  - Profile created (line 729-732)
  - Vapi assistant created (line 864-868)

## Code Changes

### `supabase/functions/create-trial/index.ts`

1. **Updated Zod Schema** (line 94):
```typescript
leadId: z.union([z.string().uuid(), z.null(), z.undefined()]).optional()
```

2. **Added normalizePayload Helper** (lines 97-114):
```typescript
function normalizePayload(rawPayload: any): any {
  const normalized = { ...rawPayload };
  const optionalFields = ['leadId', 'referralCode', 'deviceFingerprint', ...];
  for (const field of optionalFields) {
    if (normalized[field] === null || normalized[field] === "") {
      normalized[field] = undefined;
    }
  }
  return normalized;
}
```

3. **Enhanced Request Validation** (lines 240-293):
- Log raw request body before parsing
- Apply normalizePayload before Zod validation
- Log validation success with key fields
- Include leadId status in logs

## Database Migration Status

**Migration File**: `supabase/migrations/20251118000001_create_signup_leads.sql`

**To Apply Migration**:
```bash
# Option 1: Using Supabase CLI
npx supabase db push --linked

# Option 2: Via Supabase Dashboard
# Copy contents of migration file and run in SQL Editor

# Option 3: Direct script
bash apply-signup-leads-migration.sh
```

**Migration Creates**:
- `signup_leads` table with fields:
  - `id`, `email` (NOT NULL), `full_name`, `phone`
  - `source`, `signup_flow`, `ip_address`, `user_agent`
  - `auth_user_id`, `account_id`, `profile_id` (for linking after signup)
  - `completed_at` (timestamp when converted)

- RLS Policies:
  - ✅ Anonymous users can INSERT (for step-1 lead capture)
  - ✅ Authenticated users can INSERT
  - ✅ Users can SELECT their own leads
  - ✅ Staff can SELECT all leads
  - ✅ Service role has full access

## How to Interpret Logs

### Success Flow Logs

1. **Raw Request Received**:
```json
{
  "message": "Raw request body received",
  "email": "user@example.com",
  "source": "website",
  "planType": "professional",
  "leadId": null,
  "hasPaymentMethod": true
}
```

2. **Payload Validated**:
```json
{
  "message": "Payload validated successfully",
  "email": "user@example.com",
  "source": "website",
  "planType": "professional",
  "hasLeadId": false
}
```

3. **Checkpoint Logs** (in order):
   - Stripe customer created
   - Payment method attached
   - Stripe subscription created
   - Auth user created
   - Account created
   - Profile created
   - Owner role assigned
   - Lead linked (if `hasLeadId: true`)
   - Vapi assistant created (if enabled)
   - Phone provisioned (if enabled)

### Error Scenarios

#### leadId Validation Error (FIXED)
**Before**:
```json
{
  "error": "Invalid input data",
  "details": [
    {
      "path": ["leadId"],
      "message": "Expected string, received null"
    }
  ]
}
```

**After**: No error - `null` is normalized to `undefined` and validation passes

#### signup_leads Insert Error
**Error**:
```
[signup step 1] signup_leads insert failed
error: { code: "PGRST204", message: "..." }
```

**Causes**:
1. Table doesn't exist → Run migration
2. RLS policy blocks insert → Check policies (should allow anonymous)
3. Missing required field → Check `email` is provided (NOT NULL)

**Non-blocking**: All three signup components treat lead capture as optional and continue signup even if it fails

## Testing Checklist

### Pre-deployment
- [x] Zod schema accepts `null` for leadId
- [x] normalizePayload converts `null`/`""` to `undefined`
- [x] Raw request body logged with correlation ID
- [x] Checkpoint logs at major steps
- [x] Lead linking skipped when leadId is null/undefined
- [ ] Migration applied to database

### End-to-End Test (Step 1: Lead Capture)

**Test Case**: Homepage signup wizard - step 1
1. Fill in name, email, phone
2. Click "Continue"
3. **Expected**:
   - Console log: `[signup step 1] Inserting into signup_leads`
   - Supabase request: `POST /rest/v1/signup_leads` returns 201
   - Console log: `signup_leads created successfully`
   - New row in `signup_leads` table with status `completed_at: null`

**If Error 400 PGRST204**:
- Check migration has been applied
- Check RLS policies allow anonymous insert
- Check payload includes required `email` field

### End-to-End Test (Full Signup)

**Test Case**: Complete trial signup with lead linking
1. Complete step 1 (captures lead)
2. Complete business details
3. Select plan
4. Enter payment
5. Submit signup
6. **Expected**:
   - Edge function logs show `leadId` value (UUID from step 1)
   - No validation error for leadId
   - Account, profile, Stripe customer/subscription created
   - Lead row updated with `auth_user_id`, `account_id`, `completed_at`

**Test Case**: Complete trial signup without lead
1. Send `leadId: null` in request body
2. **Expected**:
   - No validation error
   - Log shows `hasLeadId: false`
   - Log shows "No leadId provided, skipping lead linkage"
   - Account created successfully

## Rollback Plan

If issues occur:
1. **Validation errors**: Revert Zod schema change (line 94)
2. **signup_leads errors**: Remove RLS policy for anonymous inserts
3. **Logging overhead**: Remove raw body logging (lines 243-252)

## Future Improvements

1. **IP Address Capture**: Currently set to `null`, could capture real IP from headers
2. **Lead Conversion Tracking**: Analytics on lead → customer conversion rates
3. **Abandoned Cart Recovery**: Email users who completed step 1 but didn't finish signup
4. **Lead Scoring**: Score leads based on completion progress and engagement

## Support

**If signup_leads errors persist**:
1. Check Supabase logs: Dashboard → Logs → Filter for "signup_leads"
2. Verify migration applied: Dashboard → Database → Tables → Look for "signup_leads"
3. Check RLS policies: Dashboard → Database → signup_leads → Policies
4. Test direct insert via SQL Editor:
```sql
INSERT INTO public.signup_leads (email, full_name, phone, source, signup_flow)
VALUES ('test@example.com', 'Test User', '555-1234', 'website', 'trial');
```

**If leadId validation errors persist**:
1. Check Edge Function logs for exact error details
2. Verify `normalizePayload` is being called before validation
3. Check if frontend is sending leadId in correct format (UUID or null)
