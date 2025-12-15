-- Add Stripe integration columns to accounts table
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'starter';

-- Add VAPI integration columns
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS vapi_assistant_id TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS vapi_phone_number TEXT;

-- Add business configuration columns
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS sales_rep_name TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS service_area TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT '{"monday": "9-5", "tuesday": "9-5", "wednesday": "9-5", "thursday": "9-5", "friday": "9-5"}'::jsonb;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS emergency_policy TEXT DEFAULT 'Transfer all emergency calls immediately';

-- Add provisioning status tracking
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS provisioning_status TEXT DEFAULT 'pending';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS provisioning_error TEXT;

-- Add past_due to subscription_status enum
DO $$ BEGIN
  ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'past_due';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create usage tracking table
CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  call_id TEXT,
  call_duration_seconds INTEGER,
  call_cost_cents INTEGER,
  call_type TEXT,
  customer_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB
);

-- Enable RLS on usage_logs
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their account usage
DROP POLICY IF EXISTS "Users can view their account usage" ON usage_logs;
CREATE POLICY "Users can view their account usage"
ON usage_logs FOR SELECT
USING (account_id = get_user_account_id(auth.uid()));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_usage_logs_account_id ON usage_logs(account_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_accounts_stripe_customer ON accounts(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_accounts_vapi_assistant ON accounts(vapi_assistant_id);