-- Check if ANY logs exist for this account (regardless of time)
SELECT 
    count(*) as call_count,
    MAX(created_at) as last_created,
    MAX(started_at) as last_started
FROM call_logs
WHERE account_id = '64413a9c-9711-4592-82f6-9b80aff074a1'; -- User's Account ID from previous debug

-- Also check if there are orphan logs (no account_id) that might have come in
SELECT count(*) as orphan_count, MAX(created_at) as last_orphan
FROM call_logs
WHERE account_id IS NULL;
