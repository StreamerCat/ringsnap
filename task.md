# Dashboard UX Consolidation + Missing Appointments Investigation

## Current State Summary (Part A)

### Dashboard Tab Architecture

| Tab | Primary Data Source | Filters | Purpose |
|-----|---------------------|---------|---------|
| **Today** | `OperatorOverview` (calls RPC + operator stats view) | Last 24h calls | Quick summary: calls, leads, booked |
| **Overview** | `usageLogs` (from `get_recent_calls` RPC) | Monthly usage | Usage stats, subscription, credits |
| **Calendar** | `calls` prop → `deriveAppointmentEvents()` | Month/Week view | Visual calendar of **booked calls** derived from call_logs |
| **Appointments** | Direct query to `appointments` table | Day/Week/Month (created_at or scheduled_start_at) | List view of **appointments table** |
| **Phone Numbers** | `phone_numbers` table | Account-scoped | Phone management |
| **Team** | Team members via RPC | Account-scoped | Team management |
| **Settings** | `accounts` row | N/A | Account configuration |
| **Billing** | `accounts` + Stripe integration | N/A | Billing management |

### Key Finding: CalendarTab ≠ AppointmentsTab

- **CalendarTab** derives appointments from `call_logs` using `lib/appointments.ts` → `deriveAppointmentEvents()`
- **AppointmentsTab** queries the `appointments` table directly
- They are NOT linked and show different data!

---

## Root Cause Analysis (Part B)

### Why "Booked Calls" but "No Appointments"

**Root Cause 1: Schema Mismatch**

The `vapi-webhook/index.ts` creates appointments with:

```typescript
const { error } = await supabase.from('appointments').upsert(appointmentData, { onConflict: 'call_log_id' });
```

But the `appointments` table has a UNIQUE constraint on `(vapi_call_id, scheduled_start_at)` NOT on `call_log_id`.

This means:

1. If `call_log_id` column doesn't exist → Insert fails silently
2. If `call_log_id` exists but no UNIQUE constraint → Upsert logic is broken

**Root Cause 2: Column Name Mismatch**

Original appointments table uses: `customer_name`, `customer_phone`, `confirmed_time`
Webhook inserts with: `caller_name`, `caller_phone`, `scheduled_start_at`

**Root Cause 3: Missing `call_log_id` column**

The appointments table was never given a `call_log_id` column in the migrations.

### Relationship Model

**Current (broken):**

- `call_logs` has: `outcome='booked'`, `booked=true`, `appointment_start`, `appointment_window`
- `appointments` has: NO link back to `call_logs`
- Webhook tries to set `call_log_id` but column doesn't exist

**Ideal:**

- `appointments.call_log_id` → FK to `call_logs.id`
- OR `call_logs.appointment_id` → FK to `appointments.id`

---

## Proposed IA (Part D)

### Recommendation: Merge CalendarTab into AppointmentsTab

**Rationale:**

1. CalendarTab actually works (derives from call_logs which are populated)
2. AppointmentsTab is broken (appointments table is empty)
3. Users shouldn't need two separate places to see their schedule
4. Reduces confusion and maintenance burden

**Implementation:**

Remove "Calendar" tab from primary nav and fold into "Appointments" tab with a view toggle:

- **List View** (default) - Shows appointment cards chronologically
- **Calendar View** - Shows month/week grid

**Alternative (if we want to fix the appointments table):**

1. Add `call_log_id` column with UNIQUE constraint
2. Fix webhook to populate correctly
3. Create RPC to join appointments with call_logs for rich display

### Chosen Approach: Hybrid

Short-term (this PR):

1. Fix the AppointmentsTab to use call_logs via the existing `deriveAppointmentEvents` pattern
2. This immediately shows appointments to users
3. Keep Calendar tab but mark for deprecation

Medium-term (follow-up):

1. Fix the appointments table schema
2. Backfill existing booked call_logs to appointments
3. Merge tabs with view toggle

---

## Implementation Plan

### Phase 1: Fix AppointmentsTab (Immediate)

