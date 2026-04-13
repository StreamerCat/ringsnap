-- Migration: Fix provisioning_status CHECK constraint
-- Purpose: The original ADD COLUMN IF NOT EXISTS in 20251107130000 was a no-op
-- because the column was already created by 20251105174239, so the CHECK constraint
-- was never applied. This migration explicitly drops any stale constraint and adds
-- a correct one that covers all values used in the codebase.
-- Valid values: idle, pending, provisioning, processing, active, completed, failed, skipped

-- Drop the constraint if it somehow exists (idempotent)
ALTER TABLE public.accounts
  DROP CONSTRAINT IF EXISTS accounts_provisioning_status_check;

-- Add the correct constraint with all used values
ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_provisioning_status_check
  CHECK (provisioning_status IN (
    'idle',
    'pending',
    'provisioning',
    'processing',
    'active',
    'completed',
    'failed',
    'skipped'
  ));
