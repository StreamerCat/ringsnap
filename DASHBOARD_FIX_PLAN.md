# RingSnap Dashboard & Onboarding Fix Plan

**Date:** 2026-01-03
**Branch:** `claude/ringsnap-dashboard-investigation-H9WyB`

---

## PHASE 1: INVESTIGATION FINDINGS

### Issue 1: Activation Step "Make a Test Call"

**Components Involved:**
- `src/pages/Activation.tsx` (entry point with rollback switch)
- `src/components/onboarding/ActivationStepper.tsx` (main flow)
- `src/hooks/useOnboardingState.ts` (state hook)
- `supabase/migrations/20260102000001_onboarding_rpc.sql` (backend RPC)

**Current Flow Analysis:**

| Signal | Current Implementation | Issue |
|--------|------------------------|-------|
| CTA Click | `<a href="tel:...">` - opens dialer | Click is tracked, but no server-side record of "user initiated call" |
| Test Call Detection | RPC `get_onboarding_state` checks `call_logs` for `duration_seconds >= 10` AND `status = 'completed'` | **CORRECT** - only completed calls count |
| Polling | Every 5 seconds while on step 2 | Reasonable, but no visual feedback during poll |
| Success Signal | `test_call_detected = true` in RPC response | Database-backed, deterministic |

**Issues Found:**
1. **No "attempt" tracking**: If user clicks "Call Now" but the call fails (no Vapi pickup), there's no visibility into failure modes
2. **Missing edge case**: If Vapi provisioning is incomplete but `phone_numbers.status = 'active'`, the call could ring but no webhook fires
3. **Race condition**: Between `refreshState()` calls (5s interval), a completed call might not show immediately, causing user confusion
4. **No failure feedback**: If call doesn't register after 30+ seconds, user has no guidance

**Success vs Attempt Signals:**
- **Attempt**: User clicks `<a href="tel:...">` - currently NOT tracked
- **Success**: `call_logs` record exists with `duration_seconds >= 10`, `status = 'completed'`, `direction = 'inbound'`
- **Failure**: No call_log record, OR record with `duration_seconds < 10`

---

### Issue 2: Call Logs Reliability

**Components Involved:**
- `supabase/functions/vapi-webhook/index.ts` (webhook handler)
- `supabase/functions/vapi-webhook/call_parser.ts` (extraction logic)
- `src/pages/CustomerDashboard.tsx:259-362` (realtime subscription)
- `supabase/migrations/20251222000001_fix_rpc_account_access.sql` (`get_recent_calls` RPC)

**Current Flow Analysis:**

```
Vapi Call Event → vapi-webhook → phone_numbers lookup → account mapping → call_logs upsert
                                       ↓ (if fail)
                              call_webhook_inbox (dead letter)
```

**Persistence Guarantees:**
1. **call-started**: Creates initial `call_logs` record with `status = 'in_progress'`
2. **end-of-call-report**: Updates record with transcript, summary, duration, outcome
3. **Short calls (< 10s)**: Still persisted with `status = 'completed'`, just not counted as "test call"
4. **Failed calls**: Written to `call_webhook_inbox` with `reason` explaining failure

**Potential Drop Points:**
| Scenario | Current Handling | Risk Level |
|----------|------------------|------------|
| No `vapi_phone_id` match | Falls back to `e164_number`, then `phone_number` | LOW |
| Duplicate phone mapping | Writes to inbox with `reason: duplicate_phone_mapping` | LOW |
| Account not mapped | Writes to inbox with `reason: unmapped_account` | MEDIUM |
| Pool/cooldown lifecycle | Skips silently (spam reduction) | BY DESIGN |
| Upsert failure | Writes to inbox, re-throws for Sentry | LOW |

**Filtering Issues:**
- `get_recent_calls` RPC returns ALL calls ordered by `started_at DESC NULLS LAST`
- NO filtering by duration or status in RPC
- Frontend `InboxTab.tsx` categorizes by outcome, doesn't filter

