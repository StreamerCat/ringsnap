-- Schedule retry-outbound-account-creation to sweep for failed outbound
-- checkout adoptions every 15 minutes via pg_cron.
--
-- Failures happen when stripe-webhook's call to create-trial errors or is
-- rejected after record_stripe_event has already marked the originating
-- Stripe event id as seen — Stripe will never redeliver that webhook, so
-- without this sweep a prospect who genuinely paid could be left with a
-- live subscription and no RingSnap account.
--
-- Both secrets (edge_function_url, cron_secret) must be set once via:
--   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/retry-outbound-account-creation', 'outbound_retry_url');
--   select vault.create_secret('<same value as CRON_SECRET edge function secret>', 'outbound_retry_cron_secret');
-- (Run manually in the SQL editor — never commit the actual values. The
-- cron_secret value is the same CRON_SECRET already used by
-- trigger-outbound-calls, so outbound_trigger_cron_secret can be reused
-- here instead of creating a duplicate vault entry.)

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
      'retry-outbound-account-creation',
      '*/15 * * * *',
      $cron$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'outbound_retry_url'),
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
  RAISE WARNING 'Failed to schedule retry-outbound-account-creation cron job: %', SQLERRM;
END $do$;
