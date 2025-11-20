-- Migration: Atomic Account Creation Transaction
-- Purpose: Create account, auth user, profile, and roles in a single atomic transaction
--          Ensures all-or-nothing semantics for signup flow
-- Date: 2025-11-20

-- ==============================================================================
-- PART 1: Helper function to safely create auth user
-- ==============================================================================

-- Note: Direct INSERT into auth.users requires careful handling
-- This function wraps the auth user creation with proper error handling

CREATE OR REPLACE FUNCTION public.create_auth_user_internal(
  p_email TEXT,
  p_password TEXT,
  p_user_metadata JSONB
) RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_encrypted_password TEXT;
BEGIN
  -- Generate user ID
  v_user_id := gen_random_uuid();

  -- Encrypt password using pgcrypto
  v_encrypted_password := crypt(p_password, gen_salt('bf'));

  -- Insert into auth.users table
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_sent_at,
    raw_user_meta_data,
    raw_app_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',  -- Default instance ID
    v_user_id,
    'authenticated',
    'authenticated',
    p_email,
    v_encrypted_password,
    now(),  -- Email pre-confirmed for sales-guided signups
    now(),
    p_user_metadata,
    '{"provider":"email","providers":["email"]}'::jsonb,
    now(),
    now(),
    '',  -- Empty confirmation token (already confirmed)
    '',
    '',
    ''
  );

  -- Also insert into auth.identities for email provider
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', p_email
    ),
    'email',
    now(),
    now(),
    now()
  );

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.create_auth_user_internal IS 'Internal helper to create auth user with password (used by account transaction)';

