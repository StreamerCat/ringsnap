-- Allow authenticated users to view profiles of other users who share the same account/team
-- This solves the issue where a team member's profile is hidden because their 'primary' account_id 
-- is different from the team they are currently being viewed in.
CREATE POLICY "view_fellow_team_members" ON public.profiles FOR
SELECT TO authenticated USING (
        -- I can see you if we are both members of the same account
        EXISTS (
            SELECT 1
            FROM public.account_members my_membership
                JOIN public.account_members their_membership ON my_membership.account_id = their_membership.account_id
            WHERE my_membership.user_id = auth.uid()
                AND their_membership.user_id = profiles.id
        )
    );