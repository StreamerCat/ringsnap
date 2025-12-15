-- COMPREHENSIVE FIX FOR DASHBOARD DATA ISSUES

-- 1. FIX CALL LOGS: Ensure Unique Constraint for Webhook Upserts
-- This is critical for the vapi-webhook to successfully save calls.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'call_logs_vapi_call_id_key') THEN
    ALTER TABLE public.call_logs ADD CONSTRAINT call_logs_vapi_call_id_key UNIQUE (vapi_call_id);
  END IF;
END $$;

-- 2. FIX CALL LOGS: Ensure RLS Policy Exists for Viewing
-- Enables RLS and adds a specific policy using the secure helper function to avoid recursion.
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their account call logs" ON public.call_logs;

CREATE POLICY "Users can view their account call logs"
ON public.call_logs FOR SELECT
TO authenticated
USING (
  account_id IN (SELECT account_id FROM public.get_my_account_ids())
);

-- 3. FIX PROVISIONING STATUS: Unstick "Pending" Accounts

-- First, ensure the columns exist (handling schema drift if previous migrations were missed)
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS provisioning_started_at TIMESTAMPTZ;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS provisioning_completed_at TIMESTAMPTZ;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS provisioning_error TEXT;

-- If an account has a Vapi phone number but is still marked 'pending', force it to 'completed'.
-- This fixes the UI "stuck on provisioning" issue for accounts that actually succeeded.
UPDATE public.accounts
SET 
  provisioning_status = 'completed',
  provisioning_completed_at = COALESCE(provisioning_completed_at, now()),
  updated_at = now()
WHERE provisioning_status = 'pending'
  AND vapi_phone_number IS NOT NULL
  AND vapi_phone_number != '';
