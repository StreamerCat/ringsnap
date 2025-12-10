# Post-Trial Signup Flow - Quick Reference

## User Journey

```
┌─────────────────────────────────────────────────────────────────┐
│                    1. User Signs Up at /start                   │
│                  Enters email and full name                     │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│              2. Redirected to /onboarding-chat                  │
│        Completes business info + payment details                │
│     (phone, company, trade, hours, voice, goal, payment)        │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│           3. create-trial Edge Function Called                  │
│     • Creates Stripe customer & subscription                    │
│     • Creates user account in database                          │
│     • Enqueues provisioning job                                 │
│     • Returns success with provisioning_status='pending'        │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│         4. Redirected to /setup/assistant ✅ FIXED              │
│              (Previously went to /auth/login)                   │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│              5. ProvisioningStatus Page Loads                   │
│                                                                 │
│  Starts polling every 5s for provisioning_status                │
│  Sets 20-second timeout timer                                   │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
                    ┌────────┴────────┐
                    │                 │
                    ↓                 ↓
        ┌───────────────────┐  ┌──────────────────┐
        │  Completes < 20s  │  │  Takes > 20s     │
        └─────────┬─────────┘  └────────┬─────────┘
                  ↓                      ↓
    ┌─────────────────────────┐  ┌──────────────────────────┐
    │   READY STATE ✅        │  │   TIMEOUT STATE ⏱️       │
    │                         │  │                          │
    │ • Shows phone number    │  │ • "Still working on it"  │
    │ • Copy button           │  │ • Email notification msg │
    │ • Forwarding steps:     │  │ • Dashboard access       │
    │   1. Forward calls      │  │ • Polling continues      │
    │   2. Test assistant     │  │                          │
    │   3. Monitor dashboard  │  │ (Eventually transitions  │
    │ • Click-to-call link    │  │  to READY when complete) │
    │ • Pro tips              │  │                          │
    └─────────┬───────────────┘  └────────┬─────────────────┘
              ↓                           ↓
    ┌─────────────────────────────────────────────────┐
    │     6. User Clicks "Go to Dashboard"            │
    └─────────────────────┬───────────────────────────┘
                          ↓
              ┌───────────────────────┐
              │    7. /dashboard      │
              │   User can now:       │
              │   • View calls        │
              │   • Configure AI      │
              │   • Manage settings   │
              └───────────────────────┘
```

## State Transitions

```
PENDING (0-20s)
    ↓
    ├─→ READY (provisioning_status = 'completed')
    ├─→ FAILED (provisioning_status starts with 'failed')
    └─→ TIMEOUT (elapsed time > 20s)
            ↓
            └─→ READY (when provisioning eventually completes)
```

## Key Features Added

### ✅ Timeout Handling
- **When**: After 20 seconds of pending status
- **What**: Shows amber "Still Working on It" message
- **Why**: Prevents user frustration with infinite spinner
- **Action**: User can go to dashboard, will receive email when ready

### ✅ Phone Number Display
- **When**: provisioning_status = 'completed'
- **What**: Large, prominent display of Vapi/Twilio number
- **Features**: 
  - Copy to clipboard button
  - Click-to-call link
  - Visual phone icon

### ✅ Forwarding Instructions
- **Format**: Numbered steps with clear actions
- **Content**:
  1. Set up call forwarding from business number
  2. Test by calling RingSnap number directly
  3. Monitor calls in dashboard
- **Extras**: Pro tip callout about configuring forwarding settings

### ✅ Dashboard Navigation
- **Pending/Timeout**: Outline button (secondary action)
- **Ready**: Primary button (main CTA)
- **Always Available**: User can explore dashboard while waiting

## Files Changed

1. **src/pages/ProvisioningStatus.tsx**
   - Added timeout state and timer
   - Added phone number copy functionality
   - Enhanced UI for all states
   - Added comprehensive forwarding instructions

## Testing Checklist

- [ ] Complete trial signup flow
- [ ] Verify redirect to /setup/assistant (not /auth/login)
- [ ] See pending state with spinner
- [ ] Wait 20+ seconds to see timeout state
- [ ] Verify phone number displays when ready
- [ ] Test copy button
- [ ] Test click-to-call link
- [ ] Click "Go to Dashboard" button
- [ ] Verify dashboard loads correctly

## Deployment Notes

- ✅ Build passes with no errors
- ✅ Dev server starts successfully
- ✅ No breaking changes to existing flows
- ✅ All existing auth/provisioning logic intact
