-- Migration: Hardened RLS for phone_numbers
-- Phase: Compatibility Sweep / Hardening
-- Description: Split policies to enforce strict constraints. No FOR ALL.
ALTER TABLE public.phone_numbers ENABLE ROW LEVEL SECURITY;
-- 1. Drop existing policies
DROP POLICY IF EXISTS "Users can view their account phone numbers" ON public.phone_numbers;
DROP POLICY IF EXISTS "Users can manage their account phone numbers" ON public.phone_numbers;
DROP POLICY IF EXISTS "Users can update their account phone numbers" ON public.phone_numbers;
-- 2. SELECT Policy
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
-- 3. UPDATE Policy (with CHECK constraint)
CREATE POLICY "Users can update their account phone numbers" ON public.phone_numbers FOR
UPDATE USING (
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
    ) WITH CHECK (
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