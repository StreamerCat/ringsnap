-- Migration: Add primary_goal column for AI assistant behavior configuration
-- Used in self-serve flow for progressive onboarding

-- Add primary_goal column to accounts
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS primary_goal TEXT
    CHECK (primary_goal IN ('book_appointments', 'capture_leads', 'answer_questions', 'take_orders'));

-- Add index for analytics (optional, but useful for reporting)
CREATE INDEX IF NOT EXISTS idx_accounts_primary_goal
  ON public.accounts(primary_goal)
  WHERE primary_goal IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.accounts.primary_goal IS 'Primary business goal for AI assistant behavior: book_appointments (schedule services), capture_leads (collect contact info), answer_questions (provide information), take_orders (process sales)';