**Findings:**
- Call persistence is robust - all events hit `call_webhook_inbox` on failure
- Missing: Short/failed calls are persisted but may not appear in "follow-ups" if `outcome = 'Info-only'`

---

### Issue 3: Incorrect Auto-Tagging

**Components Involved:**
- `src/lib/call-text-utils.ts` (main tagging logic)
- `supabase/functions/vapi-webhook/call_parser.ts:244-267` (`extractReason`)
- `src/components/dashboard/CallDetailsDrawer.tsx:72-79` (display)
- `src/components/dashboard/InboxTab.tsx:226` (display)

**Tagging Logic Analysis:**

```typescript
// call-text-utils.ts:396-416
export function deriveTopicLabels(input: TopicDerivationInput): string[] {
    const services = deriveServiceTags(input);  // e.g., "Water heater", "AC repair"
    const intents = deriveIntentTags(input);    // e.g., "Callback requested"
    // ... combines them
}
```

**Root Cause Found:**

`deriveTopicLabels()` accepts `{ reason, summary, transcript, companyName }` but the actual data flow is:

1. `vapi-webhook/call_parser.ts:256-266` extracts `reason` from `structuredData` or `summary`
2. If summary exists but no transcript, the `reason` field gets populated with summary heuristics
3. `InboxTab.tsx:226` calls `deriveTopicLabels({ reason: call.reason, summary: call.summary })`

**The Bug:**
- `call_parser.ts:256-266` only looks at `structuredData.reason` and `summary`
- It does NOT require a transcript to set `reason`
- `deriveTopicLabels()` then runs on `reason` text that was derived from summary (circular)
- Result: Tags appear based on AI summary prose, not actual caller intent

**Example Flow:**
```
1. Vapi summary: "The caller inquired about AC repair services..."
2. extractReason() returns: "Inquired about AC repair services"
3. deriveServiceTags() matches "ac repair" → returns ["AC repair"]
4. User sees "AC repair" tag even though they just asked for general info
```

**Missing Guard:**
- No check for `call.transcript` existence before deriving service tags
- No distinction between "reason from structured data" vs "reason inferred from summary"

---

### Issue 4: UI Layout Issues

**Components Reviewed:**
- `src/components/dashboard/InboxTab.tsx:232-285` (FollowUpRow)
- `src/components/dashboard/PhoneNumbersTab.tsx:129` (CTA buttons)
- `src/components/dashboard/ActivationStepper.tsx:197-205` (fixed bottom button)
- `src/components/VapiChatWidget.tsx:154` (widget positioning)

**Issues Found:**

| Component | Issue | Location |
|-----------|-------|----------|
| `FollowUpRow` | Quick action buttons (`Call`/`Text`) may overlap with text on narrow screens | `InboxTab.tsx:269-281` |
| `ActivationStepper` | Fixed bottom CTA on step 3 uses `fixed bottom-0` which could overlap with Vapi widget | `ActivationStepper.tsx:197-205` |
| `PhoneNumbersTab` | "How to Forward Calls" / "Test My Agent" buttons stack poorly on mobile | `PhoneNumbersTab.tsx:129-146` |
| `InboxTab` | Topic badges + score truncate on mobile, no wrap behavior | `InboxTab.tsx:246-258` |
| `CallDetailsDrawer` | Address text doesn't wrap on long addresses | `CallDetailsDrawer.tsx:246-250` |

**Specific CSS Concerns:**
```tsx
// ActivationStepper.tsx:197 - Fixed positioning without safe area
<div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t sm:static ...">

// VapiChatWidget.tsx:154 - Dynamic bottom class
const mobileBottomClass = widgetMode === 'customer' ? 'bottom-4' : 'bottom-28';
// ^ This conflicts with ActivationStepper's fixed bottom-0
```

---

