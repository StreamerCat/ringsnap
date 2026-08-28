-- Formalize the outbound_leads table under version control.
--
-- This table has been written to/read from by trigger-outbound-calls,
-- agent-trial-checkout, and add-outbound-dnc since those functions shipped,
-- but was created out-of-band and never had a tracked migration. This
-- migration is written defensively (IF NOT EXISTS / ADD COLUMN IF NOT
-- EXISTS throughout) so it is safe to run whether the table already exists
-- with a subset of these columns or doesn't exist yet.
--
-- Adds city/state so the outbound agent can confirm (and correct) a
-- prospect's location on the call instead of every outbound trial
-- defaulting to a hardcoded billing state.

CREATE TABLE IF NOT EXISTS public.outbound_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT,
  phone TEXT,
  city TEXT,
  state TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.outbound_leads ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.outbound_leads ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE public.outbound_leads ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.outbound_leads ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new';
ALTER TABLE public.outbound_leads ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE public.outbound_leads ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.outbound_leads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- trigger-outbound-calls' cron query filters status='new' ordered by created_at.
CREATE INDEX IF NOT EXISTS idx_outbound_leads_status_created_at
  ON public.outbound_leads (status, created_at);

CREATE INDEX IF NOT EXISTS idx_outbound_leads_phone
  ON public.outbound_leads (phone);

ALTER TABLE public.outbound_leads ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'outbound_leads' AND policyname = 'service_role_all_outbound_leads'
  ) THEN
    CREATE POLICY service_role_all_outbound_leads ON public.outbound_leads
      FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.outbound_call_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.outbound_leads(id),
  phone TEXT,
  vapi_call_id TEXT,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.outbound_checkout_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.outbound_leads(id),
  phone TEXT,
  email TEXT,
  stripe_session_id TEXT,
  stripe_customer_id TEXT,
  plan_key TEXT,
  checkout_url TEXT,
  status TEXT NOT NULL,
  account_id UUID,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- account_id/retry_count support retry-outbound-account-creation's durable
-- retry sweep for checkouts whose create-trial adoption failed (a failure
-- stripe-webhook can no longer recover on its own once record_stripe_event
-- has marked the originating Stripe event id as seen).
ALTER TABLE public.outbound_checkout_log ADD COLUMN IF NOT EXISTS account_id UUID;
ALTER TABLE public.outbound_checkout_log ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_outbound_checkout_log_status
  ON public.outbound_checkout_log (status, created_at);

CREATE INDEX IF NOT EXISTS idx_outbound_checkout_log_stripe_session_id
  ON public.outbound_checkout_log (stripe_session_id);

CREATE TABLE IF NOT EXISTS public.outbound_sms_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.outbound_leads(id),
  phone TEXT,
  body TEXT,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.outbound_call_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbound_checkout_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbound_sms_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'outbound_call_log' AND policyname = 'service_role_all_outbound_call_log'
  ) THEN
    CREATE POLICY service_role_all_outbound_call_log ON public.outbound_call_log
      FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'outbound_checkout_log' AND policyname = 'service_role_all_outbound_checkout_log'
  ) THEN
    CREATE POLICY service_role_all_outbound_checkout_log ON public.outbound_checkout_log
      FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'outbound_sms_log' AND policyname = 'service_role_all_outbound_sms_log'
  ) THEN
    CREATE POLICY service_role_all_outbound_sms_log ON public.outbound_sms_log
      FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;
