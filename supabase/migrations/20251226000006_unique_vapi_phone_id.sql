-- Migration: Enforce global uniqueness on vapi_phone_id
-- Purpose: Ensure a Vapi Phone ID exists only once to prevent maybeSingle() errors.
-- Duplicate checking logic should ideally run before this, but we enforce it now.

CREATE UNIQUE INDEX IF NOT EXISTS idx_phone_numbers_unique_vapi_id
ON public.phone_numbers(vapi_phone_id)
WHERE vapi_phone_id IS NOT NULL;

-- Also add uniqueness on provider_phone_number_id if not already present (good practice)
CREATE UNIQUE INDEX IF NOT EXISTS idx_phone_numbers_unique_provider_id
ON public.phone_numbers(provider_phone_number_id)
WHERE provider_phone_number_id IS NOT NULL;
