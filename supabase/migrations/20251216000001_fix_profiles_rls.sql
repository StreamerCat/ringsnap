-- Allow users to view profiles of other users in the same account (Team Tab fix)

DROP POLICY IF EXISTS "Users can view profiles in their account" ON public.profiles;

CREATE POLICY "Users can view profiles in their account"
ON public.profiles FOR SELECT
TO authenticated
USING (
  -- Target profile belongs to an account accessible to the current user
  account_id IN (
    SELECT account_id FROM public.profiles WHERE id = auth.uid()
  )
  OR
  account_id IN (
    SELECT account_id FROM public.account_members WHERE user_id = auth.uid()
  )
);
