
ALTER TABLE public.phone_numbers
  ADD COLUMN IF NOT EXISTS trial_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS phone_retention_expires_at timestamptz;
