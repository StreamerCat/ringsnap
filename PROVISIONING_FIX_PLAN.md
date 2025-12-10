# Provisioning Process Audit & Fix Plan

## Current State Analysis

### ✅ What's Working
1. **Stripe Integration**: Customer and subscription creation successful
2. **Database Records**: Profile and account_member rows created
3. **Twilio Number**: Phone number successfully provisioned from Twilio
4. **Vapi Assistant**: Assistant created in Vapi

### ❌ What's Broken
1. **Phone Number NOT stored in database** (`phone_numbers` table)
2. **Phone Number NOT linked to Vapi Assistant** (assistant not receiving calls)
3. **Account table NOT updated** with phone number fields

## Root Cause Analysis

### Issue #1: Schema Mismatch in `phone_numbers` Insert
**Location**: `supabase/functions/provision-vapi/index.ts` lines 416-439

**Problem**: The code attempts to insert fields that don't exist in the schema:
- `vapi_id` (should be `vapi_phone_id`)
- `activated_at` (doesn't exist)
- `raw` (doesn't exist)
- `trial_expires_at` (doesn't exist)
- `phone_retention_expires_at` (doesn't exist)
- `provider` (doesn't exist)
- `provider_id` (doesn't exist)

**Actual Schema** (from migration `20251105190549`):
```sql
CREATE TABLE phone_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL UNIQUE,
  area_code TEXT NOT NULL,
  vapi_phone_id TEXT UNIQUE,
  label TEXT,
  purpose TEXT CHECK (purpose IN ('primary', 'secondary', 'spanish', 'overflow', 'after-hours')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'held', 'released')),
  held_until TIMESTAMPTZ,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Issue #2: Vapi Phone Import Payload
**Location**: `supabase/functions/provision-vapi/index.ts` lines 341-355

**Problem**: The phone number is being imported to Vapi with `assistantId` binding, but:
1. The binding might not be working correctly
2. No verification that the binding succeeded
3. No update to the assistant record to link it to the phone

## Happy State Requirements

### 1. Database State
- ✅ `accounts` table has:
  - `vapi_assistant_id` populated
  - `vapi_phone_number` populated (E.164 format)
  - `phone_number_e164` populated
  - `vapi_phone_number_id` populated
  - `phone_number_status` = 'active'
  - `phone_provisioned_at` timestamp

- ✅ `phone_numbers` table has a row with:
  - `account_id` linked
  - `phone_number` (E.164)
  - `area_code`
  - `vapi_phone_id` from Vapi
  - `purpose` = 'primary'
  - `status` = 'active'
  - `is_primary` = true

- ✅ `vapi_assistants` table has a row with:
  - `account_id` linked
  - `vapi_assistant_id` from Vapi
  - `config` JSON with full assistant details

### 2. Vapi State
- ✅ Assistant exists with correct prompt and voice
- ✅ Phone number exists and is linked to the assistant
- ✅ Phone number has correct fallback destination
- ✅ Incoming calls to the number route to the assistant

### 3. Twilio State
- ✅ Phone number purchased and active
- ✅ Number configured to forward to Vapi webhook

## Fix Implementation Plan

### Step 1: Fix Database Schema Insert
**File**: `supabase/functions/provision-vapi/index.ts`
**Lines**: 416-439

**Changes**:
```typescript
const { data: phoneRow, error: phoneDbError } = await supabase
  .from("phone_numbers")
  .insert({
    account_id: accountId,
    phone_number: finalNumber,
    area_code: requestedAreaCode,
    vapi_phone_id: vapiPhoneId,  // Fixed: was vapi_id
    purpose: "primary",
    status: "active",
    is_primary: true,
    // Removed: activated_at, raw, trial_expires_at, phone_retention_expires_at, provider, provider_id
  })
  .select("id")
  .single();
```

### Step 2: Verify Vapi Phone-Assistant Binding
**File**: `supabase/functions/provision-vapi/index.ts`
**After line 396** (after Vapi phone import)

**Add verification**:
```typescript
// Verify the phone is correctly bound to the assistant
const verifyResponse = await fetch(`${VAPI_BASE_URL}/phone-number/${vapiPhoneId}`, {
  method: "GET",
  headers: {
    "Authorization": `Bearer ${VAPI_API_KEY}`,
  },
});

if (verifyResponse.ok) {
  const phoneDetails = await verifyResponse.json();
  if (phoneDetails.assistantId !== vapiAssistantId) {
    logWarn("Phone-Assistant binding mismatch", {
      ...baseLogOptions,
      context: {
        expected: vapiAssistantId,
        actual: phoneDetails.assistantId
      }
    });
  }
}
```

### Step 3: Add Logging for Debugging
**Throughout the provisioning flow**

Add detailed logging at each step:
- After Twilio purchase
- After Vapi import
- After DB inserts
- After account updates

### Step 4: Test Plan
1. **Unit Test**: Test phone_numbers insert with correct schema
2. **Integration Test**: Full signup flow end-to-end
3. **Verification**: Query Vapi API to confirm phone-assistant binding
4. **Manual Test**: Make a test call to the provisioned number

## Deployment Strategy

1. Fix the schema mismatch (Step 1) - **CRITICAL**
2. Deploy to production
3. Test with a new signup
4. Add verification logic (Step 2) - **ENHANCEMENT**
5. Monitor logs for any remaining issues

## Success Criteria

- [ ] New signup creates phone_numbers row
- [ ] phone_numbers.vapi_phone_id is populated
- [ ] accounts.vapi_phone_number is populated
- [ ] Test call to number reaches the assistant
- [ ] Assistant responds with correct company name
- [ ] No errors in provisioning logs
