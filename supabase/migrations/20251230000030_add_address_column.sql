-- Add address column to call_logs table
ALTER TABLE public.call_logs
ADD COLUMN IF NOT EXISTS address text;
-- Add address column to appointments table (if not exists)
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS address text;