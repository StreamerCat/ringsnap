-- Migration: Add source tracking to accounts and profiles
-- This enables differentiation between self-serve and sales-guided trials

-- Add source column to accounts table
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS source TEXT
    CHECK (source IN ('website', 'sales', 'referral', 'partner'))
    DEFAULT 'website';

-- Add source column to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS source TEXT;

-- Backfill existing accounts based on sales_rep_name
UPDATE public.accounts
SET source = CASE
  WHEN sales_rep_name IS NOT NULL AND sales_rep_name != '' THEN 'sales'
  ELSE 'website'
END
WHERE source IS NULL;

-- Backfill profiles from their associated accounts
UPDATE public.profiles p
SET source = a.source
FROM public.accounts a
WHERE p.account_id = a.id
  AND p.source IS NULL;

-- Create indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_accounts_source_created
  ON public.accounts(source, created_at);

CREATE INDEX IF NOT EXISTS idx_accounts_source_plan_status
  ON public.accounts(source, plan_type, subscription_status)
  WHERE subscription_status IN ('trial', 'active');

-- Add helpful comments
COMMENT ON COLUMN public.accounts.source IS 'Trial signup source: website (self-serve), sales (rep-guided), referral (referral program), partner (partner channel)';
COMMENT ON COLUMN public.profiles.source IS 'User signup source, mirrors account.source for analytics';

-- Grant permissions (if needed)
-- RLS policies will inherit from existing account/profile policies
