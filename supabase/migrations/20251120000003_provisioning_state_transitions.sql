-- Migration: Provisioning State Transitions & Observable State Machine
-- Purpose: Track all provisioning state changes for observability
--          Implement clear state machine for signup → Stripe → Vapi flow
-- Date: 2025-11-20

-- Step 1: Create provisioning_stage enum type
CREATE TYPE provisioning_stage AS ENUM (
  'account_created',       -- Supabase account exists, no Stripe yet
  'stripe_linked',         -- Stripe subscription active
  'email_sent',            -- Setup email sent to customer
  'password_set',          -- Customer completed password setup
  'vapi_queued',           -- Vapi provisioning job queued
  'vapi_assistant_ready',  -- Vapi assistant created
  'vapi_phone_pending',    -- Vapi phone number requested
  'vapi_phone_active',     -- Vapi phone number active
  'fully_provisioned',     -- All systems operational
  'failed_stripe',         -- Stripe setup failed
  'failed_vapi',           -- Vapi provisioning failed
  'failed_rollback'        -- Rollback failed (manual cleanup needed)
);

-- Step 2: Add provisioning_stage column to accounts table
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS provisioning_stage provisioning_stage DEFAULT 'account_created';

-- Step 3: Migrate existing accounts to appropriate stage
UPDATE public.accounts
  SET provisioning_stage = CASE
    -- Fully provisioned accounts
    WHEN vapi_assistant_id IS NOT NULL AND phone_number_status = 'active'
      THEN 'fully_provisioned'::provisioning_stage
    -- Phone pending
    WHEN vapi_assistant_id IS NOT NULL AND phone_number_status = 'pending'
      THEN 'vapi_phone_pending'::provisioning_stage
    -- Assistant ready, no phone yet
    WHEN vapi_assistant_id IS NOT NULL
      THEN 'vapi_assistant_ready'::provisioning_stage
    -- Has Stripe but no Vapi
    WHEN stripe_subscription_id IS NOT NULL AND provisioning_status = 'pending'
      THEN 'vapi_queued'::provisioning_stage
    -- Has Stripe subscription
    WHEN stripe_subscription_id IS NOT NULL
      THEN 'stripe_linked'::provisioning_stage
    -- Default fallback
    ELSE 'account_created'::provisioning_stage
  END
  WHERE provisioning_stage = 'account_created';

-- Step 4: Create provisioning_state_transitions table
CREATE TABLE IF NOT EXISTS public.provisioning_state_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Account reference
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,

  -- Correlation tracking
  correlation_id TEXT NOT NULL,

  -- State transition
  from_stage provisioning_stage,  -- NULL for initial state
  to_stage provisioning_stage NOT NULL,

  -- Context
  triggered_by TEXT NOT NULL,     -- 'create-trial', 'provision-resources', 'manual', etc.
  metadata JSONB DEFAULT '{}',    -- Additional context (Stripe IDs, errors, etc.)

  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Step 5: Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_pst_account_id
  ON public.provisioning_state_transitions(account_id);

CREATE INDEX IF NOT EXISTS idx_pst_correlation_id
  ON public.provisioning_state_transitions(correlation_id);

CREATE INDEX IF NOT EXISTS idx_pst_created_at
  ON public.provisioning_state_transitions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pst_to_stage
  ON public.provisioning_state_transitions(to_stage);

CREATE INDEX IF NOT EXISTS idx_pst_account_stage
  ON public.provisioning_state_transitions(account_id, to_stage);

-- Step 6: Create index on accounts.provisioning_stage
CREATE INDEX IF NOT EXISTS idx_accounts_provisioning_stage
  ON public.accounts(provisioning_stage);

-- Step 7: Create view for account provisioning timeline
CREATE OR REPLACE VIEW public.account_provisioning_timeline AS
SELECT
  pst.account_id,
  a.company_name,
  a.signup_channel,
  a.provisioning_stage AS current_stage,
  pst.from_stage,
  pst.to_stage,
  pst.triggered_by,
  pst.metadata,
  pst.created_at AS transition_at,
  pst.correlation_id
FROM public.provisioning_state_transitions pst
JOIN public.accounts a ON a.id = pst.account_id
ORDER BY pst.account_id, pst.created_at;

COMMENT ON VIEW public.account_provisioning_timeline IS 'Complete timeline of provisioning state changes for each account';

