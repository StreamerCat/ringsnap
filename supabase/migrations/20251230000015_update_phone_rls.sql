-- Migration: Update RLS for assigned_account_id support
-- Phase: Compatibility Sweep
-- Description: Allow users to view/manage phone numbers via assigned_account_id OR account_id
-- 1. Drop existing policies
DROP POLICY IF EXISTS "Users can view their account phone numbers" ON public.phone_numbers;
DROP POLICY IF EXISTS "Users can manage their account phone numbers" ON public.phone_numbers;
-- 2. recreate view policy
CREATE POLICY "Users can view their account phone numbers" ON public.phone_numbers FOR
SELECT USING (
        assigned_account_id = get_user_account_id(auth.uid())
        OR account_id = get_user_account_id(auth.uid())
    );
-- 3. recreate manage policy
CREATE POLICY "Users can manage their account phone numbers" ON public.phone_numbers FOR ALL USING (
    assigned_account_id = get_user_account_id(auth.uid())
    OR account_id = get_user_account_id(auth.uid())
);