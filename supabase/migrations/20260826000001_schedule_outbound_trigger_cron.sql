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
--   select vault.create_secret('https://<project-ref>.functions.supabase.co/trigger-outbound-calls', 'outbound_trigger_url');
--   select vault.create_secret('<same value as CRON_SECRET edge function secret>', 'outbound_trigger_cron_secret');
-- (Run manually in the SQL editor — never commit the actual values.)

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'trigger-outbound-calls',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'outbound_trigger_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'outbound_trigger_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
