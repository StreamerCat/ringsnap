-- Auth System Tables Migration
-- Creates tables for magic links, tokens, sessions, passkeys, and audit logging

-- Auth tokens table for magic links, invites, and one-time tokens
CREATE TABLE IF NOT EXISTS public.auth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_type text NOT NULL CHECK (token_type IN ('magic_link', 'invite', 'password_reset', 'finish_setup')),
  token_hash text NOT NULL UNIQUE,
  email text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  meta jsonb DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  device_nonce text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_auth_tokens_token_hash ON public.auth_tokens(token_hash);
CREATE INDEX idx_auth_tokens_email ON public.auth_tokens(email);
CREATE INDEX idx_auth_tokens_expires_at ON public.auth_tokens(expires_at);
CREATE INDEX idx_auth_tokens_user_id ON public.auth_tokens(user_id);

-- Auth events table for security audit logging
CREATE TABLE IF NOT EXISTS public.auth_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_data jsonb DEFAULT '{}'::jsonb,
  ip_address inet,
  user_agent text,
  success boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_auth_events_user_id ON public.auth_events(user_id);
CREATE INDEX idx_auth_events_account_id ON public.auth_events(account_id);
CREATE INDEX idx_auth_events_created_at ON public.auth_events(created_at);
CREATE INDEX idx_auth_events_event_type ON public.auth_events(event_type);

-- Email events table for tracking deliverability via Resend webhooks
CREATE TABLE IF NOT EXISTS public.email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id text,
  email_type text NOT NULL,
  recipient text NOT NULL,
  event text NOT NULL,
  event_data jsonb DEFAULT '{}'::jsonb,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_email_events_email_id ON public.email_events(email_id);
CREATE INDEX idx_email_events_recipient ON public.email_events(recipient);
CREATE INDEX idx_email_events_user_id ON public.email_events(user_id);
CREATE INDEX idx_email_events_created_at ON public.email_events(created_at);

-- Passkeys/WebAuthn credentials table
CREATE TABLE IF NOT EXISTS public.passkeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id text NOT NULL UNIQUE,
  public_key text NOT NULL,
  counter bigint DEFAULT 0,
  device_name text,
  transports text[] DEFAULT ARRAY[]::text[],
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_passkeys_user_id ON public.passkeys(user_id);
CREATE INDEX idx_passkeys_credential_id ON public.passkeys(credential_id);

-- Extended sessions table for tracking active sessions with device info
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token text NOT NULL UNIQUE,
  device_info jsonb DEFAULT '{}'::jsonb,
  ip_address inet,
  user_agent text,
  expires_at timestamptz NOT NULL,
  last_activity_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX idx_user_sessions_session_token ON public.user_sessions(session_token);
CREATE INDEX idx_user_sessions_expires_at ON public.user_sessions(expires_at);

-- Rate limiting table for abuse prevention
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  action text NOT NULL,
  count integer DEFAULT 1,
  window_start timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX idx_rate_limits_identifier_action ON public.rate_limits(identifier, action, window_start);
CREATE INDEX idx_rate_limits_window_start ON public.rate_limits(window_start);

-- Add 2FA fields to profiles table if not exists
DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS totp_secret text;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS totp_enabled boolean DEFAULT false;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS totp_backup_codes text[];
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS requires_2fa boolean DEFAULT false;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_2fa_at timestamptz;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS recovery_email text;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- Add step-up auth tracking
DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_step_up_at timestamptz;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- Update staff_roles table to include SSO fields if not exists
DO $$ BEGIN
  ALTER TABLE public.staff_roles ADD COLUMN IF NOT EXISTS sso_provider text;
  ALTER TABLE public.staff_roles ADD COLUMN IF NOT EXISTS sso_id text;
  ALTER TABLE public.staff_roles ADD COLUMN IF NOT EXISTS enforce_2fa boolean DEFAULT true;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- Function to clean up expired tokens (run via cron or periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_auth_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM public.auth_tokens
  WHERE expires_at < now() - interval '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old rate limit records
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM public.rate_limits
  WHERE window_start < now() - interval '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log auth events
CREATE OR REPLACE FUNCTION public.log_auth_event(
  p_user_id uuid,
  p_account_id uuid,
  p_event_type text,
  p_event_data jsonb DEFAULT '{}'::jsonb,
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_success boolean DEFAULT true
)
RETURNS uuid AS $$
DECLARE
  v_event_id uuid;
BEGIN
  INSERT INTO public.auth_events (
    user_id,
    account_id,
    event_type,
    event_data,
    ip_address,
    user_agent,
    success
  ) VALUES (
    p_user_id,
    p_account_id,
    p_event_type,
    p_event_data,
    p_ip_address,
    p_user_agent,
    p_success
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check rate limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier text,
  p_action text,
  p_max_count integer,
  p_window_minutes integer DEFAULT 60
)
RETURNS boolean AS $$
DECLARE
  v_count integer;
  v_window_start timestamptz;
BEGIN
  v_window_start := date_trunc('hour', now()) - (extract(minute from now())::integer % p_window_minutes) * interval '1 minute';

  -- Get or create rate limit record
  INSERT INTO public.rate_limits (identifier, action, count, window_start)
  VALUES (p_identifier, p_action, 1, v_window_start)
  ON CONFLICT (identifier, action, window_start)
  DO UPDATE SET count = rate_limits.count + 1
  RETURNING count INTO v_count;

  RETURN v_count <= p_max_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on new tables
ALTER TABLE public.auth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passkeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS Policies for auth_tokens (admin and owner access only)
CREATE POLICY "Users can view their own auth tokens"
  ON public.auth_tokens FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Service role can manage all auth tokens"
  ON public.auth_tokens FOR ALL
  TO service_role
  USING (true);

-- RLS Policies for auth_events (users can view their own)
CREATE POLICY "Users can view their own auth events"
  ON public.auth_events FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all auth events"
  ON public.auth_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_roles
      WHERE user_id = auth.uid() AND role::text IN ('admin', 'support', 'platform_admin', 'platform_owner')
    )
  );

CREATE POLICY "Service role can manage all auth events"
  ON public.auth_events FOR ALL
  TO service_role
  USING (true);

-- RLS Policies for email_events (users can view their own)
CREATE POLICY "Users can view their own email events"
  ON public.email_events FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage all email events"
  ON public.email_events FOR ALL
  TO service_role
  USING (true);

-- RLS Policies for passkeys (users manage their own)
CREATE POLICY "Users can manage their own passkeys"
  ON public.passkeys FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage all passkeys"
  ON public.passkeys FOR ALL
  TO service_role
  USING (true);

-- RLS Policies for user_sessions (users can view/revoke their own)
CREATE POLICY "Users can manage their own sessions"
  ON public.user_sessions FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage all sessions"
  ON public.user_sessions FOR ALL
  TO service_role
  USING (true);

-- RLS Policies for rate_limits (service role only)
CREATE POLICY "Service role can manage rate limits"
  ON public.rate_limits FOR ALL
  TO service_role
  USING (true);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT ALL ON public.auth_tokens TO service_role;
GRANT ALL ON public.auth_events TO service_role;
GRANT ALL ON public.email_events TO service_role;
GRANT ALL ON public.passkeys TO service_role;
GRANT ALL ON public.user_sessions TO service_role;
GRANT ALL ON public.rate_limits TO service_role;

GRANT SELECT ON public.auth_tokens TO authenticated;
GRANT SELECT ON public.auth_events TO authenticated;
GRANT SELECT ON public.email_events TO authenticated;
GRANT ALL ON public.passkeys TO authenticated;
GRANT ALL ON public.user_sessions TO authenticated;
