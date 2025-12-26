-- Migration: Add reserved flag to phone numbers
-- Description: Adds is_reserved column to protect specific numbers from pooling or release

ALTER TABLE public.phone_numbers
ADD COLUMN IF NOT EXISTS is_reserved BOOLEAN DEFAULT false;

-- Create index for faster filtering if needed (optional, but good practice given we query on it)
CREATE INDEX IF NOT EXISTS idx_phone_numbers_is_reserved ON public.phone_numbers(is_reserved) WHERE is_reserved = true;
