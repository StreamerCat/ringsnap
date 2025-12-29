-- Migration: Update RLS for phone_numbers (Strict Canonical + Legacy)
-- Phase: Compatibility Sweep / Final Polish
-- Description: Allow access via assigned_account_id OR legacy account_id, with strict lifecycle checks
-- 1. Drop existing policies
DROP POLICY IF EXISTS "Users can view their account phone numbers" ON public.phone_numbers;
DROP POLICY IF EXISTS "Users can manage their account phone numbers" ON public.phone_numbers;
-- 2. Create STRICT view policy
CREATE POLICY "Users can view their account phone numbers" ON public.phone_numbers FOR
SELECT USING (
        (
            assigned_account_id = get_user_account_id(auth.uid())
            AND lifecycle_status = 'assigned'
        )
        OR (
            account_id = get_user_account_id(auth.uid())
            AND (
                lifecycle_status IS NULL
                OR lifecycle_status = 'assigned'
            )
        )
    );
-- 3. Create STRICT manage policy
CREATE POLICY "Users can manage their account phone numbers" ON public.phone_numbers FOR ALL USING (
    (
        assigned_account_id = get_user_account_id(auth.uid())
        AND lifecycle_status = 'assigned'
    )
    OR (
        account_id = get_user_account_id(auth.uid())
        AND (
            lifecycle_status IS NULL
            OR lifecycle_status = 'assigned'
        )
    )
);