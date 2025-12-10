# Supabase Cron Configuration for Provisioning Worker

## Add to Supabase Dashboard

1. Go to **Supabase Dashboard** → **Database** → **Cron Jobs**
2. Click **"Create a new cron job"**
3. Configure as follows:

**Job Name**: `process-provisioning-jobs`

**Schedule**: `*/30 * * * * *` (every 30 seconds)
- Or use: `* * * * *` (every minute) if 30-second intervals aren't supported

**SQL Command**:
```sql
SELECT
  net.http_post(
    url := 'https://rmyvvbqnccpfeyowidrq.supabase.co/functions/v1/provision-vapi',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('triggered_by', 'cron')
  );
```

**Alternative (if net.http_post doesn't work)**:
Use Supabase's webhook feature:
1. Go to **Database** → **Webhooks**
2. Create webhook for `provisioning_jobs` table
3. Trigger on: `INSERT` events
4. Webhook URL: `https://rmyvvbqnccpfeyowidrq.supabase.co/functions/v1/provision-vapi`
5. HTTP Headers: `Authorization: Bearer [SERVICE_ROLE_KEY]`

## Verify Cron is Running

```sql
-- Check cron jobs
SELECT * FROM cron.job;

-- Check cron job run history
SELECT * FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;
```

## Alternative: Database Trigger (Immediate Processing)

Instead of polling, trigger the worker immediately when a job is inserted:

```sql
CREATE OR REPLACE FUNCTION trigger_provision_worker()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/provision-vapi',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'triggered_by', 'database_trigger',
      'job_id', NEW.id
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_provisioning_job_insert
  AFTER INSERT ON provisioning_jobs
  FOR EACH ROW
  WHEN (NEW.status = 'queued')
  EXECUTE FUNCTION trigger_provision_worker();
```

This will trigger the worker immediately when a new job is created, providing near-instant provisioning!
