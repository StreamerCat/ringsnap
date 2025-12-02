# Signup Routes Consolidation Plan

## Current Route Situation (Before Cleanup)

### Active Routes:
1. **`/start`** → `Start.tsx` ✅ **CANONICAL Step 1**
   - New minimal signup page with Stripe payment
   - Collects: name, email, phone, company, trade, zipCode, website
   - Calls `create-trial` edge function
   - Redirects to `/onboarding-chat` on success

2. **`/onboarding-chat`** → `OnboardingChat.tsx` ✅ **CANONICAL Step 2**
   - AI-assisted assistant configuration
   - Should collect Step 2 fields (business hours, emergency policy, etc.)
   - Currently needs updating for new flow

3. **`/setup-status`** → `SetupStatus.tsx` ✅ **CANONICAL Status Page**
   - Shows provisioning job status
   - Used after Step 2 completion

### Legacy/Duplicate Routes (Need Cleanup):
4. **`/signup`** → `AISignupWrapper.tsx` ❌ **DUPLICATE/LEGACY**
   - Old AI signup modal wrapper
   - Should redirect to `/start`

5. **`/signup/form`** → `Onboarding.tsx` ❌ **DUPLICATE/LEGACY**
   - Old form-based onboarding
   - Should redirect to `/start`

6. **`/onboarding`** → `Onboarding.tsx` ❌ **DUPLICATE/LEGACY**
   - Duplicate route to same component as `/signup/form`
   - Should redirect to `/onboarding-chat`

## Canonical Flow (Target State)

```
User clicks "Start Free" CTA
  ↓
/start (Step 1: Trial Creation)
  - Minimal form + Stripe payment
  - Create account, profile, Stripe subscription
  ↓
/onboarding-chat (Step 2: Assistant Configuration)
  - AI-assisted config for business hours, routing, etc.
  - Updates account table
  - Triggers provisioning
  ↓
/setup-status (Provisioning Status)
  - Shows Vapi + phone number provisioning progress
  - Redirects to /dashboard when complete
  ↓
/dashboard (Main App)
```

## Implementation Plan

### Phase 1: Create Redirect Components ✅ NEXT
Create thin redirect wrappers for legacy routes:
- `/signup` → redirect to `/start`
- `/signup/form` → redirect to `/start`
- `/onboarding` → redirect to `/onboarding-chat`

### Phase 2: Update App.tsx Routes
Replace legacy route definitions with redirects

### Phase 3: Archive Legacy Components (Optional)
Move unused page components to `src/pages/legacy/` for reference

## Route Redirect Logic

```typescript
// Redirect component for /signup
export default function SignupRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/start', { replace: true });
  }, [navigate]);

  return null; // or loading spinner
}
```

## Marketing/External Link Compatibility

If any external links or marketing materials point to old URLs:
- `/signup` → 301 redirect to `/start` (handled by component)
- `/onboarding` → 301 redirect to `/onboarding-chat` (handled by component)

This ensures old bookmark/links don't break.

## Testing Checklist

After implementation:
- [ ] Navigate to `/signup` → should land on `/start`
- [ ] Navigate to `/signup/form` → should land on `/start`
- [ ] Navigate to `/onboarding` → should land on `/onboarding-chat`
- [ ] Click any "Start Free" CTA → should land on `/start`
- [ ] Complete Step 1 → should redirect to `/onboarding-chat`
- [ ] Complete Step 2 → should redirect to `/setup-status`
- [ ] Check browser history (should use replace, not push)

## Files to Modify

1. `src/App.tsx` - Update route definitions
2. `src/pages/SignupRedirect.tsx` - NEW redirect component
3. `src/pages/OnboardingRedirect.tsx` - NEW redirect component
4. (Optional) Archive `src/pages/AISignupWrapper.tsx` and `src/pages/Onboarding.tsx`
