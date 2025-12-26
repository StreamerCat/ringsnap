-- DEBUG RLS HELPER
-- This checks if the RLS helper function actually returns your account ID.

-- 1. Get your User ID for the account
DO $$
DECLARE
  v_user_id uuid;
  v_account_id uuid := '64413a9c-9711-4592-82f6-9b80aff074a1';
  v_count int;
BEGIN
  SELECT user_id INTO v_user_id FROM public.account_members WHERE account_id = v_account_id LIMIT 1;
  
  RAISE NOTICE 'User ID: %', v_user_id;

  -- 2. Simulate what get_my_account_ids does (since we can't call it as another user easily here)
  -- The function logic is: SELECT account_id FROM account_members WHERE user_id = auth.uid()
  -- OR SELECT account_id FROM profiles WHERE id = auth.uid()
  
  -- Check Account Members
  SELECT count(*) INTO v_count FROM public.account_members WHERE user_id = v_user_id;
  RAISE NOTICE 'Account Members Rows found for user: %', v_count;

  -- Check Profiles
  SELECT count(*) INTO v_count FROM public.profiles WHERE id = v_user_id AND account_id IS NOT NULL;
  RAISE NOTICE 'Profile Account Link found for user: %', v_count;
  
END $$;

-- 3. Check Function Existence
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_name = 'get_my_account_ids';
