-- Migration: Add missing email and role columns to profiles table
-- Purpose: The create-trial edge function and signup tests reference
--          profiles.email and profiles.role, but neither column was ever
--          added via a committed migration. This causes a 500 error in CI
--          (fresh DB) when create-trial tries to upsert a profile.
-- Date: 2026-06-14

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'customer';
