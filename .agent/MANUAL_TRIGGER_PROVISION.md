# Manual Trigger for provision-vapi Worker

## Quick Test - Trigger via curl

```bash
# Get your Supabase URL and service role key from .env or Supabase dashboard
SUPABASE_URL="https://rmyvvbqnccpfeyowidrq.supabase.co"
SERVICE_ROLE_KEY="your-service-role-key-here"

# Trigger the worker
curl -X POST "${SUPABASE_URL}/functions/v1/provision-vapi" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"triggered_by": "manual"}'
```

## Check Job Status

```sql
-- View recent provisioning jobs
SELECT 
  id,
  account_id,
  status,
  attempts,
  error,
  created_at,
  updated_at
FROM provisioning_jobs
ORDER BY created_at DESC
LIMIT 10;

-- Check account provisioning status
SELECT 
  id,
  company_name,
  provisioning_status,
  vapi_phone_number,
  vapi_assistant_id,
  provisioning_started_at,
  provisioning_completed_at
FROM accounts
WHERE provisioning_status != 'completed'
ORDER BY created_at DESC
LIMIT 5;
```

## Trigger from Supabase Dashboard

1. Go to Supabase Dashboard → Edge Functions
2. Find `provision-vapi` function
3. Click "Invoke" button
4. Send empty body `{}` or `{"triggered_by": "manual"}`
5. Check response for job processing results