### Issue 5: "Add Phone Number" Button

**Components Involved:**
- `src/components/dashboard/PhoneNumbersTab.tsx:153-158`

**Current Implementation:**
```tsx
// PhoneNumbersTab.tsx:153-158
<Button disabled={account.plan_type === "starter"}>
    {account.plan_type === "starter"
        ? "Upgrade to Add Numbers"
        : "Add Phone Number"}
</Button>
```

**Issue Analysis:**
1. **For Starter plan**: Button is disabled, text says "Upgrade to Add Numbers" - **CORRECT**
2. **For Professional/Premium**: Button is enabled but has **NO onClick handler** - **BUG**

**Why it fails:**
- The button renders but clicking does nothing
- No modal, no navigation, no error - just silent failure
- User expectation: Opens phone number provisioning flow

**Plan Gating Logic:**
- `account.plan_type === "starter"` → disabled
- Other plans → enabled but no action

**Out of Scope Note:**
The full add-number flow (Twilio provisioning, area code selection, Vapi integration) is complex and out of scope. The immediate fix should show a "Coming Soon" message or link to support.

---

### Issue 6: Settings Toggles

**Components Involved:**
- `src/components/dashboard/SettingsTab.tsx`
- Shadcn `Switch` component

**Toggle → Backend Mapping:**

| Toggle | State Variable | Database Column | Edge Function |
|--------|---------------|-----------------|---------------|
| Enable SMS Notifications | `smsEnabled` | `accounts.sms_enabled` | None (direct DB update) |
| New Booking Confirmations | `smsAppointmentConfirmations` | `accounts.sms_appointment_confirmations` | None |
| Appointment Reminders | `smsReminders` | `accounts.sms_reminders` | `reminders-dispatcher` reads this |
| Enable Email Notifications | `notifyContractorEmail` | `accounts.notify_contractor_email` | None |
| Notify Caller via SMS | `notifyCallerSms` | `accounts.notify_caller_sms` | `appointment-notifications` reads this |
| Notify Caller via Email | `notifyCallerEmail` | `accounts.notify_caller_email` | `appointment-notifications` reads this |
| Call Recording | `call_recording_enabled` | `accounts.call_recording_enabled` | Vapi assistant rebuild (not implemented?) |

**Issues Found:**

1. **Visual Design Issue**: Toggle labels have inconsistent spacing:
   ```tsx
   // Line 243 - good
   <Switch checked={smsEnabled} onCheckedChange={setSmsEnabled} />

   // Line 262 - nested toggles have different padding
   <div className="ml-4 space-y-4 border-l pl-4">
   ```

2. **Missing Edge Function Connection**: Call Recording toggle updates DB but doesn't trigger Vapi assistant update. The recording setting might not take effect until next assistant rebuild.

3. **No Loading State**: `handleSaveNotifications()` shows saving state but individual toggles don't show pending state during save.

4. **Timezone Save Race**: Timezone and toggles share the same save button, but timezone changes require different downstream effects (appointment time display).

---

### Issue 7: Vapi Chat Widget Overlay

**Components Involved:**
- `src/components/VapiChatWidget.tsx`
- `src/components/onboarding/ActivationStepper.tsx` (conflicting fixed element)

**Current Positioning:**
```tsx
// VapiChatWidget.tsx:151-154
const mobileBottomClass = widgetMode === 'customer' ? 'bottom-4' : 'bottom-28';

<div className={`vapi-widget-container fixed ${mobileBottomClass} md:bottom-4 right-4 z-[100] ...`}>
```

**Conflict Analysis:**

| Route | Widget Mode | Bottom Position | Conflict |
|-------|-------------|-----------------|----------|
| `/activation` | Hidden (in HIDDEN_EXACT_ROUTES) | N/A | **NO CONFLICT** |
| `/dashboard` | `customer` | `bottom-4` | May overlap with floating CTAs |
| `/pricing` | `pricing` | `bottom-28` | Higher offset, less conflict |

