# Phase 2: Google Calendar Integration Plan

## Overview

Phase 2 extends the availability system to include Google Calendar busy times in addition to DB appointments. This creates a combined blocking system where both our internal appointments AND the business owner's calendar events are considered when determining availability.

## Current State (Phase 1 - Completed)

- ✅ DB-backed `check_availability` tool
- ✅ Write-time conflict protection in `book_appointment`
- ✅ Multi-tenant scoping via assistantId → accountId
- ✅ Feature flag: `APPOINTMENT_CONFLICT_ENFORCEMENT`
- ✅ Performance indexes for conflict queries

## Architecture Decision: Vapi Integration vs Custom OAuth

### Option A: Use Vapi's Google Calendar Integration

**How it works:**

- Each customer connects their Google Calendar directly in Vapi
- Vapi provides "Check Availability" and "Create Event" tools natively
- RingSnap would configure the assistant to use these Vapi tools

**Pros:**

- Less code to maintain
- Vapi handles OAuth complexity
- Native integration with Vapi workflows

**Cons:**

- ❌ Customers must configure in Vapi dashboard (bad UX)
- ❌ Less control over sync behavior
- ❌ Cannot combine with our DB appointments (two separate systems)
- ❌ Event creation happens in Vapi, not our system
- ❌ No visibility into customer's calendar from RingSnap dashboard

### Option B: Custom Google OAuth + Calendar API (Recommended)

**How it works:**

- Customer connects Google Calendar in RingSnap dashboard
- RingSnap stores encrypted refresh token in `google_calendar_connections`
- Our `check_availability` tool queries both DB AND Google Calendar
- Our `book_appointment` creates DB appointment AND Google Calendar event

**Pros:**

- ✅ Single connection flow in RingSnap dashboard
- ✅ Combined availability (DB + Calendar = true availability)
- ✅ Full control over sync behavior
- ✅ Calendar events visible in RingSnap dashboard
- ✅ Works with existing multi-tenant architecture
- ✅ Can add other calendar providers (Outlook, Apple) later

**Cons:**

- More code to maintain
- OAuth complexity (but already have patterns in codebase)
- Need to handle token refresh

## Recommended Approach: Option B (Custom Integration)

### Implementation Steps

#### Step 1: Google OAuth Setup

1. Create Google Cloud project with Calendar API enabled
2. Configure OAuth consent screen for production
3. Add environment variables:
   - `GOOGLE_OAUTH_CLIENT_ID`
   - `GOOGLE_OAUTH_CLIENT_SECRET`
   - `GOOGLE_OAUTH_REDIRECT_URI`

#### Step 2: Database Schema

The `google_calendar_connections` table already exists:

```sql
CREATE TABLE IF NOT EXISTS public.google_calendar_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    refresh_token_encrypted TEXT,
    calendar_id TEXT, -- Which calendar to use (default: 'primary')
    status TEXT DEFAULT 'pending', -- pending, connected, error, revoked
    connected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(account_id)
);
```

#### Step 3: OAuth Edge Functions

Create:

- `google-oauth-start/index.ts` - Initiates OAuth flow
- `google-oauth-callback/index.ts` - Handles callback, stores tokens

#### Step 4: Calendar Service

Create `_shared/google-calendar.ts`:

```typescript
interface CalendarBusyBlock {
  start: string;
  end: string;
}

/**
 * Get busy times from Google Calendar using FreeBusy API
 */
async function getGoogleCalendarBusy(
  accountId: string,
  startTime: string,
  endTime: string
): Promise<CalendarBusyBlock[]>

/**
 * Create event on Google Calendar
 */
async function createGoogleCalendarEvent(
  accountId: string,
  appointment: Appointment
): Promise<{ eventId: string } | null>
```

#### Step 5: Update Availability Service

Modify `_shared/availability.ts`:

```typescript
export async function getAvailableSlots(
  supabase: SupabaseClient,
  request: AvailabilityRequest,
  correlationId?: string
): Promise<AvailabilityResult> {
  // Existing DB logic...
  
  // NEW: Check if Google Calendar is connected
  const { data: calConnection } = await supabase
    .from("google_calendar_connections")
    .select("*")
    .eq("account_id", request.accountId)
    .eq("status", "connected")
    .single();
  
  let calendarBusy: CalendarBusyBlock[] = [];
  if (calConnection) {
    calendarBusy = await getGoogleCalendarBusy(
      request.accountId,
      dayStart,
      dayEnd
    );
  }
  
  // Filter slots: exclude both DB appointments AND calendar busy times
  const availableSlots = candidates.filter((slot) => {
    const slotStart = new Date(slot.start);
    const slotEnd = new Date(slot.end);
    
    // Check DB appointments
    for (const appt of appointments) {
      if (doTimesOverlap(...)) return false;
    }
    
    // Check Google Calendar busy times
    for (const busy of calendarBusy) {
      if (doTimesOverlap(slotStart, slotEnd, new Date(busy.start), new Date(busy.end))) {
        return false;
      }
    }
    
    return true;
  });
}
```

#### Step 6: Update Booking Service

When creating an appointment:

1. Insert into DB (existing)
2. If Google Calendar connected: Create calendar event
3. Store `google_event_id` on appointment for sync

#### Step 7: Dashboard Integration

- Add "Connect Google Calendar" button in Settings
- Show connection status
- Option to select which calendar to use
- Disconnect option

### API Structure

```
POST /functions/v1/google-oauth-start
  -> Returns OAuth URL

GET /functions/v1/google-oauth-callback?code=...&state=...
  -> Exchanges code, stores tokens, redirects to dashboard

GET /functions/v1/google-calendar-status
  -> Returns connection status for account

POST /functions/v1/google-calendar-disconnect
  -> Revokes and removes connection
```

### Security Considerations

1. **Token Encryption**: Store refresh_token with AES-256 encryption
2. **Scopes**: Request minimal scopes (`calendar.readonly`, `calendar.events`)
3. **Token Rotation**: Handle token expiration gracefully
4. **Revocation**: Properly revoke on disconnect

### Testing Plan

1. **Unit Tests**: Mock Google Calendar API responses
2. **Integration Tests**:
   - Create appointment when calendar is connected
   - Verify event appears in Google Calendar
   - Verify busy times block availability
3. **E2E Test**:
   - Connect Google Calendar
   - Call assistant, book appointment
   - Verify blocked time in subsequent availability check

### Rollout Plan

1. **Week 1**: OAuth flow and basic connection
2. **Week 2**: FreeBusy integration for availability
3. **Week 3**: Event creation during booking
4. **Week 4**: Dashboard UI and testing
5. **Week 5**: Beta rollout to selected accounts
6. **Week 6**: GA rollout with feature flag

### Feature Flags

```
GOOGLE_CALENDAR_INTEGRATION_ENABLED=true  # Master switch
GOOGLE_CALENDAR_SYNC_EVENTS=true          # Create events on booking
GOOGLE_CALENDAR_FREE_BUSY=true            # Use busy times for availability
```

### Metrics to Track

- % of accounts with Google Calendar connected
- Conflicts prevented by calendar integration
- Event creation success rate
- OAuth error rate
- Token refresh success rate

---

## Future Enhancements (Phase 3+)

1. **Microsoft Outlook Integration**: Similar pattern, Microsoft Graph API
2. **Apple Calendar**: CalDAV-based integration
3. **Two-way Sync**: Update appointments when calendar events change
4. **Cancellation Sync**: Cancel calendar event when appointment canceled
5. **Service-specific calendars**: Different calendars for different service types
