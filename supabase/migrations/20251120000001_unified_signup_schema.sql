-- Migration: Unified Signup Schema
-- Purpose: Replace free-text 'source' with structured 'signup_channel' enum
--          Replace free-text 'sales_rep_name' with 'sales_rep_id' FK
--          Add 'provisioning_stage' for observable state machine
-- Date: 2025-11-20

-- Step 1: Create signup_channel enum type
CREATE TYPE signup_channel_type AS ENUM ('self_service', 'sales_guided', 'enterprise');

-- Step 2: Add new columns to accounts table
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS signup_channel signup_channel_type,
  ADD COLUMN IF NOT EXISTS sales_rep_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Step 3: Migrate existing 'source' data to 'signup_channel'
UPDATE public.accounts
  SET signup_channel = CASE
    WHEN source = 'website' THEN 'self_service'::signup_channel_type
    WHEN source = 'sales' THEN 'sales_guided'::signup_channel_type
    WHEN source = 'referral' THEN 'self_service'::signup_channel_type  -- Referrals treated as self-service
    WHEN source = 'partner' THEN 'enterprise'::signup_channel_type     -- Partners treated as enterprise
    ELSE 'self_service'::signup_channel_type                            -- Default fallback
  END
  WHERE signup_channel IS NULL;

-- Step 4: Make signup_channel required (after data migration)
ALTER TABLE public.accounts
  ALTER COLUMN signup_channel SET NOT NULL,
  ALTER COLUMN signup_channel SET DEFAULT 'self_service'::signup_channel_type;

-- Step 5: Attempt to link existing sales_rep_name to sales_rep_id
-- This matches free-text names to auth.users where email contains the name
-- Note: This is best-effort and may not match all records
UPDATE public.accounts a
SET sales_rep_id = u.id
FROM auth.users u
WHERE a.sales_rep_name IS NOT NULL
  AND a.sales_rep_id IS NULL
  AND (
    u.email ILIKE '%' || LOWER(REPLACE(a.sales_rep_name, ' ', '')) || '%'
    OR u.raw_user_meta_data->>'name' ILIKE '%' || a.sales_rep_name || '%'
  );

-- Step 6: Create index for sales rep lookups
CREATE INDEX IF NOT EXISTS idx_accounts_sales_rep_id ON public.accounts(sales_rep_id)
  WHERE sales_rep_id IS NOT NULL;

-- Step 7: Create index for signup channel analytics
CREATE INDEX IF NOT EXISTS idx_accounts_signup_channel ON public.accounts(signup_channel);

-- Step 8: Add comments for documentation
COMMENT ON COLUMN public.accounts.signup_channel IS 'Channel through which the account was created: self_service (website), sales_guided (sales team), or enterprise';
COMMENT ON COLUMN public.accounts.sales_rep_id IS 'Foreign key to auth.users for the sales representative who created this account (if sales_guided)';

-- Step 9: Drop old 'source' column (AFTER verifying migration in production)
-- COMMENTED OUT for safety - uncomment after verification:
-- ALTER TABLE public.accounts DROP COLUMN IF EXISTS source;

-- Step 10: Drop old 'sales_rep_name' column (AFTER verifying migration in production)
-- COMMENTED OUT for safety - uncomment after verification:
-- ALTER TABLE public.accounts DROP COLUMN IF EXISTS sales_rep_name;

-- Step 11: Create view for sales rep performance analytics
CREATE OR REPLACE VIEW public.sales_rep_performance AS
SELECT
  u.id AS sales_rep_id,
  u.email AS sales_rep_email,
  u.raw_user_meta_data->>'name' AS sales_rep_name,
  COUNT(DISTINCT a.id) AS total_signups,
  COUNT(DISTINCT a.id) FILTER (WHERE a.subscription_status = 'active') AS active_accounts,
  COUNT(DISTINCT a.id) FILTER (WHERE a.subscription_status = 'trial') AS trial_accounts,
  MIN(a.created_at) AS first_signup,
  MAX(a.created_at) AS latest_signup
FROM auth.users u
LEFT JOIN public.accounts a ON a.sales_rep_id = u.id
WHERE a.signup_channel = 'sales_guided'
GROUP BY u.id, u.email, u.raw_user_meta_data
ORDER BY total_signups DESC;

COMMENT ON VIEW public.sales_rep_performance IS 'Analytics view showing performance metrics for each sales representative';