**Wait - Widget is Hidden on /activation:**
```tsx
// VapiChatWidget.tsx:12-28
const HIDDEN_EXACT_ROUTES = [
    "/login", "/signup", "/signin", "/start",
    "/onboarding", "/onboarding-chat", "/onboarding-status",
    "/setup/assistant", "/activation",  // <-- HIDDEN HERE
    ...
];
```

**Actual Issue:**
The widget is correctly hidden on `/activation`. The overlap issue must be on **dashboard** pages where:
1. `ActivationStepper` is NOT rendered (it's only on `/activation`)
2. But `OnboardingUiGuardrail` shows a banner that could overlap

**Real Conflict:**
- `PhoneNumbersTab.tsx:197-205`: The forwarding step has a fixed bottom CTA
- This conflicts with Vapi widget on mobile when user is on `/dashboard?tab=phone-numbers`

**Proposed Solutions:**
1. Auto-minimize widget when fixed CTAs are present
2. Increase widget's mobile bottom offset
3. Add safe area class to fixed CTAs to account for widget

---

## PHASE 2: IMPLEMENTATION PLAN

### State Definitions

```typescript
// Activation Step State Machine
type ActivationStepState =
  | 'provisioning'     // Phone number being set up
  | 'ready'            // Number active, awaiting test call
  | 'call_initiated'   // User clicked call button (NEW)
  | 'call_in_progress' // Call detected but not completed (NEW)
  | 'call_completed'   // Test call successful (duration >= 10s)
  | 'forwarding'       // Awaiting forwarding setup
  | 'verified'         // All steps complete
  | 'failed'           // Error state (NEW)

// Call Log Tagging Source
type TagSource =
  | 'structured_data'  // From Vapi structured output
  | 'transcript'       // Extracted from transcript
  | 'summary_inferred' // Inferred from summary (lower confidence)
```

---

### Fix 1: Activation Test Call Flow

**Frontend Changes:**

1. **Track call attempt** (`ActivationStepper.tsx`):
```typescript
const [callAttemptedAt, setCallAttemptedAt] = useState<Date | null>(null);

const handleCallClick = async () => {
  setCallAttemptedAt(new Date());
  await trackEvent('onboarding.test_call_initiated');
  // Let browser handle tel: link
};

// Show timeout guidance after 30 seconds
useEffect(() => {
  if (callAttemptedAt && !state?.test_call_detected) {
    const timeout = setTimeout(() => {
      setShowTroubleshooting(true);
    }, 30000);
    return () => clearTimeout(timeout);
  }
}, [callAttemptedAt, state?.test_call_detected]);
```

2. **Add troubleshooting guidance UI**:
```tsx
{showTroubleshooting && (
  <Alert variant="warning">
    <AlertTitle>Call not detected?</AlertTitle>
    <AlertDescription>
      <ul>
        <li>Make sure you completed the call (at least 10 seconds)</li>
        <li>Try calling from a different phone</li>
        <li>Check if your RingSnap number is active</li>
      </ul>
      <Button variant="link" onClick={handleContactSupport}>
        Contact Support
      </Button>
    </AlertDescription>
  </Alert>
)}
```

**Backend Changes:**

3. **Add `call_initiated` event tracking** (already exists in RPC, just needs frontend call)

4. **Add webhook validation** (`vapi-webhook/index.ts`):
```typescript
// Log if call comes in during expected activation window
if (mappingResult.method === 'assigned_native') {
  const activationWindow = await checkActivationWindow(supabase, mappingResult.accountId);
  if (activationWindow) {
    console.log({ event: 'activation_call_received', accountId: mappingResult.accountId });
  }
}
```

**Guardrails:**
- Feature flag: `VITE_FEATURE_ACTIVATION_TROUBLESHOOTING`
- Rollback: Remove timeout logic, keep basic flow

---

### Fix 2: Call Logs Reliability

**Changes Required: MINIMAL**

Current implementation is robust. Add visibility into failure modes:

1. **Admin monitoring query** (already in `call_webhook_inbox`):
```sql
-- Add to admin dashboard
SELECT reason, COUNT(*) as count, MAX(created_at) as latest
FROM call_webhook_inbox
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY reason;
```

2. **Add `duration_seconds < 10` indicator in UI** (`InboxTab.tsx`):
```tsx
{call.duration_seconds !== undefined && call.duration_seconds < 10 && (
  <Badge variant="outline" className="text-xs text-muted-foreground">
    Short call
  </Badge>
)}
```

**Guardrails:**
- No feature flag needed (UI-only change)
- Rollback: Remove Badge component

---

### Fix 3: Auto-Tagging Without Transcripts

**Frontend Changes:**

1. **Add tag confidence indicator** (`InboxTab.tsx`, `CallDetailsDrawer.tsx`):
```typescript
interface TagWithConfidence {
  label: string;
  confidence: 'high' | 'inferred';
  source: 'structured' | 'transcript' | 'summary';
}

// In deriveTopicLabels
export function deriveTopicLabelsWithConfidence(input: TopicDerivationInput): TagWithConfidence[] {
  // If no transcript and no structured data, mark as inferred
  const hasTranscript = !!input.transcript && input.transcript.length > 50;
  const hasStructuredReason = !!input.structuredReason;

  const confidence = hasStructuredReason ? 'high' : (hasTranscript ? 'high' : 'inferred');
  // ...
}
```

2. **Visual distinction for inferred tags**:
```tsx
<Badge
  variant={tag.confidence === 'inferred' ? 'outline' : 'secondary'}
  className={tag.confidence === 'inferred' ? 'border-dashed' : ''}
>
  {tag.label}
  {tag.confidence === 'inferred' && <span className="ml-1 opacity-50">?</span>}
</Badge>
```

**Backend Changes:**

3. **Add `tag_source` field to call_logs** (migration):
```sql
ALTER TABLE call_logs ADD COLUMN tag_source TEXT DEFAULT 'summary';
-- Values: 'structured', 'transcript', 'summary'
```

4. **Update call_parser.ts**:
```typescript
// In extractReason()
return {
  reason: cleanReason(value),
  source: structuredData.reason ? 'structured' : (transcript ? 'transcript' : 'summary')
};
```

**Guardrails:**
- Feature flag: `VITE_FEATURE_TAG_CONFIDENCE`
- Rollback: Ignore `tag_source` field, show all tags as-is

---

### Fix 4: UI Layout Issues

**CSS/Component Changes:**

1. **FollowUpRow mobile layout** (`InboxTab.tsx`):
```tsx
// Change flex-row to column on mobile
<div className="p-4 hover:bg-muted/50 cursor-pointer" onClick={onClick}>
  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
    <div className="flex-1 min-w-0 space-y-1">
      {/* ... content ... */}
    </div>

    {/* Quick Actions - full width on mobile */}
    <div className="flex gap-2 sm:flex-col sm:gap-1 shrink-0">
      <Button size="sm" variant="default" className="flex-1 sm:flex-none h-8" ...>
```

2. **ActivationStepper safe area** (`ActivationStepper.tsx`):
```tsx
// Add padding-bottom for widget
<div className="fixed bottom-0 left-0 right-0 p-4 pb-20 sm:pb-4 bg-background border-t sm:static ...">
```

3. **PhoneNumbersTab button stack** (`PhoneNumbersTab.tsx`):
```tsx
<div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
  <Button variant="default" className="w-full sm:w-auto" ...>
  <Button variant="secondary" className="w-full sm:w-auto" ...>
</div>
```

4. **Topic badges wrap** (`InboxTab.tsx`):
```tsx
<div className="flex flex-wrap items-center gap-1.5 max-w-full">
  {topics.slice(0, 2).map(...)}
  {/* Move score to new line on overflow */}
</div>
```

**Guardrails:**
- Visual regression testing with screenshots
- Test on viewport widths: 320px, 375px, 768px, 1024px

---

### Fix 5: "Add Phone Number" Button

**Immediate Fix** (`PhoneNumbersTab.tsx`):

```tsx
const [showAddNumberDialog, setShowAddNumberDialog] = useState(false);

// Replace disabled button with working one
<Button
  onClick={() => {
    if (account.plan_type === "starter") {
      // Open upgrade modal
      toast({
        title: "Upgrade Required",
        description: "Add additional phone numbers on Professional or Premium plans.",
        action: <Button size="sm" onClick={() => navigate('/dashboard?tab=billing')}>View Plans</Button>
      });
    } else {
      // Show coming soon dialog
      setShowAddNumberDialog(true);
    }
  }}
>
  {account.plan_type === "starter" ? "Upgrade to Add Numbers" : "Add Phone Number"}
</Button>

{/* Coming Soon Dialog */}
<Dialog open={showAddNumberDialog} onOpenChange={setShowAddNumberDialog}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Add Phone Number</DialogTitle>
      <DialogDescription>
        Adding additional phone numbers is coming soon. Contact support if you need
        multiple numbers for your business.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline" onClick={() => setShowAddNumberDialog(false)}>Close</Button>
      <Button asChild>
        <a href="mailto:support@ringsnap.com?subject=Additional Phone Number Request">
          Contact Support
        </a>
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Guardrails:**
- No backend changes
- Easily replaced with full flow when ready

---

### Fix 6: Settings Toggles

**Visual Design Fixes** (`SettingsTab.tsx`):

1. **Consistent toggle spacing**:
```tsx
// Wrap all toggles in consistent container
<div className="space-y-4">
  <ToggleRow
    label="Enable SMS Notifications"
    description="Receive texts for new bookings & reminders"
    checked={smsEnabled}
    onCheckedChange={setSmsEnabled}
  />

  {smsEnabled && (
    <div className="ml-6 pl-4 border-l-2 border-muted space-y-3">
      <ToggleRow
        label="New Booking Confirmations"
        checked={smsAppointmentConfirmations}
        onCheckedChange={setSmsAppointmentConfirmations}
        size="sm"
      />
      {/* ... */}
    </div>
  )}
</div>
```

2. **Individual toggle loading state**:
```tsx
const [pendingToggles, setPendingToggles] = useState<Set<string>>(new Set());

const handleToggle = async (key: string, value: boolean) => {
  setPendingToggles(prev => new Set(prev).add(key));
  try {
    await supabase.from('accounts').update({ [key]: value }).eq('id', account.id);
    onUpdateAccount({ ...account, [key]: value });
  } finally {
    setPendingToggles(prev => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }
};
```

3. **Call Recording edge function trigger** (future enhancement):
```typescript
// After updating call_recording_enabled, trigger assistant rebuild
if (key === 'call_recording_enabled') {
  await supabase.functions.invoke('rebuild-assistant', {
    body: { accountId: account.id }
  });
}
```

**Guardrails:**
- Feature flag: None needed for visual fixes
- Backend assistant rebuild should be feature-flagged

---

### Fix 7: Vapi Widget Overlay

**Widget Positioning** (`VapiChatWidget.tsx`):

```tsx
// Increase mobile offset when on dashboard
const getDynamicBottomClass = () => {
  if (widgetMode !== 'customer') return 'bottom-28';

  // Check for fixed CTAs in current view
  const hasFixedCta = document.querySelector('[data-fixed-cta="true"]');
  return hasFixedCta ? 'bottom-24' : 'bottom-4';
};

// OR simpler: always use higher offset on customer routes
const mobileBottomClass = widgetMode === 'customer' ? 'bottom-20' : 'bottom-28';
```

**Fixed CTA Attribution** (various components):

```tsx
// Add data attribute to fixed CTAs for detection
<div
  className="fixed bottom-0 ..."
  data-fixed-cta="true"
>
```

**Alternative: CSS Safe Area Approach**:

```css
/* src/index.css */
.safe-area-bottom-right {
  /* Account for widget */
}

@media (max-width: 640px) {
  .fixed-cta-with-widget {
    padding-bottom: calc(env(safe-area-inset-bottom) + 80px);
  }
}
```

**Guardrails:**
- Test on actual mobile devices
- Verify widget doesn't overlap key CTAs on all dashboard tabs

---

## Testing Strategy

### Manual Testing Checklist

**Activation Flow:**
- [ ] Complete signup → arrives at activation
- [ ] Click "Call Now" → phone dialer opens
- [ ] Complete 10+ second call → step advances
- [ ] Complete <10 second call → shows troubleshooting after 30s
- [ ] Skip step → can access dashboard

**Call Logs:**
- [ ] Make inbound call → appears in Inbox within 10s
- [ ] Short call (<10s) → appears with "Short call" badge
- [ ] Check `call_webhook_inbox` for any failures

**Tagging:**
- [ ] Call with transcript → tags show solid
- [ ] Call without transcript → tags show dashed border
- [ ] Call with structured data → tags show high confidence

**UI Layout:**
- [ ] FollowUpRow on 320px viewport → no overlap
- [ ] PhoneNumbersTab buttons on mobile → stack properly
- [ ] Vapi widget doesn't cover CTAs

**Settings:**
- [ ] Toggle SMS on/off → persists on reload
- [ ] Nested toggles appear when parent is on
- [ ] Save button shows loading state

### Automated Tests

```typescript
// tests/e2e/activation-flow.spec.ts
test('activation completes after test call', async ({ page }) => {
  // Setup: Create account in test mode
  // Navigate to /activation
  // Verify step 2 is active
  // Trigger mock webhook with test call
  // Verify step advances
});

// tests/e2e/call-logs-display.spec.ts
test('short calls display with badge', async ({ page }) => {
  // Insert call with duration_seconds = 5
  // Navigate to /dashboard?tab=inbox
  // Verify "Short call" badge visible
});
```

---

## Rollout Plan

### Phase A: Low-Risk Fixes (This Sprint)

1. UI layout fixes (CSS only)
2. "Add Phone Number" dialog
3. Settings toggle visual consistency
4. Short call badge in Inbox

### Phase B: Medium-Risk Fixes (Next Sprint)

1. Activation troubleshooting guidance
2. Tag confidence indicators
3. Vapi widget safe area offset

### Phase C: Backend Changes (Requires Migration)

1. `tag_source` column in call_logs
2. Call recording assistant rebuild trigger
3. Activation attempt tracking events

---

## Files to Modify

| File | Changes | Risk |
|------|---------|------|
| `src/components/onboarding/ActivationStepper.tsx` | Add troubleshooting UI, safe area padding | LOW |
| `src/components/dashboard/InboxTab.tsx` | Short call badge, layout fixes | LOW |
| `src/components/dashboard/PhoneNumbersTab.tsx` | Add Number dialog, button layout | LOW |
| `src/components/dashboard/SettingsTab.tsx` | Toggle refactor, loading states | LOW |
| `src/components/VapiChatWidget.tsx` | Bottom offset adjustment | LOW |
| `src/lib/call-text-utils.ts` | Tag confidence function | MEDIUM |
| `src/components/dashboard/CallDetailsDrawer.tsx` | Confidence badge display | LOW |
| `supabase/functions/vapi-webhook/call_parser.ts` | Tag source tracking | MEDIUM |
| NEW: `supabase/migrations/XXXXXX_add_tag_source.sql` | Schema change | MEDIUM |

---

## Summary

This plan addresses all 7 issues with a phased approach prioritizing user-facing fixes first. Key principles:

1. **Additive changes** - No removal of existing functionality
2. **Feature flags** where behavior changes significantly
3. **Graceful degradation** - New features degrade to current behavior if flags off
4. **No breaking changes** to signup, provisioning, call logging, or billing

---

## Implementation Status (Sprint 2026-01-04)

### Completed Changes

| Phase | Component | Change | Status |
|-------|-----------|--------|--------|
| 0 | featureFlags.ts | Added 5 new feature flags | DONE |
| 0 | sentry-tracking.ts | Added onboarding event tracking | DONE |
| 1 | ActivationStepper.tsx | Test call attempt tracking, troubleshooting UI | DONE |
| 1 | vapi-webhook/index.ts | Activation call tracking in webhook | DONE |
| 2 | Migration | reason_source, tag_source columns | DONE |
| 3 | call_parser.ts | extractReasonWithSource(), tag source logic | DONE |
| 3 | vapi-webhook/index.ts | Save reason_source, tag_source | DONE |
| 4 | InboxTab.tsx | Mobile layout, tag confidence, short call badge | DONE |
| 5 | PhoneNumbersTab.tsx | Add number modal, plan gating, provisioning flow | DONE |
| 6 | SettingsTab.tsx | ToggleRow component, call recording immediate apply | DONE |
| 7 | VapiChatWidget.tsx | Safe offset positioning with feature flag | DONE |
| 8 | Tests | Playwright e2e tests for activation and phone flow | DONE |

### Feature Flags Added

```
VITE_FEATURE_ACTIVATION_TROUBLESHOOTING=true
VITE_FEATURE_TAGGING_CONFIDENCE_UI=true
VITE_FEATURE_ADD_PHONE_NUMBER_FLOW=true
VITE_FEATURE_WIDGET_SAFE_OFFSET=true
VITE_FEATURE_CALL_RECORDING_IMMEDIATE_APPLY=true
```

---

## Manual QA Checklist

### Activation Flow
- [ ] Navigate to /activation after provisioning completes
- [ ] Click "Call Now" and verify onboarding.test_call_initiated event created in system_events
- [ ] Complete a 10+ second call and verify step advances
- [ ] If no call after 25s, troubleshooting panel appears
- [ ] Can click "Skip test call" to proceed to forwarding

### Call Logs
- [ ] Make a short call (<10 seconds) - verify "Short" badge appears
- [ ] Make a call with transcript - verify tags display normally
- [ ] Make a call without transcript - verify tags don't display (if taggingConfidenceUi enabled)
- [ ] Check call_webhook_inbox for any failed calls

### Add Phone Number
- [ ] As Starter plan: clicking "Add Phone Number" redirects to billing or shows upgrade toast
- [ ] As Professional/Premium: clicking opens modal wizard
- [ ] Modal shows label and area code inputs
- [ ] Provisioning calls provision-phone-number edge function
- [ ] New number appears in list after success

### Settings Toggles
- [ ] Toggle SMS notifications - verify per-toggle loading state
- [ ] Toggle call recording - verify immediate effect (if callRecordingImmediateApply enabled)
- [ ] Nested toggles appear/disappear when parent toggled

### Widget Overlay (Mobile)
- [ ] On /pricing at 375px width, upgrade CTA is clickable (not covered by widget)
- [ ] On /dashboard at 375px width, tab navigation is accessible
- [ ] Widget does NOT appear on /activation page

### UI Layout (Mobile)
- [ ] FollowUpRow: buttons stack on mobile, no overlap
- [ ] CallRow: badges wrap, no horizontal overflow
- [ ] PhoneNumbersTab: buttons stack on mobile

### Regressions to Verify
- [ ] Signup flow completes successfully
- [ ] Trial creation works
- [ ] Calls are logged in call_logs table
- [ ] Billing tab loads without errors
