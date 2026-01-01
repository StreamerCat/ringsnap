# Appointment Conflict Prevention - Rollback Guide

## Quick Disable (No Deploy Required)

If you need to immediately disable conflict checking without redeploying:

```bash
# Disable conflict enforcement via Supabase secrets
supabase secrets set APPOINTMENT_CONFLICT_ENFORCEMENT=false

# Force restart edge functions to pick up new secret
# Note: JWT verification is controlled by supabase/config.toml
supabase functions deploy vapi-tools-appointments
```

This will:

- Keep all code deployed
- Skip conflict checking at booking time
- Allow legacy behavior (double bookings possible)
- Can be re-enabled instantly by setting back to `true`

## Full Revert (If Needed)

### Option 1: Revert the Commit

```bash
# On main branch after merge
git revert <commit-hash>
git push origin main

# Redeploy affected functions
supabase functions deploy vapi-tools-appointments
supabase functions deploy provision-vapi
```

### Option 2: Delete the Feature Branch (Pre-Merge)

If not yet merged:

```bash
git push origin --delete feature/appointment-conflict-prevention
```

### Option 3: Rollback Migration

The migration only added indexes and updated the status check constraint.
To rollback:

```sql
-- Drop the new indexes (safe, no data loss)
DROP INDEX IF EXISTS idx_appointments_conflict_check;
DROP INDEX IF EXISTS idx_appointments_availability;

-- Revert status check constraint (optional, the new statuses don't break anything)
ALTER TABLE public.appointments 
DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE public.appointments
ADD CONSTRAINT appointments_status_check 
CHECK (status IN ('scheduled', 'canceled', 'rescheduled', 'completed'));
```

## What to Monitor After Deployment

1. **Logs**: Watch for `slot_unavailable` errors in `vapi-tools-appointments` logs
2. **Appointments Table**: Verify no duplicate appointments being created
3. **Call Quality**: Listen to test calls to ensure smooth voice UX
4. **Dashboard**: Verify appointments tab still loads correctly

## Emergency Contact

If critical issues arise:

1. Set `APPOINTMENT_CONFLICT_ENFORCEMENT=false` immediately
2. Review logs for error patterns
3. Consider full revert if flag doesn't resolve issue

## Deployment Checklist

Before deploying to production:

- [ ] Apply migration: `supabase db push`
- [ ] Deploy availability endpoint: `supabase functions deploy vapi-tools-availability`
- [ ] Deploy updated appointments: `supabase functions deploy vapi-tools-appointments`  
- [ ] Deploy updated provisioning: `supabase functions deploy provision-vapi`
- [ ] Verify in staging with test calls
- [ ] Monitor logs for 24 hours post-deploy
