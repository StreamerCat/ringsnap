-- Migration: pending_signups table for phone sales hybrid checkout flow
-- Part of RingSnap Phase 1 GTM Ops system
-- Additive only -- no existing tables modified
-- Rollback: supabase/migrations/rollback/rollback_ops_tables.sql

CREATE TABLE IF NOT EXISTS pending_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- nullable until checkout is completed and account is created
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  business_name TEXT,
  trade TEXT,
  selected_plan TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'qualified'
    CHECK (status IN (
      'qualified',
      'link_sent',
      'checkout_opened',
      'checkout_completed',
      'account_created',
      'provisioned',
      'activated',
      'expired',
      'failed'
    )),
  stripe_checkout_session_id TEXT,
  checkout_link TEXT,
  link_sent_at TIMESTAMPTZ,
  checkout_completed_at TIMESTAMPTZ,
  rescue_attempts INT NOT NULL DEFAULT 0,
  vapi_call_id TEXT,
  lead_score INT CHECK (lead_score >= 0 AND lead_score <= 100),
  is_high_intent BOOLEAN NOT NULL DEFAULT FALSE,
  is_high_fit BOOLEAN NOT NULL DEFAULT FALSE,
  sales_rep_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  failure_reason TEXT,
  failure_phase TEXT,
  -- non-sensitive structured lead data from Vapi tool call
  lead_data JSONB NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '48 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dedupe index: only one active pending signup per email
-- (allows multiple if previous is in terminal state)
CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_signups_dedup
  ON pending_signups(contact_email)
  WHERE status NOT IN ('activated', 'expired', 'failed');

CREATE INDEX IF NOT EXISTS idx_pending_signups_account
  ON pending_signups(account_id);

CREATE INDEX IF NOT EXISTS idx_pending_signups_status
  ON pending_signups(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pending_signups_vapi_call
  ON pending_signups(vapi_call_id)
  WHERE vapi_call_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pending_signups_expires
  ON pending_signups(expires_at)
  WHERE status NOT IN ('activated', 'expired', 'failed');

CREATE INDEX IF NOT EXISTS idx_pending_signups_checkout_session
  ON pending_signups(stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

-- RLS
ALTER TABLE pending_signups ENABLE ROW LEVEL SECURITY;

-- Service role has full access (Python ops service uses service role key)
CREATE POLICY "service_role_all_pending_signups"
  ON pending_signups
  USING (true)
  WITH CHECK (true);

-- Staff can view all pending signups
CREATE POLICY "staff_view_pending_signups"
  ON pending_signups
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'owner', 'sales', 'support')
    )
  );

-- Auto-update updated_at
CREATE TRIGGER update_pending_signups_updated_at
  BEFORE UPDATE ON pending_signups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE pending_signups IS
  'Tracks phone sales outbound leads through the hybrid checkout funnel. '
  'Created when Vapi qualifies a lead, completed when Stripe checkout fires webhook.';

COMMENT ON COLUMN pending_signups.status IS
  'Funnel stage: qualified→link_sent→checkout_opened→checkout_completed→account_created→provisioned→activated. '
  'Terminal states: expired, failed.';

COMMENT ON COLUMN pending_signups.lead_data IS
  'Non-sensitive structured data collected by Vapi during the call (business type, needs, etc.)';

COMMENT ON COLUMN pending_signups.lead_score IS
  'Composite score 0-100 from sales_triage crew. Used to decide human callback priority.';
