-- Migration: Orphaned Stripe Resources Table
-- Purpose: Track Stripe customers/subscriptions that failed to rollback
--          Enables manual cleanup and prevents silent billing issues
-- Date: 2025-11-20

-- Step 1: Create orphaned_stripe_resources table
CREATE TABLE IF NOT EXISTS public.orphaned_stripe_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Stripe identifiers
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT,

  -- Correlation tracking
  correlation_id TEXT NOT NULL,

  -- Lifecycle status
  status TEXT NOT NULL DEFAULT 'pending_manual_cleanup' CHECK (status IN (
    'pending_manual_cleanup',  -- Needs manual review and cleanup
    'in_progress',             -- Being processed by admin
    'resolved',                -- Successfully cleaned up
    'cannot_resolve'           -- Cannot be cleaned up (requires escalation)
  )),

  -- Error context
  error TEXT,                  -- Error message from failed rollback
  failure_reason TEXT,         -- Why the resource became orphaned

  -- Resolution tracking
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_notes TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}', -- Additional context (email, company_name, etc.)

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Step 2: Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_orphaned_stripe_status
  ON public.orphaned_stripe_resources(status)
  WHERE status IN ('pending_manual_cleanup', 'in_progress');

CREATE INDEX IF NOT EXISTS idx_orphaned_stripe_correlation
  ON public.orphaned_stripe_resources(correlation_id);

CREATE INDEX IF NOT EXISTS idx_orphaned_stripe_created_at
  ON public.orphaned_stripe_resources(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orphaned_stripe_customer_id
  ON public.orphaned_stripe_resources(stripe_customer_id);

-- Step 3: Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_orphaned_stripe_resources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_orphaned_stripe_resources_updated_at
  BEFORE UPDATE ON public.orphaned_stripe_resources
  FOR EACH ROW
  EXECUTE FUNCTION public.update_orphaned_stripe_resources_updated_at();

-- Step 4: Create view for admin dashboard
CREATE OR REPLACE VIEW public.orphaned_resources_summary AS
SELECT
  status,
  COUNT(*) AS count,
  MIN(created_at) AS oldest_created_at,
  MAX(created_at) AS newest_created_at,
  ARRAY_AGG(DISTINCT correlation_id) FILTER (WHERE status = 'pending_manual_cleanup') AS pending_correlation_ids
FROM public.orphaned_stripe_resources
GROUP BY status
ORDER BY
  CASE status
    WHEN 'pending_manual_cleanup' THEN 1
    WHEN 'in_progress' THEN 2
    WHEN 'cannot_resolve' THEN 3
    WHEN 'resolved' THEN 4
  END;

-- Step 5: Create helper function to log orphaned resource
CREATE OR REPLACE FUNCTION public.log_orphaned_stripe_resource(
  p_stripe_customer_id TEXT,
  p_stripe_subscription_id TEXT,
  p_correlation_id TEXT,
  p_error TEXT,
  p_failure_reason TEXT,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_resource_id UUID;
BEGIN
  INSERT INTO public.orphaned_stripe_resources (
    stripe_customer_id,
    stripe_subscription_id,
    correlation_id,
    error,
    failure_reason,
    metadata,
    status
  ) VALUES (
    p_stripe_customer_id,
    p_stripe_subscription_id,
    p_correlation_id,
    p_error,
    p_failure_reason,
    p_metadata,
    'pending_manual_cleanup'
  )
  RETURNING id INTO v_resource_id;

  RETURN v_resource_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Add table comments
COMMENT ON TABLE public.orphaned_stripe_resources IS 'Tracks Stripe resources that failed to be cleaned up during signup rollback, requiring manual intervention';
COMMENT ON COLUMN public.orphaned_stripe_resources.stripe_customer_id IS 'Stripe customer ID that needs cleanup';
COMMENT ON COLUMN public.orphaned_stripe_resources.correlation_id IS 'Correlation ID from the failed signup attempt';
COMMENT ON COLUMN public.orphaned_stripe_resources.status IS 'Current status of the cleanup process';
COMMENT ON COLUMN public.orphaned_stripe_resources.failure_reason IS 'High-level reason why resource became orphaned (e.g., subscription_creation_failed, db_transaction_failed)';
COMMENT ON FUNCTION public.log_orphaned_stripe_resource IS 'Helper function to insert orphaned resource records from edge functions';

-- Step 7: Enable RLS and configure permissions
ALTER TABLE public.orphaned_stripe_resources ENABLE ROW LEVEL SECURITY;

-- Revoke default permissions
REVOKE ALL ON public.orphaned_stripe_resources FROM authenticated;
REVOKE ALL ON FUNCTION public.log_orphaned_stripe_resource FROM PUBLIC;

-- Grant service_role access to INSERT orphaned resources
GRANT SELECT, INSERT ON public.orphaned_stripe_resources TO service_role;
GRANT EXECUTE ON FUNCTION public.log_orphaned_stripe_resource TO service_role;

-- Create staff-only policy for viewing and managing orphaned resources
DROP POLICY IF EXISTS "staff_can_manage_orphaned_resources" ON public.orphaned_stripe_resources;
CREATE POLICY "staff_can_manage_orphaned_resources"
  ON public.orphaned_stripe_resources
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_roles
      WHERE user_id = auth.uid()
      AND role::text IN ('platform_admin', 'platform_owner', 'admin', 'support', 'billing')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff_roles
      WHERE user_id = auth.uid()
      AND role::text IN ('platform_admin', 'platform_owner', 'admin', 'support', 'billing')
    )
  );
