-- Enhance call_logs for Vapi Webhook Idempotency

-- Add unique constraint to allow UPSERT operations by vapi_call_id
ALTER TABLE public.call_logs ADD CONSTRAINT call_logs_vapi_call_id_key UNIQUE (vapi_call_id);

-- Add index on started_at for dashboard sorting performance
CREATE INDEX IF NOT EXISTS idx_call_logs_started_at ON public.call_logs(started_at DESC);

-- Ensure RLS allows Insert/Update for Service Role (default is true, but good to be explicit if needed, though usually handled by BYPASS RLS on role)
-- We will stick to the existing RLS for SELECT which uses account_members.

-- Optional: Add index on status for filtering
CREATE INDEX IF NOT EXISTS idx_call_logs_status ON public.call_logs(status);
