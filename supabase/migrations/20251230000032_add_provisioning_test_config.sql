-- Migration: Add test_config to provisioning_jobs
-- Purpose: Support deterministic E2E testing with simulated failures and mocks
-- Date: 2025-12-30
ALTER TABLE public.provisioning_jobs
ADD COLUMN IF NOT EXISTS test_config JSONB DEFAULT NULL;
COMMENT ON COLUMN public.provisioning_jobs.test_config IS 'Configuration for E2E testing: { mock_provider: boolean, simulate_failure_attempts: number }';