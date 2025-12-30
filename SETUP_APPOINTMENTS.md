# Appointment System Phase 1 Setup Instructions

## 1. Database Migrations

Run the following migrations (found in `supabase/migrations/`) to create the schema:

1. `20251231000001_appointments_phase1.sql` (Schema)
2. `20251231000002_google_calendar_foundation.sql` (Phase 2 Placeholder)
3. `20251231000003_backfill_notification_phone.sql` (Data Backfill)

## 2. Environment Variables / Secrets

Set the following secrets in your Supabase project (and Vercel if applicable):

| Secret Key | Value / Description | Function(s) |
| :--- | :--- | :--- |
| `VAPI_WEBHOOK_SECRET` | A secure random string (e.g. UUID). **Must match** the header configured in your Vapi tool definition later. | `vapi-tools-appointments` |
| `CRON_SECRET` | A secure random string. Used to secure the reminders dispatcher. | `reminders-dispatcher` |
| `APPOINTMENTS_VAPI_TOOL_ENABLED` | `true` | `provision-vapi` |
| `RESEND_API_KEY` | (Existing) API Key for Resend. | `appointment-notifications` |
| `TWILIO_*` | (Existing) Twilio credentials. | `appointment-notifications` |

## 3. Scheduled Cron Job (Reminders)

To enable the appointment reminders dispatcher, run this SQL in your Supabase SQL Editor:

```sql
SELECT cron.schedule(
    'reminders-dispatcher-job',
    '*/10 * * * *', -- Every 10 minutes
    $$
    SELECT net.http_post(
        url := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/reminders-dispatcher',
        headers := jsonb_build_object(
            'x-cron-secret', '<YOUR_CRON_SECRET>'
        )
    ) as request_id;
    $$
);
```

*Replace `<YOUR_PROJECT_REF>` and `<YOUR_CRON_SECRET>` with actual values.*

## 4. Feature Flag

Ensure `APPOINTMENTS_VAPI_TOOL_ENABLED=true` is set in your Edge Functions environment to enable the tool during new assistant provisioning.
