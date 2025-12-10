-- Migration: Auto-trigger provision-vapi worker on job creation
-- Purpose: Immediately process provisioning jobs when they're created
-- Date: 2025-12-10
-- Benefits: Near-instant provisioning, no polling delay, no cron needed

-- ==============================================================================
-- PART 1: Create function to trigger provision-vapi worker
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.trigger_provision_worker()
RETURNS TRIGGER AS $$
DECLARE
  supabase_url TEXT;
  service_role_key TEXT;
  http_response RECORD;
BEGIN
  -- Get Supabase URL and service role key from app settings
  -- These should be set via ALTER DATABASE SET or session variables
  BEGIN
    supabase_url := current_setting('app.settings.supabase_url', true);
    service_role_key := current_setting('app.settings.service_role_key', true);
  EXCEPTION WHEN OTHERS THEN
    -- Fallback: Use environment variables if app settings not configured
    -- Note: This requires pg_net extension
    RAISE WARNING 'App settings not configured, skipping worker trigger';
    RETURN NEW;
  END;

  -- Only trigger if we have the required settings
  IF supabase_url IS NOT NULL AND service_role_key IS NOT NULL THEN
    -- Trigger the provision-vapi worker asynchronously
    -- Using pg_net.http_post for non-blocking HTTP request
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/provision-vapi',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || service_role_key,
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'triggered_by', 'database_trigger',
        'job_id', NEW.id,
        'account_id', NEW.account_id
      )
    );
    
    RAISE LOG 'Triggered provision-vapi worker for job %', NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.trigger_provision_worker IS
  'Automatically triggers the provision-vapi worker when a new provisioning job is created';

-- ==============================================================================
-- PART 2: Create trigger on provisioning_jobs table
-- ==============================================================================

DROP TRIGGER IF EXISTS on_provisioning_job_insert ON public.provisioning_jobs;

CREATE TRIGGER on_provisioning_job_insert
  AFTER INSERT ON public.provisioning_jobs
  FOR EACH ROW
  WHEN (NEW.status = 'queued')
  EXECUTE FUNCTION public.trigger_provision_worker();

COMMENT ON TRIGGER on_provisioning_job_insert ON public.provisioning_jobs IS
  'Triggers provision-vapi worker immediately when a new queued job is inserted';

-- ==============================================================================
-- PART 3: Grant permissions
-- ==============================================================================

GRANT EXECUTE ON FUNCTION public.trigger_provision_worker TO service_role;

-- ==============================================================================
-- PART 4: Instructions for setting app settings
-- ==============================================================================

-- To configure the Supabase URL and service role key, run these commands
-- in your Supabase SQL editor (replace with your actual values):

-- ALTER DATABASE postgres SET app.settings.supabase_url = 'https://rmyvvbqnccpfeyowidrq.supabase.co';
-- ALTER DATABASE postgres SET app.settings.service_role_key = 'your-service-role-key-here';

-- Or set them per-session (for testing):
-- SET app.settings.supabase_url = 'https://rmyvvbqnccpfeyowidrq.supabase.co';
-- SET app.settings.service_role_key = 'your-service-role-key-here';

-- ==============================================================================
-- PART 5: Fallback cron job (belt and suspenders approach)
-- ==============================================================================

-- In case the trigger fails or is disabled, also set up a cron job
-- to process any stuck jobs every minute

-- Note: This requires pg_cron extension
-- Run this separately in Supabase Dashboard → Database → Cron Jobs:

/*
SELECT cron.schedule(
  'process-stuck-provisioning-jobs',
  '* * * * *',  -- every minute
  $$
    SELECT
      net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/provision-vapi',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object('triggered_by', 'cron_fallback')
      )
    FROM provisioning_jobs
    WHERE status IN ('queued', 'failed')
      AND created_at > NOW() - INTERVAL '1 hour'
    LIMIT 1;
  $$
);
*/
