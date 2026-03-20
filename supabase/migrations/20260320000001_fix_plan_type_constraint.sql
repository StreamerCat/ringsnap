-- Fix: expand accounts_plan_type_check constraint to accept new plan key values
-- introduced by the pricing restructure migration (20260302000001).
--
-- The original constraint was created in 20251104215138_add_sales_tracking_fields.sql
-- and only allows the three legacy plan names: 'starter', 'professional', 'premium'.
--
-- The pricing restructure added new plan key names ('night_weekend', 'lite', 'core', 'pro')
-- and updated the plan_key column, but did not update this check constraint.
-- create-trial now normalizes all incoming planType values to the new plan_key names
-- before inserting, causing every new account INSERT to fail.
ALTER TABLE public.accounts
  DROP CONSTRAINT IF EXISTS accounts_plan_type_check;

ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_plan_type_check
  CHECK (plan_type IN (
    -- Legacy plan names (existing accounts retain these values)
    'starter', 'professional', 'premium',
    -- New plan key names (all new accounts created after pricing restructure use these)
    'night_weekend', 'lite', 'core', 'pro'
  ));
