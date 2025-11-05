# Provisioning Smoke Test

Use these commands to verify the provisioning workflow end-to-end once the environment variables below are configured.

```bash
export SUPABASE_URL="https://your-project-ref.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
export VAPI_API_KEY="your-vapi-api-key"
```

## 1. Trigger provisioning via Edge Function

```bash
curl -sS -X POST "$SUPABASE_URL/functions/v1/provision" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"accountId":"<ACCOUNT_UUID>","userId":"<USER_UUID>","companyName":"RingSnap Demo","areaCode":"303"}'
```

If the requested area code has no inventory, the function automatically retries without the area code and returns the purchased phone number in the response.

## 2. Inspect purchased number and assistant rows

```bash
curl -sS "$SUPABASE_URL/rest/v1/vapi_numbers?account_id=eq.<ACCOUNT_UUID>" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY"
```

```bash
curl -sS "$SUPABASE_URL/rest/v1/vapi_assistants?account_id=eq.<ACCOUNT_UUID>" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY"
```

## 3. Verify the account record

```bash
curl -sS "$SUPABASE_URL/rest/v1/accounts?id=eq.<ACCOUNT_UUID>&select=vapi_assistant_id,vapi_number_id,phone_number_e164" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY"
```

Successful provisioning updates the account with the assistant ID, phone number ID, and the purchased E.164 phone number.
