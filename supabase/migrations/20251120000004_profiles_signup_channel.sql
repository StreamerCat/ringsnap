-- Migration: Add signup_channel to profiles table
-- Purpose: Track signup channel at the user level (not just account level)
--          Useful for analytics and user segmentation
-- Date: 2025-11-20

-- Step 1: Add signup_channel column to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signup_channel signup_channel_type;

-- Step 2: Migrate existing data from linked accounts
UPDATE public.profiles p
SET signup_channel = a.signup_channel
FROM public.accounts a
WHERE p.account_id = a.id
  AND p.signup_channel IS NULL;

-- Step 3: Set default for any remaining NULL values
UPDATE public.profiles
SET signup_channel = 'self_service'::signup_channel_type
WHERE signup_channel IS NULL;

-- Step 4: Make signup_channel required going forward
ALTER TABLE public.profiles
  ALTER COLUMN signup_channel SET NOT NULL,
  ALTER COLUMN signup_channel SET DEFAULT 'self_service'::signup_channel_type;

-- Step 5: Create index for analytics queries
CREATE INDEX IF NOT EXISTS idx_profiles_signup_channel
  ON public.profiles(signup_channel);

-- Step 6: Add column comment
COMMENT ON COLUMN public.profiles.signup_channel IS 'Channel through which this user signed up (inherited from account)';

-- Step 7: Create view for user signup analytics
CREATE OR REPLACE VIEW public.user_signup_analytics AS
SELECT
  p.signup_channel,
  COUNT(DISTINCT p.id) AS total_users,
  COUNT(DISTINCT p.id) FILTER (WHERE p.is_primary = true) AS primary_users,
  COUNT(DISTINCT p.account_id) AS total_accounts,
  MIN(p.created_at) AS first_signup,
  MAX(p.created_at) AS latest_signup,
  COUNT(DISTINCT p.id) FILTER (WHERE p.created_at >= now() - INTERVAL '7 days') AS signups_last_7_days,
  COUNT(DISTINCT p.id) FILTER (WHERE p.created_at >= now() - INTERVAL '30 days') AS signups_last_30_days
FROM public.profiles p
GROUP BY p.signup_channel
ORDER BY total_users DESC;

COMMENT ON VIEW public.user_signup_analytics IS 'Analytics summary of user signups by channel';

-- Step 8: Create view for detailed user signup breakdown
CREATE OR REPLACE VIEW public.user_signup_details AS
SELECT
  p.id AS profile_id,
  p.name,
  p.phone,
  p.signup_channel,
  p.is_primary,
  p.created_at AS signup_date,
  a.id AS account_id,
  a.company_name,
  a.sales_rep_id,
  u.email AS sales_rep_email,
  a.subscription_status,
  a.provisioning_stage
FROM public.profiles p
JOIN public.accounts a ON a.id = p.account_id
LEFT JOIN auth.users u ON u.id = a.sales_rep_id
ORDER BY p.created_at DESC;

COMMENT ON VIEW public.user_signup_details IS 'Detailed view of user signups with account and sales rep information';

-- Step 9: Grant appropriate permissions
GRANT SELECT ON public.user_signup_analytics TO authenticated;
GRANT SELECT ON public.user_signup_details TO authenticated;
