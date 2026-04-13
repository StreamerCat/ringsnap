-- Migration: Add cron job for provision-vapi worker
-- Purpose: Automatically process queued provisioning jobs every minute
-- Date: 2025-12-10
-- Note: Wraps cron setup in a DO block so migration succeeds even if pg_cron
-- is not available (e.g. local CI).  pg_cron is available in Supabase hosted
-- environments and the cron job will be active in production.

-- Enable pg_cron extension if available
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pg_cron extension not available, skipping cron setup: %', SQLERRM;
END $$;

-- Schedule provision-vapi worker to run every minute (cron standard 5-field format)
-- Uses a DO block so the migration succeeds gracefully if pg_cron is absent.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'process-provisioning-jobs',
      '* * * * *',
      $$
        SELECT
          net.http_post(
            url := current_setting('app.settings.supabase_url') || '/functions/v1/provision-vapi',
            headers := jsonb_build_object(
              'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
              'Content-Type', 'application/json'
            ),
            body := jsonb_build_object('triggered_by', 'cron')
          );
      $$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to schedule provision-vapi cron job: %', SQLERRM;
END $$;
