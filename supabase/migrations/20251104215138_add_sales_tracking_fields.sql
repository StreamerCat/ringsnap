-- Add sales rep tracking to accounts table
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS sales_rep_name TEXT,
ADD COLUMN IF NOT EXISTS service_area TEXT,
ADD COLUMN IF NOT EXISTS business_hours JSONB,
ADD COLUMN IF NOT EXISTS emergency_policy TEXT,
ADD COLUMN IF NOT EXISTS plan_type TEXT CHECK (plan_type IN ('starter', 'professional', 'premium'));

-- Add sales rep tracking to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS sales_rep_name TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.accounts.plan_type IS 'Plan type selected during sales signup: starter (≤80 calls), professional (≤160 calls), premium (>160 calls)';
COMMENT ON COLUMN public.accounts.sales_rep_name IS 'Name of sales representative who created this account';
COMMENT ON COLUMN public.accounts.service_area IS 'Geographic service area for the business';
COMMENT ON COLUMN public.accounts.business_hours IS 'Business hours in JSONB format (e.g., {"monday": {"open": "08:00", "close": "17:00"}})';
COMMENT ON COLUMN public.accounts.emergency_policy IS 'Emergency call handling policy';
