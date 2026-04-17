-- Add missing indexes identified in pre-launch audit.
-- account_members.account_id: used in every RLS policy evaluation — a full scan
-- here penalizes every authenticated query across the app.
-- call_logs.account_id: high-volume table queried per-account on every dashboard load.

CREATE INDEX IF NOT EXISTS idx_account_members_account_id
  ON public.account_members(account_id);

CREATE INDEX IF NOT EXISTS idx_call_logs_account_id
  ON public.call_logs(account_id, created_at DESC);
