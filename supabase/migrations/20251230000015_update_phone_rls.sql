-- Migration: Hardened RLS for phone_numbers (Final)
-- Phase: Compatibility Sweep / Hardening
-- Description: Split policies, enforced TO authenticated, strict constraints.
ALTER TABLE public.phone_numbers ENABLE ROW LEVEL SECURITY;
-- 1. Drop existing policies
DROP POLICY IF EXISTS "Users can view their account phone numbers" ON public.phone_numbers;
DROP POLICY IF EXISTS "Users can manage their account phone numbers" ON public.phone_numbers;
DROP POLICY IF EXISTS "Users can update their account phone numbers" ON public.phone_numbers;
-- 2. SELECT Policy
CREATE POLICY "Users can view their account phone numbers" ON public.phone_numbers FOR
SELECT TO authenticated USING (
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
UPDATE TO authenticated USING (
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
-- Note: No INSERT or DELETE policies allowed for customers.