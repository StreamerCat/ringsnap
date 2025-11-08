-- Clear rate limit for testing
-- Run this in Supabase SQL Editor

-- Option 1: Clear ALL signup attempts (WARNING: This clears all data)
-- TRUNCATE TABLE signup_attempts;

-- Option 2: Find and delete specific IP's attempts
-- First, find your IP address:
SELECT
  ip_address,
  COUNT(*) as attempts,
  MAX(created_at) as last_attempt,
  array_agg(email ORDER BY created_at DESC) as emails
FROM signup_attempts
WHERE success = true
GROUP BY ip_address
ORDER BY last_attempt DESC
LIMIT 10;

-- Then delete attempts for a specific IP (replace 'YOUR_IP_HERE' with your actual IP from above):
-- DELETE FROM signup_attempts
-- WHERE ip_address = 'YOUR_IP_HERE';

-- Option 3: Delete specific email's attempts
-- DELETE FROM signup_attempts
-- WHERE email = 'your.email@example.com';

-- Option 4: Temporarily disable rate limiting by increasing the limit
-- This updates the edge function logic to allow more trials
-- (You would need to edit the edge function code directly)
