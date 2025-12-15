-- FINAL RLS FIX
-- We are removing the dependency on the helper function for `call_logs` visibility.
-- Using a direct EXISTS check is more standard and should work if you are in the members table.

ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

-- 1. Drop old policies
DROP POLICY IF EXISTS "Users can view their account call logs" ON public.call_logs;
DROP POLICY IF EXISTS "Account members can view call logs" ON public.call_logs;
DROP POLICY IF EXISTS "view_call_logs" ON public.call_logs;

-- 2. Create Simple Policy
-- logic: "I can see a call log IF I am a member of the account linked to that log"
CREATE POLICY "safe_view_call_logs"
ON public.call_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.account_members am
    WHERE am.account_id = call_logs.account_id
    AND am.user_id = auth.uid()
  )
);

-- 3. Verify Service Role policy still exists (or recreate it to be safe)
DROP POLICY IF EXISTS "Service role can manage call logs" ON public.call_logs;
CREATE POLICY "Service role can manage call logs"
ON public.call_logs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 4. Grant permissions (just in case)
GRANT SELECT ON public.call_logs TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.call_logs TO service_role;
