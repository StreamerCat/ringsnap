-- Staff (platform_owner/platform_admin) read access to the cold-outbound
-- pipeline tables, plus lead-management columns to support the admin
-- Leads tab (notes, campaign grouping, and scheduled dialing).
--
-- Reuses the existing public.user_is_staff() helper (added in
-- 20251209000001_fix_accounts_infinite_recursion.sql) so staff can read
-- these tables from the client with their own session, the same pattern
-- already used for accounts/phone_numbers/assistants. RLS is already
-- enabled on all four tables with service-role-only policies (see
-- 20260828230000_formalize_outbound_leads_schema.sql) — this only adds a
-- SELECT policy for authenticated staff, leaving service-role write access
-- untouched.

ALTER TABLE public.outbound_leads ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.outbound_leads ADD COLUMN IF NOT EXISTS campaign TEXT;
ALTER TABLE public.outbound_leads ADD COLUMN IF NOT EXISTS scheduled_after TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_outbound_leads_campaign ON public.outbound_leads (campaign);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'outbound_leads' AND policyname = 'staff_read_outbound_leads'
  ) THEN
    CREATE POLICY staff_read_outbound_leads ON public.outbound_leads
      FOR SELECT TO authenticated
      USING (public.user_is_staff(ARRAY['platform_admin', 'platform_owner']));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'outbound_call_log' AND policyname = 'staff_read_outbound_call_log'
  ) THEN
    CREATE POLICY staff_read_outbound_call_log ON public.outbound_call_log
      FOR SELECT TO authenticated
      USING (public.user_is_staff(ARRAY['platform_admin', 'platform_owner']));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'outbound_checkout_log' AND policyname = 'staff_read_outbound_checkout_log'
  ) THEN
    CREATE POLICY staff_read_outbound_checkout_log ON public.outbound_checkout_log
      FOR SELECT TO authenticated
      USING (public.user_is_staff(ARRAY['platform_admin', 'platform_owner']));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'outbound_sms_log' AND policyname = 'staff_read_outbound_sms_log'
  ) THEN
    CREATE POLICY staff_read_outbound_sms_log ON public.outbound_sms_log
      FOR SELECT TO authenticated
      USING (public.user_is_staff(ARRAY['platform_admin', 'platform_owner']));
  END IF;
END $$;
