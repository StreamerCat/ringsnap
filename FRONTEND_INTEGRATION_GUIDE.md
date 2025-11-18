# Frontend Integration Guide for Lead Capture System

## Overview

The backend regression fixes have been deployed. Now the frontend needs updates to use the new lead capture system. This guide provides step-by-step instructions and code examples.

## Current Status ✅

**Backend (Deployed):**
- ✅ `signup_leads` table created with RLS policies
- ✅ `create-trial` edge function accepts `leadId` parameter
- ✅ Lead linking logic implemented
- ✅ Schema mismatches fixed (phone_number_status, billing_state, zip_code)

**Frontend (Needs Updates):**
- ❌ Homepage trial signup (TrialSignupFlow.tsx) - not using lead capture
- ❌ Sales signup wizard (SalesSignupWizard.tsx) - not using lead capture

---

## Step 1: Test Current Deployment (Optional but Recommended)

Before making frontend changes, verify the backend is working:

### Test 1: Verify signup_leads table exists

```sql
-- Run in Supabase SQL Editor
SELECT * FROM public.signup_leads LIMIT 1;
```

### Test 2: Test lead capture manually

```javascript
// Run in browser console on your site
const { data, error } = await supabase
  .from('signup_leads')
  .insert({
    email: 'test@example.com',
    full_name: 'Test User',
    phone: '(555) 123-4567',
    source: 'website',
    signup_flow: 'trial'
  })
  .select()
  .single();

console.log('Lead created:', data, error);
```

**Expected result:** Should succeed without 403 error.

### Test 3: Test create-trial with existing code

Try a full signup with the current code. You should NOT see:
- ❌ 403 error on signup_attempts
- ❌ 400 error on accounts insert

You might still see issues if the frontend is passing bad data, but the backend is now more robust.

---

## Step 2: Update Homepage Trial Signup

**File:** `src/components/signup/TrialSignupFlow.tsx`

### Changes Required:

1. Add state to store lead ID
2. Insert into signup_leads after step 1 validation
3. Pass leadId to create-trial edge function

### Code Changes:

#### Change 1: Add state variable (after line 56)

```typescript
const [currentStep, setCurrentStep] = useState(1);
const [isSubmitting, setIsSubmitting] = useState(false);
const [cardComplete, setCardComplete] = useState(false);
const [cardError, setCardError] = useState<string | null>(null);
const [showCompanyName, setShowCompanyName] = useState(false);
const [leadId, setLeadId] = useState<string | null>(null); // ADD THIS LINE
```

#### Change 2: Modify handleNext to capture lead after step 1 (replace lines 136-145)

```typescript
const handleNext = async (skipValidation = false) => {
  if (!skipValidation) {
    const isValid = await validateStep(currentStep);
    if (!isValid) {
      toast.error("Please complete all required fields");
      return;
    }
  }

  // STEP 1: Capture lead after validation
  if (currentStep === 1 && !leadId) {
    try {
      console.log("📝 Capturing lead for step 1...");
      const { data: lead, error: leadError } = await supabase
        .from("signup_leads")
        .insert({
          email: form.getValues("email"),
          full_name: form.getValues("name"),
          phone: form.getValues("phone"),
          source: source,
          signup_flow: "trial",
          ip_address: null, // Could add IP detection if needed
          user_agent: navigator.userAgent,
        })
        .select()
        .single();

      if (leadError) {
        console.error("❌ Lead capture failed:", leadError);
        toast.error("Failed to save your information. Please try again.");
        return;
      }

      console.log("✅ Lead captured:", lead.id);
      setLeadId(lead.id);
      toast.success("Information saved!");
    } catch (err) {
      console.error("❌ Lead capture error:", err);
      toast.error("Failed to save your information. Please try again.");
      return;
    }
  }

  setCurrentStep(prev => prev + 1);
};
```

#### Change 3: Pass leadId to create-trial (modify line 202 in requestBody)

```typescript
// Prepare request body - matching create-trial schema
const requestBody = {
  name: form.getValues("name"),
  email: form.getValues("email"),
  phone: form.getValues("phone"),
  companyName: form.getValues("companyName"),
  website: form.getValues("companyWebsite") || "",
  trade: form.getValues("trade") || "",
  zipCode: extractedAreaCode + "00", // Convert 3-digit area code to 5-digit zip (approximation)
  planType: form.getValues("planType"),
  paymentMethodId: paymentMethod.id,
  source,
  assistantGender: "female",
  wantsAdvancedVoice: false,
  leadId: leadId, // ADD THIS LINE
};
```

