# Appointment Conflict Prevention - Smoke Test Checklist

## Overview

This checklist validates Phase 1 of the double-booking prevention system.

## Prerequisites

- [ ] Staging or production environment with:
  - `APPOINTMENT_CONFLICT_ENFORCEMENT` not set (defaults to ON) or set to `true`
  - `APPOINTMENTS_VAPI_TOOL_ENABLED=true`
- [ ] Test account with provisioned assistant and phone number
- [ ] Supabase dashboard access for DB verification
- [ ] Migration `20251230100001_appointment_conflict_indexes.sql` applied

---

## Test 1: Availability Tool Returns Slots

**Objective**: Verify `check_availability` tool works and returns business hour slots.

**Steps**:

1. Call the test phone number
2. Say "I'd like to schedule an appointment for tomorrow"
3. Observe the assistant's response

**Expected**:

- Assistant should call `check_availability` tool (visible in Vapi logs)
- Assistant should offer specific times like "I have openings at 9 AM, 10 AM, and 11 AM..."
- Should NOT invent times without tool call

**Verification**:

- [ ] Check Supabase logs for `vapi-tools-availability` invocation
- [ ] Confirm response contains `availableSlots` array

---

## Test 2: Availability Excludes Booked Slots

**Objective**: Verify that a booked time slot is not offered.

**Steps**:

1. Create a test appointment directly in DB:

```sql
INSERT INTO appointments (
  account_id, vapi_call_id, caller_name, caller_phone,
  scheduled_start_at, time_zone, status
) VALUES (
  '{{ACCOUNT_ID}}', 'test-123', 'Smith Test', '+15551234567',
  '{{TOMORROW_DATE}}T10:00:00-07:00', 'America/Denver', 'scheduled'
);
```

2. Call the test phone number
2. Say "Do you have availability tomorrow?"

**Expected**:

- 10:00 AM should NOT be in the offered times
- Other slots (9 AM, 11 AM, etc.) should be available

**Verification**:

- [ ] In Vapi logs, check `check_availability` response
- [ ] Confirm 10:00 is NOT in `availableSlots`

---

## Test 3: Booking Creates Appointment

**Objective**: Verify `book_appointment` tool successfully creates appointment.

**Steps**:

1. Call the test phone number
2. Say "I'd like to schedule an appointment for tomorrow at 2 PM"
3. Provide name and phone when asked
4. Confirm the booking

**Expected**:

- Assistant confirms booking with time
- Says confirmation text/email will be sent

**Verification**:

- [ ] Check `appointments` table for new row
- [ ] Verify `scheduled_start_at` is correct
- [ ] Verify `account_id` matches test account
- [ ] Check logs for `vapi-tools-appointments` success

---

## Test 4: Double-Booking Prevention (Write-Time)

**Objective**: Verify that booking a conflicting slot returns alternatives.

**Steps**:

1. Keep the 2 PM appointment from Test 3
2. Call the test phone number again
3. Say "I'd like to book an appointment for tomorrow at 2 PM"
4. Observe response when trying to book

**Expected**:

- If assistant uses `check_availability` first: 2 PM won't be offered
- If caller insists on 2 PM: `book_appointment` should return `slot_unavailable`
- Assistant should offer alternative times

**Verification**:

- [ ] Check logs for `slot_unavailable` error in tool response
- [ ] Verify `alternativeSlots` in response
- [ ] Confirm NO duplicate appointment was created

---

## Test 5: Race Condition Protection

**Objective**: Verify concurrent booking attempts don't create duplicates.

**Steps**:

1. Clear all test appointments for tomorrow 3 PM
2. Open two phone lines simultaneously (or use two tests in parallel)
3. Both callers request "appointment tomorrow at 3 PM" at same time
4. Both provide details and try to confirm

**Expected**:

- Only ONE appointment should be created
- Second caller should hear "that time is no longer available"

**Verification**:

- [ ] Query appointments for that time slot
- [ ] Should return exactly 1 row, not 2

---

## Test 6: Feature Flag Off

**Objective**: Verify system works with enforcement disabled (backward compatibility).

**Steps**:

1. Set `APPOINTMENT_CONFLICT_ENFORCEMENT=false` in Supabase secrets
2. Redeploy edge functions
3. Try to book a conflicting time

**Expected**:

- Booking should succeed (legacy behavior)
- No conflict check performed

**Verification**:

- [ ] Logs should NOT show "Checking for slot conflicts"
- [ ] Duplicate appointments are allowed (as before)

**Cleanup**:

- [ ] Remove or set `APPOINTMENT_CONFLICT_ENFORCEMENT=true`
- [ ] Redeploy edge functions

---

## Test 7: Other Flows Still Work

**Objective**: Verify no regressions in core functionality.

### 7a. Signup Flow

- [ ] New user can complete signup form
- [ ] Account is created
- [ ] Provisioning job is queued

### 7b. Provisioning

- [ ] Phone number is provisioned successfully
- [ ] Assistant is created with both tools (`check_availability` AND `book_appointment`)
- [ ] ServerUrls point to correct endpoints

### 7c. Dashboard

- [ ] Dashboard loads without errors
- [ ] Appointments tab shows appointments
- [ ] Today tab shows overview
- [ ] Call logs display correctly

### 7d. Reminders

- [ ] Reminder dispatcher still runs
- [ ] Test appointment receives reminder (if within window)

---

## Database Verification Queries

### Check appointment was created

```sql
SELECT id, account_id, caller_name, scheduled_start_at, status, created_at
FROM appointments
WHERE account_id = '{{ACCOUNT_ID}}'
ORDER BY created_at DESC
LIMIT 5;
```

### Check for duplicates

```sql
SELECT scheduled_start_at, COUNT(*) as count
FROM appointments
WHERE account_id = '{{ACCOUNT_ID}}'
  AND status IN ('scheduled', 'confirmed', 'rescheduled')
GROUP BY scheduled_start_at
HAVING COUNT(*) > 1;
```

### Verify indexes exist

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'appointments'
  AND indexname LIKE '%conflict%' OR indexname LIKE '%availability%';
```

---

## Log Verification

### Check availability tool logs

```
Search logs for: "vapi-tools-availability"
Expected entries:
- "Checking availability" with accountId, date
- "Availability calculated" with slotsReturned count
```

### Check booking tool logs

```
Search logs for: "vapi-tools-appointments"
Expected entries:
- "Checking for slot conflicts" (if enabled)
- "Appointment created/confirmed" OR "Slot conflict detected"
```

---

## Cleanup

After testing, clean up test data:

```sql
-- Delete test appointments
DELETE FROM appointments
WHERE vapi_call_id LIKE 'test-%'
   OR vapi_call_id LIKE 'smoke-test-%'
   OR caller_name LIKE '%Test%';
```

---

## Sign-off

| Test | Passed | Tester | Date |
|------|--------|--------|------|
| Test 1: Availability Returns Slots | | | |
| Test 2: Excludes Booked Slots | | | |
| Test 3: Booking Creates Appointment | | | |
| Test 4: Double-Booking Prevention | | | |
| Test 5: Race Condition | | | |
| Test 6: Feature Flag | | | |
| Test 7a: Signup Flow | | | |
| Test 7b: Provisioning | | | |
| Test 7c: Dashboard | | | |
| Test 7d: Reminders | | | |

**Overall Status**: ____________

**Notes**:
