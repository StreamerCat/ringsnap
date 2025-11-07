# Phone Number Provisioning Implementation

This document covers the complete phone provisioning system for RingSnap, including provisioning, retry logic, notifications, and UI components.

## Architecture Overview

The phone provisioning system is designed to handle Vapi phone number provisioning asynchronously with the following key properties:

1. **Server-side provisioning** - All Vapi API calls happen in Edge Functions
2. **Polling mechanism** - Initial 20-second poll for immediate activation
3. **Scheduled retry** - Background job retries pending numbers every 5 minutes
4. **User-friendly UI** - Component shows loading, success, pending, and error states
5. **Notifications** - Email and SMS sent when number becomes active
6. **No blank screens** - UI always shows clear status and next steps

## Database Schema

### Tables

#### `accounts` (existing table - columns added)
- `provisioning_status` - 'idle' | 'provisioning' | 'pending' | 'active' | 'failed'
- `vapi_phone_number_id` - FK to phone_numbers table
- `phone_provisioned_at` - Timestamp when number became active

#### `phone_numbers` (existing table - columns added)
- `vapi_id` - Unique identifier from Vapi API
- `provisioning_attempts` - Counter for retry logic
- `last_polled_at` - When we last checked status with Vapi
- `activated_at` - When number became active
- `raw` - Full response from Vapi API (JSONB)

#### `phone_number_notifications` (new table)
Tracks notification deliveries for audit trail:
- `phone_number_id` - FK to phone_numbers
- `notification_type` - 'sms' | 'email'
- `recipient` - Phone number or email address
- `status` - 'pending' | 'sent' | 'failed'
- `sent_at` - When notification was delivered
- `error_details` - Error message if failed

#### `provisioning_logs` (new table)
Audit trail of all provisioning operations:
- `account_id` - FK to accounts
- `operation` - Type of operation (create_started, create_success, create_failed, poll_success, etc.)
- `details` - JSONB with context (area code, errors, attempt counts, etc.)

## Edge Functions

### 1. `provision_number`

**Purpose**: Main provisioning endpoint called from the onboarding UI

**Request:**
```json
{
  "areaCode": "303",
  "accountId": "uuid",
  "assistantId": "optional-vapi-assistant-id",
  "workflowId": "optional-vapi-workflow-id"
}
```

**Response (Success):**
```json
{
  "status": "active",
  "phone": {
    "id": "vapi-phone-id",
    "number": "+13031234567",
    "status": "active"
  },
  "phoneId": "db-uuid",
  "number": "+13031234567"
}
```

**Response (Pending):**
```json
{
  "status": "pending",
  "phone": {
    "id": "vapi-phone-id",
    "number": "+13031234567",
    "status": "pending"
  },
  "phoneId": "db-uuid",
  "error": "Phone is still provisioning. You will be notified when ready."
}
```

**Flow:**
1. Validates area code (must be 3 digits)
2. Marks account as `provisioning_status = 'provisioning'`
3. Calls Vapi API to create phone number
4. Polls Vapi GET endpoint for up to 20 seconds
5. Upserts phone record in DB
6. Updates account with status and link to phone record
7. Returns either `active` or `pending`

**Error Handling:**
- 400: Invalid area code
- 502: Vapi API failed
- 500: Database errors

### 2. `provision_number_retry`

**Purpose**: Scheduled function (runs every 5 minutes)

**Trigger**: Cron schedule `*/5 * * * *` (every 5 minutes)

**Flow:**
1. Fetches all phone records with `status = 'pending'` (max 50)
2. Filters out records with >= 20 provisioning_attempts
3. For each pending phone:
   - Calls Vapi GET endpoint
   - Updates phone record with latest status
   - Increments attempt counter
   - If now `active`:
     - Updates account status
     - Calls notification webhook/function
     - Logs success

**Output:** Summary of processed/activated phones

### 3. `notify_number_ready`

**Purpose**: Sends email and SMS when phone number becomes active

**Request:**
```json
{
  "type": "phone_ready",
  "accountId": "uuid",
  "phoneNumber": "+13031234567",
  "userEmail": "optional@email.com",
  "userPhone": "optional+15551234567"
}
```

