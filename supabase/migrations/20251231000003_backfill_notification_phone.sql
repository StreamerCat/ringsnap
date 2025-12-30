-- Migration: Backfill Notification Phone Numbers
-- Description: Populate notification_sms_phone from the primary profile phone for each account.
-- Purpose: Ensure existing accounts have a valid destination for SMS notifications immediately.
DO $$
DECLARE updated_count INTEGER;
BEGIN WITH primary_phones AS (
    SELECT DISTINCT ON (account_id) account_id,
        phone
    FROM public.profiles
    WHERE is_primary = true
        OR (
            source = 'signup'
            AND phone IS NOT NULL
        ) -- Fallback if is_primary not set cleanly
    ORDER BY account_id,
        is_primary DESC,
        created_at ASC
)
UPDATE public.accounts a
SET notification_sms_phone = pp.phone
FROM primary_phones pp
WHERE a.id = pp.account_id
    AND a.notification_sms_phone IS NULL;
-- Only update if currently empty
GET DIAGNOSTICS updated_count = ROW_COUNT;
RAISE NOTICE 'Backfilled % accounts with notification phone number',
updated_count;
END $$;