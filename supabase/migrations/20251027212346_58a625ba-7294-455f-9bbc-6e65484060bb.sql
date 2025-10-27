-- Add trade column to trial_signups table
ALTER TABLE public.trial_signups 
ADD COLUMN trade text;