**Flow:**
1. If email/phone not provided, fetches from auth
2. Composes HTML email with setup instructions
3. Sends via SendGrid (primary) or Resend (fallback)
4. Sends SMS via Twilio (if configured)
5. Updates notification records with delivery status
6. Returns success/failure status

**Email includes:**
- Phone number in large, readable format
- Setup instructions
- Link to settings page
- Support contact info

## React Component: `OnboardingNumberStep`

**Location**: `src/components/OnboardingNumberStep.tsx`

**Props:**
```typescript
interface OnboardingNumberStepProps {
  accountId: string;                    // Required: account UUID
  onSuccess?: (phoneNumber: string) => void;  // Callback when number active
  onPending?: () => void;               // Callback when status = pending
}
```

**States:**

1. **Idle** - Form shown, awaiting input
   - Area code input field
   - "Get Number" button (disabled if not 3 digits)
   - Helpful tip about nearby area codes

2. **Loading** - Provisioning in progress
   - Spinner animation
   - Button disabled

3. **Success** - Number is active
   - Green success box
   - Phone number displayed in monospace font
   - "Provision Another Number" button
   - Confirmation message

4. **Pending** - Number will be ready soon
   - Blue info box with clock icon
   - Clear explanation of pending state
   - "Check Status" button to re-poll
   - "Continue Later" button
   - Bulleted list of what happens next

5. **Error** - Provisioning failed
   - Error message displayed in form
   - Form re-enabled for retry
   - Helpful guidance (e.g., "try nearby area codes")

**Features:**
- React Hook Form with Zod validation
- Numeric input only (strips non-digits)
- Error boundaries and fallback messages
- User-friendly, non-technical language
- Responsive design using Tailwind + shadcn/ui

## Environment Variables

### Required

```
VAPI_API_KEY=sk_...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NOTIFY_EMAIL_FROM=noreply@getringsnap.com
APP_URL=https://app.getringsnap.com
```

### Email (choose one)

```
SENDGRID_API_KEY=SG...
# OR
RESEND_API_KEY=re_...
```

### SMS (optional)

```
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
NOTIFY_SMS_FROM=+1234567890
```

### Optional Webhook

```
NOTIFY_WEBHOOK_URL=https://your-api.com/webhooks/phone-ready
```

## Deployment Checklist

- [ ] Apply migration: `supabase/migrations/20251107130000_add_phone_provisioning.sql`
- [ ] Deploy Edge Functions:
  ```bash
  supabase functions deploy provision_number
  supabase functions deploy provision_number_retry
  supabase functions deploy notify_number_ready
  ```
- [ ] Set environment variables in Supabase dashboard
- [ ] Configure `provision_number_retry` scheduled function:
  - Enable scheduling
  - Set cron: `*/5 * * * *` (every 5 minutes)
- [ ] Import `OnboardingNumberStep` in onboarding flow
- [ ] Test with invalid area code (should return 400)
- [ ] Test with valid area code (should return 200 or 202)
- [ ] Monitor logs in Supabase dashboard

## Testing Guide

### Test 1: Invalid Area Code
```bash
curl -X POST https://your-project.supabase.co/functions/v1/provision_number \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"areaCode":"12","accountId":"test-uuid"}'

# Expected: 400 with "Invalid area code" error
```

### Test 2: Valid Area Code (Success)
1. Enter area code in UI (e.g., 303)
2. Click "Get Number"
3. Wait 2-5 seconds
4. Should show success state with phone number
5. Check database:
   ```sql
   SELECT * FROM phone_numbers WHERE account_id = 'your-account-id';
   SELECT provisioning_status FROM accounts WHERE id = 'your-account-id';
   ```

### Test 3: Vapi API Failure
- Temporarily set `VAPI_API_KEY` to invalid value
- Attempt provisioning
- Should return 502 with "Vapi create failed" error
- Account status should be `failed`
- UI should show error message and allow retry

### Test 4: Pending Path
1. Manually set a phone record to `status = 'pending'` with valid vapi_id
2. Wait for scheduled function to run (or invoke manually)
3. Check database for status update
4. Should see notification sent if configured

