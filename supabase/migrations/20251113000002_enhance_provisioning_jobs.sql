-- Migration: Enhance provisioning_jobs table for better async tracking
-- Adds job types, resource tracking, and retry management

-- Add new columns to provisioning_jobs
ALTER TABLE public.provisioning_jobs
  ADD COLUMN IF NOT EXISTS job_type TEXT
    CHECK (job_type IN ('provision_phone', 'create_assistant', 'attach_assistant')),
  ADD COLUMN IF NOT EXISTS vapi_phone_id TEXT,
  ADD COLUMN IF NOT EXISTS vapi_assistant_id TEXT,
  ADD COLUMN IF NOT EXISTS retry_after TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Set default job_type for existing records (if any)
UPDATE public.provisioning_jobs
SET job_type = 'provision_phone'
WHERE job_type IS NULL;

-- Create index for efficient job processing queries
CREATE INDEX IF NOT EXISTS idx_provisioning_jobs_status_retry
  ON public.provisioning_jobs(status, retry_after, created_at)
  WHERE status IN ('queued', 'failed');

-- Create index for completed jobs cleanup
CREATE INDEX IF NOT EXISTS idx_provisioning_jobs_completed
  ON public.provisioning_jobs(completed_at)
  WHERE status = 'completed';

-- Add comments for documentation
COMMENT ON COLUMN public.provisioning_jobs.job_type IS 'Type of provisioning operation: provision_phone (create Vapi phone number), create_assistant (create Vapi assistant), attach_assistant (link assistant to phone)';
COMMENT ON COLUMN public.provisioning_jobs.vapi_phone_id IS 'Vapi phone number ID created by this job';
COMMENT ON COLUMN public.provisioning_jobs.vapi_assistant_id IS 'Vapi assistant ID created by this job';
COMMENT ON COLUMN public.provisioning_jobs.retry_after IS 'Timestamp when failed job should be retried (exponential backoff)';
COMMENT ON COLUMN public.provisioning_jobs.completed_at IS 'Timestamp when job successfully completed';

-- Function to cleanup old completed jobs (run via cron)
CREATE OR REPLACE FUNCTION public.cleanup_completed_provisioning_jobs()
RETURNS void AS $$
BEGIN
  DELETE FROM public.provisioning_jobs
  WHERE status = 'completed'
    AND completed_at < now() - interval '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.cleanup_completed_provisioning_jobs IS 'Removes completed provisioning jobs older than 7 days. Run weekly via cron.';
