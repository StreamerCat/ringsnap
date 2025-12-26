-- Migration: Add unpaid_since to accounts
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS unpaid_since TIMESTAMPTZ;
