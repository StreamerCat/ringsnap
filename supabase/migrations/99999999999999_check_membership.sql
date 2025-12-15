-- CHECK MEMBERSHIP
-- Run this to see if ANY user is linked to this account.
-- If this returns 0 rows, then NO ONE can see the logs for this account.

SELECT * FROM public.account_members 
WHERE account_id = '64413a9c-9711-4592-82f6-9b80aff074a1';

-- Also check profiles to see who "owns" it in the profile definition
SELECT id as user_id, email, account_id 
FROM public.profiles 
WHERE account_id = '64413a9c-9711-4592-82f6-9b80aff074a1';
