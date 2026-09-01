-- Cardless outbound trial: the outbound Vapi agent creates a real trial
-- account with no card during the call. `trial_payment_method_added` tracks
-- whether the customer has since added a card from the dashboard (set by
-- stripe-payment-method-default on a successful attach); the
-- pause-expired-cardless-trials cron uses it to find trials that expired
-- without ever getting a card, without having to call Stripe per account.

ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS trial_payment_method_added BOOLEAN NOT NULL DEFAULT false;

-- Schedule the cardless-trial-expiry sweep to run hourly via pg_cron. Mirrors
-- 20260826000001_schedule_outbound_trigger_cron.sql's pattern exactly —
-- reuses the same CRON_SECRET edge function secret, needs its own
-- 'pause_expired_cardless_trials_url' vault secret pointing at this
-- function's URL:
--   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/pause-expired-cardless-trials', 'pause_expired_cardless_trials_url');
-- (Run manually in the SQL editor — never commit the actual value.)
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
      'pause-expired-cardless-trials',
      '0 * * * *',
      $cron$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'pause_expired_cardless_trials_url'),
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
  RAISE WARNING 'Failed to schedule pause-expired-cardless-trials cron job: %', SQLERRM;
END $do$;
