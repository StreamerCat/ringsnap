-- Data Backfill: Normalize legacy phone numbers to 'assigned' status
-- This ensures they are protected by the new pooling logic and unique indexes.

UPDATE public.phone_numbers
SET 
  lifecycle_status = 'assigned',
  assigned_account_id = account_id,
  assigned_at = COALESCE(created_at, NOW())
WHERE 
  status = 'active' 
  AND lifecycle_status IS NULL 
  AND account_id IS NOT NULL;
