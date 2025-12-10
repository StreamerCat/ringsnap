-- Migration: Add cron job for provision-vapi worker
-- Purpose: Automatically process queued provisioning jobs every 5 seconds
-- Date: 2025-12-10
-- Note: Matches frontend polling interval for faster retry attempts

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule provision-vapi worker to run every 5 seconds
-- This ensures stuck jobs are retried quickly and aligns with frontend polling
SELECT cron.schedule(
  'process-provisioning-jobs',  -- job name
  '*/5 * * * * *',               -- every 5 seconds (cron format with seconds)
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

COMMENT ON EXTENSION pg_cron IS 'Cron-based job scheduler for PostgreSQL';
