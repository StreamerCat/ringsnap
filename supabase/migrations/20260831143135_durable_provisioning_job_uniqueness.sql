-- Ensure retries and concurrent signup requests cannot create multiple active
-- provisioning jobs for the same account and provisioning operation.

UPDATE public.provisioning_jobs
SET job_type = 'provision_phone'
WHERE job_type IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS provisioning_jobs_one_active_job_per_type
ON public.provisioning_jobs (account_id, job_type)
WHERE status IN ('queued', 'processing', 'failed');
