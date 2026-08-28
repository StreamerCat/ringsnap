-- Schedule the outbound call trigger to run every 15 minutes via pg_cron,
-- replacing the n8n schedule-trigger workflow. Runs entirely in UTC, so
-- there is no DST transition to handle.
--
-- Calls the trigger-outbound-calls edge function over HTTP using pg_net.
-- The function itself defaults to dry-run (OUTBOUND_DIALER_LIVE must be
-- explicitly set to "true" as an edge function secret before any real
-- call goes out), and requires the x-cron-secret header to match the
-- CRON_SECRET edge function secret.
--
-- Both secrets (edge_function_url, cron_secret) must be set once via:
--   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/trigger-outbound-calls', 'outbound_trigger_url');
--   select vault.create_secret('<same value as CRON_SECRET edge function secret>', 'outbound_trigger_cron_secret');
-- (Run manually in the SQL editor — never commit the actual values.)

-- Wrapped in DO blocks (matching 20251210120000_add_provision_vapi_cron.sql
-- and 20251210000001_auto_trigger_provision_worker.sql) so this migration
-- still succeeds where pg_cron isn't available, e.g. local CI.
DO $ext$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
  CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pg_cron/pg_net extension not available, skipping cron setup: %', SQLERRM;
END $ext$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'trigger-outbound-calls',
      '*/15 * * * *',
      $cron$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'outbound_trigger_url'),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'outbound_trigger_cron_secret')
        ),
        body := '{}'::jsonb
      );
      $cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to schedule trigger-outbound-calls cron job: %', SQLERRM;
END $do$;
