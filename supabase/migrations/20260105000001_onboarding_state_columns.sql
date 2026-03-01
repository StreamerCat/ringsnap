-- ============================================================================
-- Migration: Add Onboarding State Columns
-- Date: 2026-01-05
-- Purpose: Add durable onboarding state columns to accounts table
-- ============================================================================
-- Add durable onboarding state columns
ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS test_call_verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
-- Index for route guard queries (fast lookup of incomplete onboarding)
CREATE INDEX IF NOT EXISTS idx_accounts_onboarding_completed ON accounts(onboarding_completed_at)
WHERE onboarding_completed_at IS NOT NULL;
-- Create onboarding_events table for monitoring
CREATE TABLE IF NOT EXISTS onboarding_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    step TEXT NOT NULL,
    -- 'provisioning', 'test_call', 'forwarding', 'complete'
    status TEXT NOT NULL,
    -- 'started', 'completed', 'failed', 'skipped'
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Indexes for onboarding_events
CREATE INDEX IF NOT EXISTS idx_onboarding_events_account ON onboarding_events(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_onboarding_events_step ON onboarding_events(step, status);
-- Enable RLS
ALTER TABLE onboarding_events ENABLE ROW LEVEL SECURITY;
-- RLS policy: users can view their own account's events
DROP POLICY IF EXISTS "Users can view own onboarding events" ON onboarding_events;
CREATE POLICY "Users can view own onboarding events" ON onboarding_events FOR
SELECT USING (
        account_id IN (
            SELECT account_id
            FROM profiles
            WHERE id = auth.uid()
        )
    );
-- RLS policy: Staff/Admins can view all events
CREATE POLICY "Staff can view all onboarding events" ON onboarding_events FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM staff_roles
            WHERE user_id = auth.uid()
                AND role IN (
                    'platform_owner',
                    'platform_admin',
                    'support'
                )
        )
    );
-- Backfill: set onboarding_completed_at for existing activated accounts
-- This prevents lockout of internal/test accounts that already completed onboarding
UPDATE accounts
SET onboarding_completed_at = COALESCE(phone_provisioned_at, created_at)
WHERE phone_provisioned_at IS NOT NULL
    AND onboarding_completed_at IS NULL;
-- Also backfill accounts with completed provisioning as a safety net
UPDATE accounts
SET onboarding_completed_at = COALESCE(phone_provisioned_at, updated_at, created_at)
WHERE provisioning_status = 'completed'
    AND onboarding_completed_at IS NULL;
COMMENT ON COLUMN accounts.test_call_verified_at IS 'Timestamp when a valid test call (>=10s inbound) was first detected';
COMMENT ON COLUMN accounts.onboarding_completed_at IS 'Timestamp when onboarding was completed or skipped. Used by route guards.';
COMMENT ON TABLE onboarding_events IS 'Audit log for onboarding step transitions';