-- ==============================================================================
-- PART 2: Main atomic account creation transaction
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.create_account_transaction(
  p_email TEXT,
  p_password TEXT,
  p_stripe_customer_id TEXT,
  p_stripe_subscription_id TEXT,
  p_signup_channel signup_channel_type,
  p_sales_rep_id UUID,
  p_account_data JSONB,
  p_correlation_id TEXT
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_account_id UUID;
  v_profile_id UUID;
  v_result JSONB;
  v_trial_end_date TIMESTAMPTZ;
BEGIN
  -- Calculate trial end date (3 days from now)
  v_trial_end_date := now() + INTERVAL '3 days';

  -- ============================================================================
  -- STEP 1: Create auth user
  -- ============================================================================
  BEGIN
    v_user_id := public.create_auth_user_internal(
      p_email,
      p_password,
      jsonb_build_object(
        'name', p_account_data->>'name',
        'phone', p_account_data->>'phone',
        'company_name', p_account_data->>'company_name',
        'signup_channel', p_signup_channel::text,
        'correlation_id', p_correlation_id
      )
    );
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'Email already registered: %', p_email;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'Failed to create auth user: %', SQLERRM;
  END;

  -- ============================================================================
  -- STEP 2: Create account record
  -- ============================================================================
  BEGIN
    INSERT INTO public.accounts (
      company_name,
      trade,
      stripe_customer_id,
      stripe_subscription_id,
      signup_channel,
      sales_rep_id,
      provisioning_stage,
      subscription_status,
      trial_start_date,
      trial_end_date,
      plan_type,
      phone_number_area_code,
      zip_code,
      business_hours,
      assistant_gender,
      wants_advanced_voice,
      company_website,
      service_area,
      emergency_policy,
      billing_state,
      provisioning_status,
      phone_number_status,
      created_at,
      updated_at
    ) VALUES (
      p_account_data->>'company_name',
      p_account_data->>'trade',
      p_stripe_customer_id,
      p_stripe_subscription_id,
      p_signup_channel,
      p_sales_rep_id,
      'stripe_linked'::provisioning_stage,  -- Initial stage after Stripe setup
      'trial'::text,
      now(),
      v_trial_end_date,
      p_account_data->>'plan_type',
      p_account_data->>'phone_number_area_code',
      p_account_data->>'zip_code',
      COALESCE((p_account_data->>'business_hours')::jsonb, '{}'::jsonb),
      COALESCE(p_account_data->>'assistant_gender', 'female'),
      COALESCE((p_account_data->>'wants_advanced_voice')::boolean, false),
      p_account_data->>'company_website',
      p_account_data->>'service_area',
      p_account_data->>'emergency_policy',
      p_account_data->>'billing_state',
      'pending'::text,
      'pending'::text,
      now(),
      now()
    )
    RETURNING id INTO v_account_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'Failed to create account: %', SQLERRM;
  END;

  -- ============================================================================
  -- STEP 3: Create profile record
  -- ============================================================================
  BEGIN
    INSERT INTO public.profiles (
      id,
      account_id,
      name,
      phone,
      is_primary,
      signup_channel,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      v_account_id,
      p_account_data->>'name',
      p_account_data->>'phone',
      true,
      p_signup_channel,
      now(),
      now()
    )
    RETURNING id INTO v_profile_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'Failed to create profile: %', SQLERRM;
  END;

  -- ============================================================================
  -- STEP 4: Assign owner role
  -- ============================================================================
  BEGIN
    INSERT INTO public.user_roles (
      user_id,
      role,
      created_at
    ) VALUES (
      v_user_id,
      'owner',
      now()
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'Failed to assign owner role: %', SQLERRM;
  END;

  -- ============================================================================
  -- STEP 5: Log initial state transition
  -- ============================================================================
  BEGIN
    INSERT INTO public.provisioning_state_transitions (
      account_id,
      correlation_id,
      from_stage,
      to_stage,
      triggered_by,
      metadata
    ) VALUES (
      v_account_id,
      p_correlation_id,
      NULL,  -- Initial state
      'stripe_linked'::provisioning_stage,
      'create-trial',
      jsonb_build_object(
        'stripe_customer_id', p_stripe_customer_id,
        'stripe_subscription_id', p_stripe_subscription_id,
        'signup_channel', p_signup_channel::text,
        'sales_rep_id', p_sales_rep_id
      )
    );
  EXCEPTION
    WHEN OTHERS THEN
      -- Log failure but don't abort transaction
      RAISE WARNING 'Failed to log state transition: %', SQLERRM;
  END;

  -- ============================================================================
  -- STEP 6: Update user metadata with account_id
  -- ============================================================================
  BEGIN
    UPDATE auth.users
    SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object(
      'account_id', v_account_id,
      'account_created_at', now()
    )
    WHERE id = v_user_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Failed to update user metadata: %', SQLERRM;
  END;

  -- ============================================================================
  -- STEP 7: Return result
  -- ============================================================================
  v_result := jsonb_build_object(
    'user_id', v_user_id,
    'account_id', v_account_id,
    'profile_id', v_profile_id,
    'trial_end_date', v_trial_end_date,
    'provisioning_stage', 'stripe_linked'
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    -- Rollback is automatic due to transaction
    RAISE EXCEPTION 'Account creation transaction failed at %: %', SQLERRM, SQLSTATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.create_account_transaction IS 'Atomically creates auth user, account, profile, and assigns owner role in a single transaction';

-- ==============================================================================
-- PART 3: Helper function to check if email exists
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.email_exists(p_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM auth.users WHERE email = p_email
  ) INTO v_exists;

  RETURN v_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.email_exists IS 'Checks if an email address is already registered';

-- ==============================================================================
-- PART 4: Helper function to get account by email
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_account_by_email(p_email TEXT)
RETURNS TABLE (
  account_id UUID,
  user_id UUID,
  company_name TEXT,
  provisioning_stage TEXT,
  subscription_status TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    u.id,
    a.company_name,
    a.provisioning_stage::TEXT,
    a.subscription_status,
    a.created_at
  FROM auth.users u
  JOIN public.profiles p ON p.id = u.id
  JOIN public.accounts a ON a.id = p.account_id
  WHERE u.email = p_email
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_account_by_email IS 'Retrieves account information by email address (for idempotency checks)';

-- ==============================================================================
-- PART 5: Grant appropriate permissions
-- ==============================================================================

-- Service role (edge functions) needs to execute these functions
GRANT EXECUTE ON FUNCTION public.create_account_transaction TO service_role;
GRANT EXECUTE ON FUNCTION public.create_auth_user_internal TO service_role;
GRANT EXECUTE ON FUNCTION public.email_exists TO service_role;
GRANT EXECUTE ON FUNCTION public.get_account_by_email TO service_role;

-- Authenticated users can check if email exists (for frontend validation)
GRANT EXECUTE ON FUNCTION public.email_exists TO authenticated;
GRANT EXECUTE ON FUNCTION public.email_exists TO anon;
