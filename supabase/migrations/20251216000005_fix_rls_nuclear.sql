-- FIX RLS RECURSION: The "Nuclear Option"
-- We create a SECURITY DEFINER function to check membership.
-- This runs with "superuser-like" privileges (Service Role),
-- ensuring it NEVER triggers the `account_members` RLS policy,
-- thus theoretically impossible to cause recursion.

-- 1. Create the Security Definer Check Function
CREATE OR REPLACE FUNCTION public.is_member_of(_account_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- <--- THE KEY: Bypasses RLS on accessed tables
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.account_members 
    WHERE account_id = _account_id 
      AND user_id = auth.uid()
  );
END;
$$;

-- 2. Update Call Logs Policy to use it
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "safe_view_call_logs" ON public.call_logs;
DROP POLICY IF EXISTS "Users can view their account call logs" ON public.call_logs;

CREATE POLICY "final_view_call_logs"
ON public.call_logs FOR SELECT
TO authenticated
USING (
  public.is_member_of(account_id)
);

-- 3. Just to be absolutely sure, let's fix account_members too
-- (Only allow users to view their OWN row, effectively)
-- This is strict but safe for the dashboard.
DROP POLICY IF EXISTS "simple_view_own_membership" ON public.account_members;

CREATE POLICY "simple_view_own_membership"
ON public.account_members FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
);
