-- Bootstrap helper: insert first platform_owner into staff_roles.
--
-- The staff_roles table is protected by RLS so only the service role can write
-- to it.  This SECURITY DEFINER function runs as the defining role (postgres /
-- service role), bypassing RLS.  It is intentionally NOT granted to PUBLIC or
-- the `authenticated` role — it must be called from the Supabase SQL Editor
-- (which runs as superuser) or via a service-role connection.
--
-- Usage (run in Supabase SQL Editor):
--   SELECT bootstrap_platform_owner('owner@getringsnap.com');
--
-- Returns a text status message so you can verify success.

CREATE OR REPLACE FUNCTION public.bootstrap_platform_owner(p_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_existing_role text;
BEGIN
  -- Normalise the email
  p_email := lower(trim(p_email));

  -- Look up the auth user
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = p_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN 'ERROR: No auth user found with email ' || p_email
      || '. Make sure the user exists in Supabase Auth before running this.';
  END IF;

  -- Check if they already have a role
  SELECT role INTO v_existing_role
  FROM public.staff_roles
  WHERE user_id = v_user_id;

  IF v_existing_role IS NOT NULL THEN
    RETURN 'INFO: ' || p_email || ' already has role ''' || v_existing_role
      || ''' (user_id=' || v_user_id || '). No changes made.';
  END IF;

  -- Insert as platform_owner
  INSERT INTO public.staff_roles (user_id, role)
  VALUES (v_user_id, 'platform_owner');

  RETURN 'OK: ' || p_email || ' (user_id=' || v_user_id
    || ') has been added as platform_owner. They can now log in to /admin.';
END;
$$;

-- Lock it down: only superuser / service_role can call this function.
REVOKE ALL ON FUNCTION public.bootstrap_platform_owner(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bootstrap_platform_owner(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_platform_owner(text) TO service_role;
