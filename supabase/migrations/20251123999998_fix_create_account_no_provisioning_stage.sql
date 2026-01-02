-- Migration: Fix create_account_transaction to remove provisioning_stage references
-- Purpose: Remove all provisioning_stage enum usage (it was removed/rolled back)
-- Date: 2025-11-23
-- Agent: @schema-migration-agent (go-green fix)

-- ==============================================================================
-- PART 1: Drop the existing create_account_transaction function
-- ==============================================================================

-- Conditionally drop old function signatures (signup_channel_type may not exist)
DO $$
BEGIN
  -- Try to drop the old signature with signup_channel_type
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'signup_channel_type') THEN
    EXECUTE 'DROP FUNCTION IF EXISTS public.create_account_transaction(TEXT, TEXT, TEXT, TEXT, signup_channel_type, UUID, JSONB, TEXT) CASCADE';
  END IF;

  -- Also drop if it was created with TEXT
  DROP FUNCTION IF EXISTS public.create_account_transaction(TEXT, TEXT, TEXT, TEXT, TEXT, UUID, JSONB, TEXT) CASCADE;
END $$;

-- ==============================================================================
-- PART 2: Recreate without provisioning_stage, using TEXT for signup_channel
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.create_account_transaction(
  p_email TEXT,
  p_password TEXT,
  p_stripe_customer_id TEXT,
  p_stripe_subscription_id TEXT,
  p_signup_channel TEXT,
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
  v_signup_channel TEXT;
BEGIN
  -- Normalize signup_channel (default to 'unknown' if null/empty)
  v_signup_channel := COALESCE(NULLIF(p_signup_channel, ''), 'unknown');

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
        'signup_channel', v_signup_channel,
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
  -- STEP 2: Create account record (WITHOUT provisioning_stage)
  -- ============================================================================
  BEGIN
    INSERT INTO public.accounts (
      company_name,
      trade,
      stripe_customer_id,
      stripe_subscription_id,
      signup_channel,
      sales_rep_id,
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
      v_signup_channel,
      p_sales_rep_id,
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
      'pending'::text,  -- provisioning_status valid values: pending, provisioning, active, failed
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
      v_signup_channel,
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
  -- STEP 5: Update user metadata with account_id
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
  -- STEP 6: Return result (WITHOUT provisioning_stage)
  -- ============================================================================
  v_result := jsonb_build_object(
    'user_id', v_user_id,
    'account_id', v_account_id,
    'profile_id', v_profile_id,
    'trial_end_date', v_trial_end_date,
    'provisioning_status', 'pending'
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    -- Rollback is automatic due to transaction
    RAISE EXCEPTION 'Account creation transaction failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.create_account_transaction IS 'Atomically creates auth user, account, profile, and assigns owner role (no provisioning_stage)';

-- ==============================================================================
-- PART 3: Grant appropriate permissions
-- ==============================================================================

GRANT EXECUTE ON FUNCTION public.create_account_transaction(TEXT, TEXT, TEXT, TEXT, TEXT, UUID, JSONB, TEXT) TO service_role;

