-- Add onboarding_status column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS onboarding_status TEXT;

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

-- Backfill existing records with correct starting status
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'onboarding_status'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'account_id'
  ) THEN
    UPDATE public.profiles
    SET onboarding_status = 'active'
    WHERE account_id IS NOT NULL
      AND (onboarding_status IS NULL OR onboarding_status = 'not_started');

    UPDATE public.profiles
    SET onboarding_status = 'not_started'
    WHERE onboarding_status IS NULL;
  END IF;
END
$$;

-- Ensure future rows default to not_started
ALTER TABLE public.profiles
ALTER COLUMN onboarding_status SET DEFAULT 'not_started';
