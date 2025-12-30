# Appointments Tab Fixes & UX Improvements

## Changes

- **Database Schema**: Fixed missing `scheduled_start_at` and other columns in `appointments` table. Added migration `20251230000031_fix_appointments_schema.sql`.
- **Appointments Tab**:
  - Added filter dropdown: Day / Week / Month.
  - **Day View**: Shows appointments booked today OR scheduled for today/future.
  - **Week/Month View**: Shows appointments booked within the selected timeframe.
  - Fixed sorting to be Ascending (Upcoming first).
  - Improved Empty State with clear messaging.

## Testing

1. **Smoke Test**: Navigate to Dashboard -> Appointments.
2. **Verify Load**: Confirm no "42703" error.
3. **Day Filter**: Should show appointments relevant to today (created or occurring).
4. **Week/Month Filter**: Toggle and verify list updates.
5. **Sorting**: Verify earliest scheduled time is top.