---

## Step 3: Update Sales Signup Wizard

**File:** `src/components/wizard/SalesSignupWizard.tsx`

### Changes Required:

1. Add state to store lead ID
2. Insert into signup_leads after BusinessEssentials step validation
3. Pass leadId to create-trial edge function

### Code Changes:

#### Change 1: Add state variable (after line 36)

```typescript
const [currentStep, setCurrentStep] = useState<WizardStep>(WizardStep.BusinessEssentials);
const [isSubmitting, setIsSubmitting] = useState(false);
const [cardComplete, setCardComplete] = useState(false);
const [cardError, setCardError] = useState<string | null>(null);
const [leadId, setLeadId] = useState<string | null>(null); // ADD THIS LINE
```

#### Change 2: Update handleNext to capture lead after first step (replace lines 150-160)

```typescript
const handleNext = async () => {
  const isValid = await validateStep(currentStep);
  if (!isValid) return;

  // Capture lead after BusinessEssentials step
  if (currentStep === WizardStep.BusinessEssentials && !leadId) {
    try {
      console.log("📝 Capturing lead for sales signup...");
      const { data: lead, error: leadError } = await supabase
        .from("signup_leads")
        .insert({
          email: form.getValues("customerEmail"),
          full_name: form.getValues("customerName"),
          phone: form.getValues("customerPhone"),
          source: "sales",
          signup_flow: "sales",
          ip_address: null,
          user_agent: navigator.userAgent,
        })
        .select()
        .single();

      if (leadError) {
        console.error("❌ Lead capture failed:", leadError);
        toast.error("Failed to save lead information. Please try again.");
        return;
      }

      console.log("✅ Sales lead captured:", lead.id);
      setLeadId(lead.id);
      toast.success("Customer information saved!");
    } catch (err) {
      console.error("❌ Lead capture error:", err);
      toast.error("Failed to save lead information. Please try again.");
      return;
    }
  }

  // Special handling for payment step
  if (currentStep === WizardStep.Payment) {
    await handlePayment();
  } else {
    setCurrentStep((prev) => Math.min(prev + 1, WizardStep.SetupComplete));
  }
};
```

#### Change 3: Pass leadId to create-trial (add to body around line 199)

```typescript
// Call edge function to create account - using unified create-trial with source='sales'
const { data, error } = await supabase.functions.invoke("create-trial", {
  body: {
    // Required fields
    name: form.getValues("customerName"),
    email: form.getValues("customerEmail"),
    phone: form.getValues("customerPhone"),
    companyName: form.getValues("companyName"),
    trade: form.getValues("trade"),
    zipCode: form.getValues("zipCode"),
    planType: form.getValues("planType"),
    paymentMethodId: paymentMethod.id,

    // Source tracking (CRITICAL)
    source: 'sales',
    salesRepName: form.getValues("salesRepName"),

    // Lead linking
    leadId: leadId, // ADD THIS LINE

    // Optional business details
    serviceArea: form.getValues("serviceArea") || "",
    businessHours: JSON.stringify(parseBusinessHours(form.getValues("businessHours"))),
    emergencyPolicy: form.getValues("emergencyPolicy") || "",

    // Assistant configuration
    assistantGender: form.getValues("assistantGender") || "female",
    wantsAdvancedVoice: false,
  },
});
```

---

## Step 4: Test the Integration

### Test Checklist:

**Homepage Trial Signup:**
1. ✅ Open homepage trial signup modal
2. ✅ Fill in step 1 (name, email, phone) and click Continue
3. ✅ Verify in Supabase: Check `signup_leads` table for new row
4. ✅ Complete all steps and submit
5. ✅ Verify in Supabase: Check that lead row has `auth_user_id`, `account_id`, `profile_id`, and `completed_at` filled
6. ✅ Verify Stripe customer and subscription created
7. ✅ Verify Vapi assistant created
8. ✅ Verify phone number shows "pending" status (async)

**Sales Signup Wizard:**
1. ✅ Navigate to /sales page
2. ✅ Fill in BusinessEssentials step and click Continue
3. ✅ Verify in Supabase: Check `signup_leads` table for new row with source='sales'
4. ✅ Complete all wizard steps
5. ✅ Submit payment
6. ✅ Verify lead linking completed
7. ✅ Verify account, Stripe, and Vapi resources created

### SQL Queries for Verification:

```sql
-- Check recent leads
SELECT
  id,
  email,
  full_name,
  source,
  signup_flow,
  created_at,
  completed_at,
  auth_user_id,
  account_id
FROM signup_leads
ORDER BY created_at DESC
LIMIT 10;

-- Check lead-to-account linking
SELECT
  sl.email as lead_email,
  sl.created_at as lead_created,
  sl.completed_at as lead_completed,
  a.id as account_id,
  a.company_name,
  a.provisioning_status,
  a.phone_number_status
FROM signup_leads sl
LEFT JOIN accounts a ON sl.account_id = a.id
WHERE sl.id = 'YOUR_LEAD_ID_HERE';

-- Check accounts with their relationships
SELECT
  a.id,
  a.company_name,
  a.provisioning_status,
  a.phone_number_status,
  a.billing_state,
  a.zip_code,
  p.full_name as profile_name,
  va.vapi_assistant_id
FROM accounts a
LEFT JOIN profiles p ON a.primary_profile_id = p.id
LEFT JOIN vapi_assistants va ON a.id = va.account_id
ORDER BY a.created_at DESC
LIMIT 5;
```

---

## Step 5: Monitor for Issues

### Common Issues and Solutions:

**Issue: 403 on signup_leads insert**
- **Cause:** RLS policy might not be set up correctly
- **Solution:** Verify RLS policy exists with:
  ```sql
  SELECT * FROM pg_policies WHERE tablename = 'signup_leads';
  ```
- **Fix:** Rerun migration `20251118000001_create_signup_leads.sql`

**Issue: Lead not being linked (completed_at is null)**
- **Cause:** leadId not being passed to create-trial
- **Solution:** Check browser console logs for "leadId" in the request body
- **Fix:** Ensure leadId is being passed in requestBody

**Issue: Still getting 400 on accounts insert**
- **Cause:** Frontend might be passing invalid data (e.g., wrong zipCode format)
- **Solution:** Check browser console for detailed error from create-trial
- **Fix:** Ensure zipCode is 5 digits (at least 3 digits + "00")

**Issue: Phone number not provisioning**
- **Cause:** This is expected - phone provisioning is asynchronous
- **Timeline:** Should complete within 1-2 minutes
- **Check:** Query `accounts` table for `phone_number_status` changing from "pending" to "active"

---

## Step 6: Optional Enhancements

### Display Phone Provisioning Status (Future)

If you want to show users when their phone number is ready:

```typescript
// In dashboard component
const [account, setAccount] = useState<any>(null);

useEffect(() => {
  // Subscribe to account changes
  const channel = supabase
    .channel('account-changes')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'accounts',
      filter: `id=eq.${accountId}`,
    }, (payload) => {
      console.log('Account updated:', payload.new);
      setAccount(payload.new);

      // Show toast when phone is ready
      if (payload.new.phone_number_status === 'active') {
        toast.success('Your phone number is now active!');
      }
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [accountId]);

// Display status
{account?.phone_number_status === 'pending' && (
  <div className="text-yellow-600">
    Phone number is being provisioned (1-2 minutes)...
  </div>
)}
{account?.phone_number_status === 'active' && (
  <div className="text-green-600">
    Phone: {account.vapi_phone_number}
  </div>
)}
```

### Add IP Address Tracking

```typescript
// Add this utility function
async function getUserIP(): Promise<string | null> {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch {
    return null;
  }
}

// Use in lead capture
const ip_address = await getUserIP();
const { data: lead, error: leadError } = await supabase
  .from("signup_leads")
  .insert({
    // ... other fields
    ip_address: ip_address,
  })
  .select()
  .single();
```

---

## Summary

### What Was Fixed (Backend - Already Deployed):
1. ✅ Created `signup_leads` table for step 1 lead capture
2. ✅ Fixed schema mismatches in `create-trial` edge function
3. ✅ Added lead linking mechanism
4. ✅ Split Vapi provisioning (assistant sync, phone async)

### What Needs to Be Done (Frontend - Your Next Steps):
1. ❌ Update `TrialSignupFlow.tsx` to capture leads and pass leadId
2. ❌ Update `SalesSignupWizard.tsx` to capture leads and pass leadId
3. ❌ Test both signup flows end-to-end
4. ❌ Verify lead linking works correctly
5. ❌ (Optional) Add phone status display in dashboard

### Files to Modify:
- `src/components/signup/TrialSignupFlow.tsx`
- `src/components/wizard/SalesSignupWizard.tsx`

### Expected Timeline:
- Frontend changes: 1-2 hours
- Testing: 30 minutes - 1 hour
- Total: 1.5 - 3 hours

Good luck! Let me know if you hit any issues during implementation.
