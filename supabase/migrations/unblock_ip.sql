-- Unblock user IP from rate limiting
DELETE FROM public.signup_attempts
WHERE ip_address = '73.243.211.161';