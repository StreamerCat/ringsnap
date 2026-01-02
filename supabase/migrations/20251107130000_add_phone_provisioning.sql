-- Add provisioning-related columns to accounts table
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS provisioning_status text DEFAULT 'idle' CHECK (provisioning_status IN ('idle', 'provisioning', 'pending', 'active', 'failed')),
  ADD COLUMN IF NOT EXISTS vapi_phone_number_id uuid REFERENCES public.phone_numbers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS phone_provisioned_at timestamptz;

-- Add provisioning-related columns to phone_numbers table
ALTER TABLE public.phone_numbers
  ADD COLUMN IF NOT EXISTS vapi_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS provisioning_attempts int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_polled_at timestamptz,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS raw jsonb;

-- Create phone_number_notifications table for tracking notifications
CREATE TABLE IF NOT EXISTS public.phone_number_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number_id uuid NOT NULL REFERENCES public.phone_numbers(id) ON DELETE CASCADE,
  notification_type text NOT NULL, -- 'sms' | 'email'
  recipient text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at timestamptz,
  error_details text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_phone_notifications_status ON public.phone_number_notifications(status);
CREATE INDEX IF NOT EXISTS idx_phone_notifications_phone_id ON public.phone_number_notifications(phone_number_id);

-- Create provisioning_logs table for audit trail
CREATE TABLE IF NOT EXISTS public.provisioning_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  operation text NOT NULL, -- 'create_started' | 'create_success' | 'create_failed' | 'poll_success' | 'poll_failed' | 'notification_sent'
  details jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provisioning_logs_account_id ON public.provisioning_logs(account_id);

-- Enable RLS on new tables
ALTER TABLE public.phone_number_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provisioning_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can read their own notifications
DROP POLICY IF EXISTS "users_can_read_own_notifications" ON public.phone_number_notifications;
CREATE POLICY "users_can_read_own_notifications"
ON public.phone_number_notifications FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.phone_numbers pn
    JOIN public.accounts a ON a.id = pn.account_id
    WHERE pn.id = phone_number_notifications.phone_number_id
    AND a.user_id = auth.uid()
  )
);

-- RLS Policy: Users can read their own provisioning logs
DROP POLICY IF EXISTS "users_can_read_own_provisioning_logs" ON public.provisioning_logs;
CREATE POLICY "users_can_read_own_provisioning_logs"
ON public.provisioning_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.accounts a
    WHERE a.id = provisioning_logs.account_id
    AND a.user_id = auth.uid()
  )
);

-- Update indexes for performance
CREATE INDEX IF NOT EXISTS idx_accounts_provisioning_status ON public.accounts(provisioning_status);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_status ON public.phone_numbers(status);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_vapi_id ON public.phone_numbers(vapi_id);
