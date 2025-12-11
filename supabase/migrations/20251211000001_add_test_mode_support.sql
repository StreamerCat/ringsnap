-- Migration: Add test mode support columns
-- Created: 2024-12-11
-- Description: Adds is_test_account to accounts and test_mode to provisioning_jobs

-- Add is_test_account to accounts table
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_test_account BOOLEAN DEFAULT false;

-- Add test_mode to provisioning_jobs table
ALTER TABLE provisioning_jobs ADD COLUMN IF NOT EXISTS test_mode BOOLEAN DEFAULT false;

-- Add index for filtering test accounts (useful for admin views)
CREATE INDEX IF NOT EXISTS idx_accounts_is_test ON accounts(is_test_account) WHERE is_test_account = true;

-- Comment for documentation
COMMENT ON COLUMN accounts.is_test_account IS 'True for accounts created via test mode (zip 99999). Uses Twilio test credentials.';
COMMENT ON COLUMN provisioning_jobs.test_mode IS 'True for jobs that should use test mode provisioning (Twilio test creds).';
