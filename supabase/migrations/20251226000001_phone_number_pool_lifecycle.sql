-- Migration: Implement Phone Number Pool Lifecycle
-- Description: Adds lifecycle status, assignment tracking, and history table for phone number reuse.

-- 1. Create lifecycle enum
DO $$ BEGIN
    CREATE TYPE phone_lifecycle_status AS ENUM ('assigned', 'cooldown', 'pool', 'quarantine', 'released');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Add columns to phone_numbers
ALTER TABLE public.phone_numbers
ADD COLUMN IF NOT EXISTS lifecycle_status phone_lifecycle_status DEFAULT 'released',
ADD COLUMN IF NOT EXISTS assigned_account_id UUID REFERENCES public.accounts(id),
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cooldown_until TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_call_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS call_count_last_7d INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_lifecycle_change_at TIMESTAMPTZ DEFAULT now();

-- 3. Backfill existing data
-- Map existing 'status' to 'lifecycle_status'
-- active -> assigned
-- released -> released
-- failed/disabled -> quarantine (safety first)
UPDATE public.phone_numbers
SET 
  lifecycle_status = CASE 
    WHEN status = 'active' THEN 'assigned'::phone_lifecycle_status
    WHEN status = 'released' THEN 'released'::phone_lifecycle_status
    ELSE 'quarantine'::phone_lifecycle_status
  END,
  assigned_account_id = CASE 
    WHEN status = 'active' THEN account_id 
    ELSE NULL -- If released/failed, no active assignment
  END,
  assigned_at = CASE 
    WHEN status = 'active' THEN created_at 
    ELSE NULL 
  END,
  last_lifecycle_change_at = now()
WHERE lifecycle_status = 'released' AND assigned_account_id IS NULL AND status = 'active'; 

-- Note on backfill logic:
-- The default is 'released'.
-- If status is 'active', we set it to 'assigned' and set assigned_account_id.
-- If status is NOT active, we leave it (or set to released/quarantine). 
-- The WHERE clause above ensures we only update rows that haven't been touched yet if we run this multiple times, 
-- but actually strictly:
UPDATE public.phone_numbers
SET 
  lifecycle_status = 'assigned',
  assigned_account_id = account_id,
  assigned_at = created_at
WHERE status = 'active' AND assigned_account_id IS NULL;

-- 4. Create History Table
CREATE TABLE IF NOT EXISTS public.phone_number_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number_id UUID NOT NULL REFERENCES public.phone_numbers(id),
    account_id UUID NOT NULL REFERENCES public.accounts(id),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    end_reason TEXT, -- 'canceled', 'delinquent', 'failed_provision', 'fraud', 'manual', 'released'
    assistant_id_at_time TEXT,
    vapi_phone_id_at_time TEXT,
    notes JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on history table
ALTER TABLE public.phone_number_assignments ENABLE ROW LEVEL SECURITY;

-- 5. Add Constraints and Indexes

-- C1: Partial unique index: only one active assignment per E164 number
-- Note: e164_number might be null for old rows, so we filter valid ones
CREATE UNIQUE INDEX IF NOT EXISTS idx_phone_numbers_unique_assigned_e164
ON public.phone_numbers(e164_number)
WHERE lifecycle_status = 'assigned' AND e164_number IS NOT NULL;

-- C2: Ensure assigned_account_id IS NULL when not assigned
-- Function to validate constraint (Postgres check constraints with subqueries or partials are tricky, using CHECK)
ALTER TABLE public.phone_numbers
DROP CONSTRAINT IF EXISTS chk_assigned_account_logic;
ALTER TABLE public.phone_numbers
ADD CONSTRAINT chk_assigned_account_logic 
CHECK (
  (lifecycle_status = 'assigned' AND assigned_account_id IS NOT NULL) OR
  (lifecycle_status != 'assigned' AND assigned_account_id IS NULL)
);

-- C3: Index for pool lookup (speed up allocator)
CREATE INDEX IF NOT EXISTS idx_phone_numbers_pool_allocation
ON public.phone_numbers(released_at ASC)
WHERE lifecycle_status = 'pool';

-- C4: Index for history lookups
CREATE INDEX IF NOT EXISTS idx_phone_assignments_account 
ON public.phone_number_assignments(account_id);

CREATE INDEX IF NOT EXISTS idx_phone_assignments_phone 
ON public.phone_number_assignments(phone_number_id);

-- 6. Trigger to maintain consistency
-- Ensure 'status' column (legacy) is kept in sync roughly
CREATE OR REPLACE FUNCTION public.sync_phone_legacy_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lifecycle_status = 'assigned' THEN
    NEW.status := 'active';
  ELSIF NEW.lifecycle_status IN ('released', 'pool', 'cooldown') THEN
    NEW.status := 'released'; -- or 'disabled'
  ELSIF NEW.lifecycle_status = 'quarantine' THEN
    NEW.status := 'failed';
  END IF;
  
  -- Sync legacy account_id
  IF NEW.lifecycle_status = 'assigned' THEN
    NEW.account_id := NEW.assigned_account_id;
  ELSE
    NEW.account_id := NULL; -- Start clearing it out
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_phone_legacy_status ON public.phone_numbers;
CREATE TRIGGER trg_sync_phone_legacy_status
BEFORE UPDATE ON public.phone_numbers
FOR EACH ROW
EXECUTE FUNCTION public.sync_phone_legacy_status();
