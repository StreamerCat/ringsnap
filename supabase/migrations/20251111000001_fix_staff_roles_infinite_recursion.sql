-- Fix infinite recursion in staff_roles RLS policies
-- The previous policies were checking staff_roles within the staff_roles policy,
-- causing infinite recursion

-- Drop the recursive policies
DROP POLICY IF EXISTS "Staff can view their own role" ON public.staff_roles;
DROP POLICY IF EXISTS "Admins can manage staff roles" ON public.staff_roles;

-- Create simpler, non-recursive policies
-- Staff can only view their own role (no recursive check for admin)
CREATE POLICY "Staff can view their own role"
ON public.staff_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Only allow INSERT/UPDATE/DELETE through service role for now
-- This prevents regular users from modifying staff_roles
-- Admins should use service role or SQL for staff role management
CREATE POLICY "Only service role can modify staff roles"
ON public.staff_roles FOR ALL
TO authenticated
USING (false)  -- No regular user can modify
WITH CHECK (false);

-- Note: Service role bypasses RLS, so admin operations can still be performed
-- via Supabase functions or direct SQL with service role key
