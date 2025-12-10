
-- Migration to add assistant_config column to assistants table
-- Created by RingSnap Agent

ALTER TABLE public.assistants
ADD COLUMN IF NOT EXISTS assistant_config JSONB DEFAULT NULL;

COMMENT ON COLUMN public.assistants.assistant_config IS 'Stores the structured configuration for the AI assistant including tone, services, and rules.';
