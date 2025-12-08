-- Migration: Fix Account Schema & Telephony Agnosticism
-- Purpose: 
-- 1. Ensure `account_members` is the source of truth for membership (replace user_roles usage).
-- 2. Make `phone_numbers` provider-agnostic.
-- 3. Create generic `call_logs` table.
-- 4. Backfill missing memberships.

-- 1. Telephony: Update phone_numbers
ALTER TABLE public.phone_numbers
  ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'vapi',
  ADD COLUMN IF NOT EXISTS provider_id TEXT;

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_phone_numbers_provider ON public.phone_numbers(provider, provider_id);

-- Backfill existing phones (assuming Vapi)
UPDATE public.phone_numbers
SET 
  provider = COALESCE(raw->>'telephony_provider', 'vapi'),
  provider_id = raw->>'provider_id'
WHERE provider_id IS NULL;

-- 2. Telephony: Create generic call_logs
CREATE TABLE IF NOT EXISTS public.call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  phone_number_id UUID REFERENCES public.phone_numbers(id) ON DELETE SET NULL,
  
  -- Provider Info
  provider TEXT NOT NULL DEFAULT 'vapi',
  provider_call_id TEXT, -- Twilio Call SID or Vapi Call ID
  vapi_call_id TEXT,     -- Specific Vapi ID if available
  
  -- Call Details
  direction TEXT CHECK (direction IN ('inbound', 'outbound')),
  from_number TEXT,
  to_number TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  status TEXT, -- 'completed', 'failed', 'busy', 'no-answer'
  
  -- Data
  recording_url TEXT,
  transcript TEXT,
  summary TEXT,
  cost NUMERIC(10, 4),
  
  -- Tech
  raw_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for call_logs
CREATE INDEX IF NOT EXISTS idx_call_logs_account_id ON public.call_logs(account_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_phone_id ON public.call_logs(phone_number_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_provider_id ON public.call_logs(provider, provider_call_id);

-- Enable RLS for call_logs
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can view call logs"
  ON public.call_logs FOR SELECT
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid()
    )
  );

-- 3. Membership: Ensure account_members exists (it should, but strictly checking)
CREATE TABLE IF NOT EXISTS public.account_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  role public.account_role NOT NULL DEFAULT 'user', -- relying on enum from previous migration
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, account_id)
);

-- Enable RLS for account_members (if not already)
ALTER TABLE public.account_members ENABLE ROW LEVEL SECURITY;

-- Re-apply policies to be safe (idempotent due to OR REPLACE logic usually, but here we use IF NOT EXISTS logic via checking)
-- (Skipping duplicate policy creation to avoid errors, relying on previous migration or manual fix)

-- 4. Backfill: restore missing account_members links from profiles
-- This fixes the broken signup state where user exists, account exists, profile links them, but member row is missing.
INSERT INTO public.account_members (user_id, account_id, role)
SELECT 
  p.id as user_id, 
  p.account_id, 
  'owner'::public.account_role
FROM public.profiles p
JOIN public.accounts a ON a.id = p.account_id
WHERE p.account_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.account_members am 
    WHERE am.user_id = p.id AND am.account_id = p.account_id
  )
ON CONFLICT (user_id, account_id) DO NOTHING;

-- 5. Cleanup: Drop user_roles if it exists (it acts as a trap)
DROP TABLE IF EXISTS public.user_roles;

-- 6. Trigger for call_logs updated_at
CREATE TRIGGER update_call_logs_updated_at
  BEFORE UPDATE ON public.call_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
