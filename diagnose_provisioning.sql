-- Diagnostic queries to check provisioning status

-- 1. Check most recent account
SELECT 
  id,
  company_name,
  vapi_assistant_id,
  vapi_phone_number,
  phone_number_status,
  provisioning_status,
  created_at
FROM accounts 
ORDER BY created_at DESC 
LIMIT 1;

-- 2. Check if phone_numbers row exists for most recent account
SELECT 
  pn.id,
  pn.account_id,
  pn.phone_number,
  pn.vapi_phone_id,
  pn.status,
  pn.is_primary,
  pn.created_at
FROM phone_numbers pn
JOIN accounts a ON pn.account_id = a.id
ORDER BY a.created_at DESC
LIMIT 1;

-- 3. Check vapi_assistants for most recent account
SELECT 
  va.id,
  va.account_id,
  va.vapi_assistant_id,
  va.created_at
FROM vapi_assistants va
JOIN accounts a ON va.account_id = a.id
ORDER BY a.created_at DESC
LIMIT 1;

-- 4. Check provisioning_jobs for most recent account
SELECT 
  pj.id,
  pj.account_id,
  pj.status,
  pj.attempts,
  pj.error,
  pj.vapi_assistant_id,
  pj.vapi_phone_id,
  pj.created_at,
  pj.completed_at
FROM provisioning_jobs pj
JOIN accounts a ON pj.account_id = a.id
ORDER BY a.created_at DESC
LIMIT 1;

-- 5. Check for any provisioning errors
SELECT 
  id,
  account_id,
  status,
  error,
  attempts,
  created_at
FROM provisioning_jobs
WHERE status IN ('failed', 'failed_permanent')
ORDER BY created_at DESC
LIMIT 5;
