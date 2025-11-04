-- Fix type casting in handle_new_user_signup trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _account_id UUID;
  _email_domain TEXT;
  _is_generic BOOLEAN;
  _company_name TEXT;
  _is_first_user BOOLEAN;
BEGIN
  -- Extract metadata from auth user
  _email_domain := public.extract_email_domain(NEW.email);
  _is_generic := public.is_generic_email_domain(_email_domain);
  _company_name := COALESCE(NEW.raw_user_meta_data->>'company_name', _email_domain);
  
  -- Determine if account already exists
  IF _is_generic THEN
    -- For generic emails, match by exact company_name
    SELECT id INTO _account_id
    FROM public.accounts
    WHERE company_name = _company_name
      AND company_domain IS NULL
    LIMIT 1;
  ELSE
    -- For business emails, match by domain
    SELECT id INTO _account_id
    FROM public.accounts
    WHERE company_domain = _email_domain
    LIMIT 1;
  END IF;
  
  -- Create new account if doesn't exist
  IF _account_id IS NULL THEN
    INSERT INTO public.accounts (
      company_name,
      company_domain,
      trade,
      wants_advanced_voice,
      subscription_status,
      trial_start_date,
      trial_end_date
    ) VALUES (
      _company_name,
      CASE WHEN _is_generic THEN NULL ELSE _email_domain END,
      NEW.raw_user_meta_data->>'trade',
      COALESCE((NEW.raw_user_meta_data->>'wants_advanced_voice')::boolean, false),
      'trial'::subscription_status,
      now(),
      now() + interval '3 days'
    )
    RETURNING id INTO _account_id;
    
    _is_first_user := true;
  ELSE
    _is_first_user := false;
  END IF;
  
  -- Create profile for user
  INSERT INTO public.profiles (
    id,
    account_id,
    name,
    phone,
    is_primary,
    source
  ) VALUES (
    NEW.id,
    _account_id,
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'phone',
    _is_first_user,
    COALESCE(NEW.raw_user_meta_data->>'source', 'website')
  );
  
  -- Assign role: owner for first user, regular user for others (with explicit type casting)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN _is_first_user THEN 'owner'::app_role ELSE 'user'::app_role END);
  
  RETURN NEW;
END;
$function$;