### Test 5: UI States
- [ ] Idle: Form visible, input focused
- [ ] Loading: Spinner shown, button disabled
- [ ] Success: Green box, number displayed, next steps shown
- [ ] Pending: Blue box, timeline explained, can check status
- [ ] Error: Error message shown, form re-enabled

### Test 6: End-to-End Flow
1. Create new account
2. Navigate to onboarding
3. Enter valid area code
4. Submit form
5. Wait for response (success or pending)
6. If success: verify number in database and account linked
7. If pending: wait 5 minutes and verify scheduled function activates it
8. Verify notification email/SMS received

### Test 7: Security
- [ ] No API keys logged
- [ ] No secrets in browser console
- [ ] RLS policies enforce user isolation
- [ ] Service role key never exposed to frontend
- [ ] Provisioning logs don't contain sensitive data

## Monitoring & Troubleshooting

### Check Function Logs
1. Go to Supabase dashboard
2. Navigate to **Functions** → **Logs**
3. Filter by function name
4. Look for `correlationId` in logs to trace requests

### Common Issues

**"VAPI_API_KEY not configured"**
- Check that environment variable is set in Supabase dashboard
- Verify key is not expired in Vapi dashboard

**Scheduled function not running**
- Check that scheduling is enabled in Supabase dashboard
- Verify cron syntax: `*/5 * * * *` for every 5 minutes
- Check function logs for errors

**Notifications not sending**
- Verify email provider credentials (SendGrid or Resend)
- Check Twilio credentials if SMS enabled
- Review `phone_number_notifications` table for failed records

**UI shows blank/error**
- Check browser console for errors
- Verify `accountId` prop is passed correctly
- Check network tab to see function invoke response

### Log Format

All functions use structured logging with this format:
```json
{
  "timestamp": "2025-11-07T20:30:00.000Z",
  "level": "info|warn|error",
  "functionName": "provision_number",
  "correlationId": "unique-request-id",
  "accountId": "user-account-id",
  "message": "Human-readable message",
  "context": { "key": "value" }
}
```

Sensitive data is automatically masked in logs (emails, phones, tokens).

## Architecture Diagram

```
User (Onboarding UI)
  ↓
OnboardingNumberStep.tsx
  ↓ (calls)
provision_number (Edge Function)
  ↓
Vapi API (POST /phone-number)
  ↓
Vapi Poll (GET /phone-number/:id, max 20s)
  ↓ (upserts to DB)
phone_numbers table
  ↓ (updates)
accounts.provisioning_status
  ↓
Response: 200 (active) or 202 (pending)

If pending:
  ↓ (scheduled, every 5 minutes)
provision_number_retry (Scheduled Function)
  ↓
Vapi Poll (GET /phone-number/:id)
  ↓ (if active)
notify_number_ready (Function or Webhook)
  ↓ (sends)
Email (SendGrid/Resend) + SMS (Twilio)
  ↓
User notified
```

## Key Design Decisions

1. **20-second initial poll** - Balances user experience with server load. Most numbers activate within this window.

2. **Scheduled retry every 5 minutes** - Provides reasonable latency for slower provisioning without excessive polling.

3. **Status = pending in UI** - Never leaves user wondering. Clear communication about next steps and timeline.

4. **Email + SMS notifications** - Dual notification ensures user sees the update. Email for instructions, SMS for immediate alert.

5. **JSONB raw response** - Stores full Vapi response for debugging and future feature additions.

6. **Attempt counter** - Prevents infinite retries. Stops after 20 attempts (~100 minutes).

7. **RLS policies** - Users can only see their own phone numbers and logs. Service role used only for functions.

## Future Enhancements

- [ ] Support multiple phone numbers per account
- [ ] Bulk provisioning for multiple area codes
- [ ] Webhook for custom retry logic
- [ ] Real-time status updates via WebSocket
- [ ] Vapi assistant/workflow linking during provisioning
- [ ] Number porting/migration support
- [ ] Area code availability pre-check
- [ ] Phone number management dashboard

## Support & Questions

For issues or questions about this implementation:
1. Check provisioning_logs table for error details
2. Review Edge Function logs in Supabase dashboard
3. Verify all environment variables are set
4. Check network requests in browser dev tools
5. Contact support with correlationId from logs
