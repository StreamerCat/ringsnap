-- Add onboarding_status column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS onboarding_status TEXT DEFAULT 'not_started';

-- Add check constraint for valid status values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_onboarding_status_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_onboarding_status_check
    CHECK (onboarding_status IN (
      'not_started',
      'collecting',
      'ready_to_provision',
      'provisioning',
      'active',
      'provision_failed'
    ));
  END IF;
END
$$;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_status ON public.profiles(onboarding_status);

-- Update existing records to 'active' if they have an account
UPDATE public.profiles
SET onboarding_status = 'active'
WHERE account_id IS NOT NULL
  AND onboarding_status IS NULL;