-- Step 8: Create view for stuck accounts (useful for monitoring)
CREATE OR REPLACE VIEW public.stuck_provisioning_accounts AS
SELECT
  a.id AS account_id,
  a.company_name,
  a.signup_channel,
  a.provisioning_stage,
  a.created_at AS account_created_at,
  MAX(pst.created_at) AS last_transition_at,
  EXTRACT(EPOCH FROM (now() - MAX(pst.created_at))) / 3600 AS hours_since_last_transition,
  a.provisioning_error
FROM public.accounts a
LEFT JOIN public.provisioning_state_transitions pst ON pst.account_id = a.id
WHERE a.provisioning_stage NOT IN ('fully_provisioned', 'failed_stripe', 'failed_vapi', 'failed_rollback')
  AND a.created_at < now() - INTERVAL '1 hour'  -- Created more than 1 hour ago
GROUP BY a.id, a.company_name, a.signup_channel, a.provisioning_stage, a.created_at, a.provisioning_error
HAVING MAX(pst.created_at) < now() - INTERVAL '1 hour' OR MAX(pst.created_at) IS NULL
ORDER BY hours_since_last_transition DESC NULLS FIRST;

COMMENT ON VIEW public.stuck_provisioning_accounts IS 'Accounts that have been stuck in a provisioning stage for >1 hour';

-- Step 9: Create helper function to log state transitions
CREATE OR REPLACE FUNCTION public.log_state_transition(
  p_account_id UUID,
  p_from_stage provisioning_stage,
  p_to_stage provisioning_stage,
  p_triggered_by TEXT,
  p_correlation_id TEXT,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_transition_id UUID;
BEGIN
  -- Insert transition log
  INSERT INTO public.provisioning_state_transitions (
    account_id,
    correlation_id,
    from_stage,
    to_stage,
    triggered_by,
    metadata
  ) VALUES (
    p_account_id,
    p_correlation_id,
    p_from_stage,
    p_to_stage,
    p_triggered_by,
    p_metadata
  )
  RETURNING id INTO v_transition_id;

  -- Update account's current stage
  UPDATE public.accounts
  SET
    provisioning_stage = p_to_stage,
    updated_at = now()
  WHERE id = p_account_id;

  RETURN v_transition_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.log_state_transition IS 'Logs a provisioning state transition and updates the account''s current stage';

-- Step 10: Create function to get account provisioning history
CREATE OR REPLACE FUNCTION public.get_account_provisioning_history(p_account_id UUID)
RETURNS TABLE (
  transition_id UUID,
  from_stage TEXT,
  to_stage TEXT,
  triggered_by TEXT,
  metadata JSONB,
  transition_at TIMESTAMPTZ,
  correlation_id TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pst.id,
    pst.from_stage::TEXT,
    pst.to_stage::TEXT,
    pst.triggered_by,
    pst.metadata,
    pst.created_at,
    pst.correlation_id
  FROM public.provisioning_state_transitions pst
  WHERE pst.account_id = p_account_id
  ORDER BY pst.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_account_provisioning_history IS 'Returns complete provisioning history for an account';

-- Step 11: Add table and column comments
COMMENT ON TABLE public.provisioning_state_transitions IS 'Audit log of all provisioning state changes, enabling full observability of the signup flow';
COMMENT ON COLUMN public.provisioning_state_transitions.account_id IS 'Account that transitioned';
COMMENT ON COLUMN public.provisioning_state_transitions.correlation_id IS 'Correlation ID from the operation that triggered this transition';
COMMENT ON COLUMN public.provisioning_state_transitions.from_stage IS 'Previous stage (NULL for initial state)';
COMMENT ON COLUMN public.provisioning_state_transitions.to_stage IS 'New stage after transition';
COMMENT ON COLUMN public.provisioning_state_transitions.triggered_by IS 'Function/process that triggered this transition';
COMMENT ON COLUMN public.provisioning_state_transitions.metadata IS 'Additional context (Stripe IDs, Vapi IDs, errors, etc.)';

COMMENT ON COLUMN public.accounts.provisioning_stage IS 'Current stage in the signup/provisioning flow';

-- Step 12: Grant appropriate permissions
GRANT SELECT, INSERT ON public.provisioning_state_transitions TO service_role;
GRANT USAGE ON SEQUENCE public.provisioning_state_transitions_id_seq TO service_role;

GRANT SELECT ON public.account_provisioning_timeline TO authenticated;
GRANT SELECT ON public.stuck_provisioning_accounts TO authenticated;
