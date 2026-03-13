-- Migration: ops_execution_log table for CrewAI cost tracking
-- Part of RingSnap Phase 1 GTM Ops system
-- Additive only -- no existing tables modified
-- Rollback: supabase/migrations/rollback/rollback_ops_tables.sql

CREATE TABLE IF NOT EXISTS ops_execution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  -- entity this execution is about (pending_signup_id, account_id, etc.)
  entity_id TEXT,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  -- which model was used for this crew execution
  model_used TEXT,
  estimated_input_tokens INT,
  estimated_output_tokens INT,
  -- integer cents to avoid float precision issues
  estimated_cost_cents INT,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed', 'skipped')),
  -- skipped means event_gate dropped the event without processing
  skip_reason TEXT,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_ops_exec_log_module
  ON ops_execution_log(module_name, triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_exec_log_date
  ON ops_execution_log(triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_exec_log_entity
  ON ops_execution_log(entity_id, triggered_at DESC)
  WHERE entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ops_exec_log_status
  ON ops_execution_log(status, triggered_at DESC);

-- RLS: write via service role only, read by staff
ALTER TABLE ops_execution_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_ops_exec_log"
  ON ops_execution_log
  USING (true)
  WITH CHECK (true);

CREATE POLICY "staff_view_ops_exec_log"
  ON ops_execution_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'owner', 'billing')
    )
  );

COMMENT ON TABLE ops_execution_log IS
  'Audit trail of every CrewAI crew execution. Used for cost tracking, rate limiting, '
  'and the daily founder digest. Do not write to this table from application code -- '
  'only the ops flow service writes here.';

COMMENT ON COLUMN ops_execution_log.estimated_cost_cents IS
  'Estimated LLM cost in integer cents. Approximated from token counts and model pricing.';

COMMENT ON COLUMN ops_execution_log.skip_reason IS
  'Populated when status=skipped. Explains why event_gate dropped the event '
  '(e.g. not_in_allowlist, cooldown_active, budget_exceeded, rate_limit_hit).';