1. **Refactor AppointmentsTab** to fetch from call_logs and use `deriveAppointmentEvents`
   - This matches what CalendarTab already does
   - Ensures appointments show up immediately

2. **Add schema migration** for appointments table fixes:
   - Add `call_log_id UUID UNIQUE REFERENCES call_logs(id)`
   - Add missing columns if not present

3. **Fix vapi-webhook** to handle schema correctly:
   - Check if columns exist before inserting
   - Use correct column names

### Phase 2: Performance (This PR)

1. Ensure proper indexes on appointments (already done in migrations)
2. Use React Query with proper caching
3. Implement pagination for large lists

### Phase 3: Regression Prevention

1. Add smoke test for appointments flow
2. Verify webhook creates appointments
3. Verify tab displays correctly

## Changes Made

### Migration: `20251231000005_fix_appointments_call_log_link.sql`

- Adds `call_log_id` column to appointments with UNIQUE constraint
- Adds FK to call_logs
- Adds `source` column to track appointment origin
- Adds `window_description` for free-text time descriptions
- Adds composite indexes for efficient dashboard queries
- Updates status constraint to support both old and new status values

### AppointmentsTab.tsx

- Complete refactor to use **hybrid data fetching**:
  - Fetches from `call_logs` via `get_recent_calls` RPC
  - Uses `deriveAppointmentEvents` from `lib/appointments.ts`
  - Also fetches from `appointments` table (if populated)
  - Dedupes by `call_log_id` to prevent duplicates
- Changed default view to "Upcoming (7 days)" for better UX
- Added appointment cards with rich display:
  - Status badge (Upcoming/Past/Time TBD)
  - Customer name and phone
  - Service type with color indicator
  - Address when available
- Click-to-open drawer for full details

### vapi-webhook/index.ts

- Refactored `createAppointmentFromCall` with multi-strategy approach:
  1. Try upsert with `call_log_id` (preferred)
  2. Fall back to insert without `call_log_id` if constraint missing
  3. Schema-safe fallback removes problematic columns
- Better error handling and logging to `call_webhook_inbox`
- Fixed null reference bugs

### Backfill Script: `scripts/backfill-appointments.mjs`

- Idempotent backfill for existing booked call_logs
- Dry run mode (default) reports what would be created
- EXECUTE=true mode actually creates appointments
- Can target specific account with ACCOUNT_ID env var
- Logs every action in JSON for auditability

### Smoke Tests: `tests/e2e/dashboard-smoke.spec.ts`

- Added tests for Appointments tab:
  - Renders with timeframe dropdown
  - Shows empty state or appointment cards
  - Click opens drawer

---

## Verification Steps

### Build Verification

```bash
# All should pass
npm run build
npm run typecheck
npm run lint
```

### Manual Smoke Test

1. **Navigate to Dashboard → Appointments**
   - Should see appointments from booked calls (even if appointments table is empty)
   - Timeframe dropdown should work (7 days / 2 weeks / 2 months)

2. **Click an appointment card**
   - Drawer should open with call details
   - Should show customer name, phone, reason, summary

3. **Check timeframe filters**
   - Switching between filters should update the list
   - Empty state should show helpful message

### Backfill (if needed)

```bash
# Dry run - see what would be created
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/backfill-appointments.mjs

# Execute for real
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... EXECUTE=true node scripts/backfill-appointments.mjs

# Target specific account
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ACCOUNT_ID=... node scripts/backfill-appointments.mjs
```

### Regression Check

- [ ] Signup flow works
- [ ] Provisioning works
- [ ] Calls are logged correctly
- [ ] Webhook creates appointments for new booked calls
- [ ] Dashboard loads without errors

---

## Follow-up Items

1. **Calendar/Appointments Merge**: Fold CalendarTab into AppointmentsTab with view toggle
2. **Performance**: Add React Query caching to AppointmentsTab
3. **Pagination**: Add infinite scroll for accounts with many appointments
4. **Google Calendar Integration**: Use `scheduled_start_at` for sync
