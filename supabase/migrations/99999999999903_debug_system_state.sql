-- DEBUG SCRIPT: Check System State
-- Run this in Supabase SQL Editor to see what is actually in the database.

-- 1. Check Account Status for the known phone number
SELECT 
    id as account_id, 
    company_name, 
    vapi_phone_number, 
    provisioning_status,
    provisioning_completed_at
FROM public.accounts 
WHERE id IN (
    SELECT account_id FROM public.phone_numbers WHERE phone_number = '+19705003737'
);

-- 2. Check if any call logs exist for this account
SELECT 
    count(*) as total_calls,
    MAX(created_at) as last_call_created,
    MAX(started_at) as last_call_started
FROM public.call_logs
WHERE account_id IN (
    SELECT account_id FROM public.phone_numbers WHERE phone_number = '+19705003737'
);

-- 3. Check recent call log details (to see if insertion worked)
SELECT 
    vapi_call_id, 
    status, 
    duration_seconds, 
    created_at 
FROM public.call_logs 
WHERE account_id IN (
    SELECT account_id FROM public.phone_numbers WHERE phone_number = '+19705003737'
)
ORDER BY created_at DESC 
LIMIT 5;

-- 4. Check Phone Number Record
SELECT 
    id, 
    phone_number, 
    vapi_phone_id, 
    vapi_id 
FROM public.phone_numbers 
WHERE phone_number = '+19705003737';
