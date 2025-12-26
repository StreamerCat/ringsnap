-- TEST: Manual Call Log Insertion
-- This verifies if the database allows inserting calls (Ruling out RLS/Permission issues).

INSERT INTO public.call_logs (
    vapi_call_id,
    account_id,
    phone_number_id,
    status,
    direction,
    from_number, -- caller_number was wrong
    to_number,
    started_at,
    duration_seconds,
    summary -- transcript_summary was wrong
) VALUES (
    'manual-test-' || gen_random_uuid(),
    '64413a9c-9711-4592-82f6-9b80aff074a1', -- Your Account ID
    (SELECT id FROM phone_numbers WHERE account_id = '64413a9c-9711-4592-82f6-9b80aff074a1' LIMIT 1),
    'completed',
    'inbound',
    '+15550001234', -- from_number
    '+19705003737', -- to_number (required by constraints potentially)
    now(),
    120,
    'This is a manual test log inserted via SQL.'
);

-- Check if it appears
SELECT count(*) as total_calls_after_insert 
FROM public.call_logs 
WHERE account_id = '64413a9c-9711-4592-82f6-9b80aff074a1';
