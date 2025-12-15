-- FIX SCRIPT: Sync Account Phone Numbers and Status
-- Run this to fix "Stuck Provisioning" and ensure Logs are visible.

-- 1. Sync Phone Numbers from `phone_numbers` table to `accounts` table
-- This fixes the missing phone number in the dashboard header.
UPDATE public.accounts a
SET vapi_phone_number = pn.phone_number
FROM public.phone_numbers pn
WHERE a.id = pn.account_id
  AND (a.vapi_phone_number IS NULL OR a.vapi_phone_number = '');

-- 2. Force Provisioning Status to Completed if we have a number
-- This fixes the "Stuck on Provisioning" card.
UPDATE public.accounts
SET 
  provisioning_status = 'completed',
  provisioning_completed_at = COALESCE(provisioning_completed_at, now())
WHERE vapi_phone_number IS NOT NULL
  AND provisioning_status != 'completed';

-- 3. ENSURE Call Logs are Visible (Fix RLS)
-- We drop and recreate the policy to be absolutely sure it's correct.
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their account call logs" ON public.call_logs;
DROP POLICY IF EXISTS "Service role can manage call logs" ON public.call_logs;

-- Policy: Users can see logs for their account
CREATE POLICY "Users can view their account call logs"
ON public.call_logs FOR SELECT
TO authenticated
USING (
  account_id IN (
    SELECT account_id FROM public.account_members 
    WHERE user_id = auth.uid()
  )
);

-- Policy: Service Role can do everything (required for Webhook)
CREATE POLICY "Service role can manage call logs"
ON public.call_logs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 4. Verify the fixes
SELECT id, company_name, vapi_phone_number, provisioning_status 
FROM public.accounts 
WHERE vapi_phone_number IS NOT NULL 
LIMIT 5;
