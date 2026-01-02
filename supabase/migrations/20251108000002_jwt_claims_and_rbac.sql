-- JWT Claims and RBAC Migration
-- Sets up custom JWT claims for roles and account context

-- Function to get user's primary role
CREATE OR REPLACE FUNCTION public.get_user_primary_role(p_user_id uuid)
RETURNS text AS $$
DECLARE
  v_role text;
BEGIN
  -- Check if user is staff first (staff roles take precedence)
  SELECT role INTO v_role
  FROM public.staff_roles
  WHERE user_id = p_user_id
  ORDER BY
    CASE role
      WHEN 'admin' THEN 1
      WHEN 'owner' THEN 2
      WHEN 'sales' THEN 3
      WHEN 'support' THEN 4
      WHEN 'billing' THEN 5
      WHEN 'readonly' THEN 6
      ELSE 7
    END
  LIMIT 1;

  IF v_role IS NOT NULL THEN
    RETURN v_role;
  END IF;

  -- Check account_members table
  SELECT am.role INTO v_role
  FROM public.account_members am
  WHERE am.user_id = p_user_id
  ORDER BY
    CASE am.role
      WHEN 'owner' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'member' THEN 3
      ELSE 4
    END
  LIMIT 1;

  IF v_role IS NOT NULL THEN
    RETURN v_role;
  END IF;

  -- Default to 'user' role
  RETURN 'user';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to get user's account_id
CREATE OR REPLACE FUNCTION public.get_user_account_id(_user_id uuid)
RETURNS uuid AS $$
DECLARE
  v_account_id uuid;
BEGIN
  -- Get from profiles table first
  SELECT account_id INTO v_account_id
  FROM public.profiles
  WHERE id = _user_id;

  IF v_account_id IS NOT NULL THEN
    RETURN v_account_id;
  END IF;

  -- Fallback to account_members
  SELECT account_id INTO v_account_id
  FROM public.account_members
  WHERE user_id = _user_id
  LIMIT 1;

  RETURN v_account_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to set custom JWT claims
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_role text;
  v_account_id uuid;
  v_email_verified boolean;
  v_requires_2fa boolean;
  v_last_2fa_at timestamptz;
BEGIN
  -- Extract user ID from event
  v_user_id := (event->>'user_id')::uuid;

  -- Get user's role
  v_role := public.get_user_primary_role(v_user_id);

  -- Get user's account_id
  v_account_id := public.get_user_account_id(v_user_id);

  -- Get 2FA status
  SELECT email_verified, requires_2fa, last_2fa_at
  INTO v_email_verified, v_requires_2fa, v_last_2fa_at
  FROM public.profiles
  WHERE id = v_user_id;

  -- Add custom claims to the JWT
  event := jsonb_set(event, '{claims,app_metadata}',
    jsonb_build_object(
      'role', COALESCE(v_role, 'user'),
      'account_id', v_account_id,
      'email_verified', COALESCE(v_email_verified, false),
      'requires_2fa', COALESCE(v_requires_2fa, false),
      'last_2fa_at', v_last_2fa_at
    )
  );

  RETURN event;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user has role
CREATE OR REPLACE FUNCTION public.has_role(p_user_id uuid, p_role text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.staff_roles
    WHERE user_id = p_user_id AND role = p_role
  ) OR EXISTS (
    SELECT 1 FROM public.account_members
    WHERE user_id = p_user_id AND role = p_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper function to check if user has any of the roles
CREATE OR REPLACE FUNCTION public.has_any_role(p_user_id uuid, p_roles text[])
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.staff_roles
    WHERE user_id = p_user_id AND role = ANY(p_roles)
  ) OR EXISTS (
    SELECT 1 FROM public.account_members
    WHERE user_id = p_user_id AND role = ANY(p_roles)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper function to check account access
CREATE OR REPLACE FUNCTION public.has_account_access(p_user_id uuid, p_account_id uuid)
RETURNS boolean AS $$
BEGIN
  -- Check if user is staff (staff can access multiple accounts)
  IF EXISTS (
    SELECT 1 FROM public.staff_roles
    WHERE user_id = p_user_id AND role::text IN ('admin', 'support', 'sales', 'platform_admin', 'platform_owner')
  ) THEN
    RETURN true;
  END IF;

  -- Check if user belongs to the account
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id AND account_id = p_account_id
  ) OR EXISTS (
    SELECT 1 FROM public.account_members
    WHERE user_id = p_user_id AND account_id = p_account_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to refresh user's JWT claims (call after role changes)
CREATE OR REPLACE FUNCTION public.refresh_user_jwt(p_user_id uuid)
RETURNS void AS $$
BEGIN
  -- This will be called after role changes to force JWT refresh on next request
  -- The actual JWT refresh happens client-side by calling supabase.auth.refreshSession()
  PERFORM public.log_auth_event(
    p_user_id,
    public.get_user_account_id(p_user_id),
    'jwt_refresh_requested',
    jsonb_build_object('reason', 'role_change')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment on profiles
COMMENT ON COLUMN public.profiles.totp_secret IS 'Encrypted TOTP secret for 2FA';
COMMENT ON COLUMN public.profiles.totp_enabled IS 'Whether 2FA via TOTP is enabled';
COMMENT ON COLUMN public.profiles.totp_backup_codes IS 'Array of hashed backup codes';
COMMENT ON COLUMN public.profiles.requires_2fa IS 'Whether user is required to use 2FA (staff)';
COMMENT ON COLUMN public.profiles.last_2fa_at IS 'Last time user completed 2FA challenge';
COMMENT ON COLUMN public.profiles.last_step_up_at IS 'Last time user completed step-up auth';
COMMENT ON COLUMN public.profiles.email_verified IS 'Whether email is verified';
COMMENT ON COLUMN public.profiles.recovery_email IS 'Recovery email for account recovery';
