# Error Handling Rollback Guide

**Purpose:** Quick reference for reverting structured error handling if issues arise  
**Risk Level:** 🔴 HIGH - Follow this guide carefully

---

## 🚨 When to Rollback

Rollback immediately if you observe:

- ✅ Signup success rate drops
- ✅ Provisioning failures increase
- ✅ Users report "stuck" signup flows
- ✅ Stripe resources not being created
- ✅ Accounts created without Stripe subscriptions
- ✅ Any regression in trial creation flow

---

## Option 1: Immediate Rollback (No Code Deploy) ⚡

**Time:** ~2 minutes  
**Risk:** Minimal  
**Recommended:** Use this first

### Steps

1. **Disable Feature Flag**

   Via Supabase Dashboard:
   ```
   1. Go to Supabase Dashboard
   2. Navigate to Edge Functions → create-trial
   3. Click "Secrets" or "Environment Variables"
   4. Set: ENABLE_STRUCTURED_TRIAL_ERRORS = false
   5. Save changes
   ```

   Via Supabase CLI:
   ```bash
   supabase secrets set ENABLE_STRUCTURED_TRIAL_ERRORS=false --project-ref [your-project-ref]
   ```

2. **Verify Rollback**

   - Test signup with valid card
   - Test signup with declined card
   - Verify behavior matches baseline
   - Check Supabase logs for confirmation

3. **Monitor**

   - Watch signup success rate (should stabilize)
   - Check error logs (should return to baseline patterns)
   - Verify no new issues

### Result

- ✅ `create-trial` reverts to legacy error behavior
- ✅ Frontend still works (defensive implementation)
- ✅ No code deployment needed
- ✅ Can re-enable flag later after investigation

---

## Option 2: Full Code Rollback (If Flag Rollback Insufficient) 🔄

**Time:** ~15 minutes  
**Risk:** Low (reverting to known-good state)  
**Use When:** Flag rollback doesn't resolve issues

### Backend Rollback

1. **Identify Commit to Revert**

   ```bash
   cd /Users/joshuasturgeon/RingSnap\ Repo\ /ringsnap
   git log --oneline supabase/functions/create-trial/index.ts
   ```

   Look for commit with message like:
   - "Add structured error handling to create-trial"
   - "Implement feature-flagged error responses"

2. **Revert Commit**

   ```bash
   git revert [commit-hash]
   # Or if multiple commits:
   git revert [commit-hash-1] [commit-hash-2]
   ```

3. **Deploy Reverted Function**

   ```bash
   supabase functions deploy create-trial
   ```

4. **Verify Deployment**

   ```bash
   # Check function logs
   supabase functions logs create-trial --tail
   
   # Test signup
   # Should see old error format in logs
   ```

### Frontend Rollback

1. **Revert Frontend Changes**

   ```bash
   # Revert error utility
   git revert [commit-hash-for-errors.ts]
   
   # Revert signup flow changes
   git revert [commit-hash-for-onboarding-changes]
   ```

2. **Rebuild and Deploy**

   ```bash
   npm run build
   
   # Deploy via Vercel (automatic if connected to git)
   # Or manual:
   vercel --prod
   ```

3. **Verify Deployment**

   - Test signup flow
   - Verify error messages
   - Check console logs

---

## Option 3: Partial Rollback (Backend Only) 🎯

**Use When:** Frontend is fine, backend has issues

### Steps

1. Follow "Backend Rollback" steps above
2. Keep frontend changes (they're defensive and handle both formats)
3. Set `ENABLE_STRUCTURED_TRIAL_ERRORS=false` as safety measure

---

## Post-Rollback Checklist

After any rollback:

- [ ] Test successful signup (valid card)
- [ ] Test failed signup (declined card)
- [ ] Verify Stripe customer creation
- [ ] Verify Stripe subscription creation
- [ ] Verify account creation
- [ ] Verify user authentication
- [ ] Verify provisioning flow
- [ ] Check Supabase logs for errors
- [ ] Monitor signup success rate for 1 hour
- [ ] Document what went wrong
- [ ] Plan fix before re-enabling

---

## Monitoring After Rollback

### Supabase Logs

```sql
-- Check for create-trial errors
SELECT * FROM edge_logs 
WHERE function_name = 'create-trial' 
  AND level = 'error'
  AND timestamp > NOW() - INTERVAL '1 hour'
ORDER BY timestamp DESC;

-- Check signup success rate
SELECT 
  DATE_TRUNC('hour', timestamp) as hour,
  COUNT(*) as total_attempts,
  COUNT(*) FILTER (WHERE event_message LIKE '%success%') as successful
FROM edge_logs
WHERE function_name = 'create-trial'
  AND timestamp > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;
```

### Stripe Dashboard

- Check for orphaned customers (customers without subscriptions)
- Check for failed payment attempts
- Verify trial subscriptions are being created

### Frontend Monitoring

- Check browser console for errors
- Verify error messages are appropriate
- Test retry functionality

---

## Re-Enabling After Rollback

Before re-enabling structured errors:

1. **Identify Root Cause**
   - What went wrong?
   - Was it backend or frontend?
   - Was it a specific error type?

2. **Fix the Issue**
   - Create fix in feature branch
   - Test thoroughly in local environment
   - Test in staging environment

3. **Re-test Baseline**
   - Capture new baseline
   - Compare to original baseline
   - Verify no regressions

4. **Gradual Re-enable**
   - Enable flag in staging first
   - Monitor for 24 hours
   - Enable in production
   - Monitor closely

---

## Emergency Contacts

If rollback doesn't resolve issues:

1. **Check Recent Deployments**
   - Was there another deployment around the same time?
   - Could there be an interaction?

2. **Check Supabase Status**
   - https://status.supabase.com
   - Any ongoing incidents?

3. **Check Stripe Status**
   - https://status.stripe.com
   - Any API issues?

---

## Rollback History

Document all rollbacks here:

### [Date] - [Reason]
- **Trigger:** [What caused the rollback]
- **Method:** [Flag/Code/Partial]
- **Duration:** [How long until resolved]
- **Root Cause:** [What was the issue]
- **Fix:** [How it was resolved]
- **Lessons Learned:** [What we learned]

---

## Prevention

To avoid needing rollbacks:

- ✅ Always capture baseline before changes
- ✅ Test with flag OFF first
- ✅ Test with flag ON in staging
- ✅ Monitor closely after enabling
- ✅ Have rollback plan ready
- ✅ Document all changes
- ✅ Use feature flags for risky changes

---

**Last Updated:** 2025-12-11  
**Maintained By:** RingSnap Engineering Team  
**Status:** Active
