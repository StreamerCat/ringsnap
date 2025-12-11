
-- 1. Drop existing strict policies
DROP POLICY IF EXISTS "Users can view analytics_events for their account" ON public.analytics_events;
DROP POLICY IF EXISTS "Users can insert analytics_events for their account" ON public.analytics_events;

-- 2. Create new policies

-- Allow users to view their own account events OR any event if they are a staff/admin (based on email domain or role)
-- For now, to allow the "Sales Dashboard" to work for failed signups (where account_id is null), 
-- we will allow authenticated users to see events where account_id is NULL or matches their account.
CREATE POLICY "Users can view relevant analytics_events"
  ON public.analytics_events
  FOR SELECT
  USING (
    account_id IN (
      SELECT account_id FROM public.profiles WHERE id = auth.uid()
    )
    OR
    account_id IS NULL -- Allow seeing failed signups
  );

-- Allow inserting with null account_id (handled by service role usually, but good for completeness)
CREATE POLICY "Users can insert analytics_events"
  ON public.analytics_events
  FOR INSERT
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.profiles WHERE id = auth.uid()
    )
    OR
    account_id IS NULL
  );
