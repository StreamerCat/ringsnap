-- Remove unique constraint on company_domain
-- Multiple users from same company should be able to sign up for trials

ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_company_domain_key;

-- Verify constraint was removed
SELECT 'company_domain unique constraint removed successfully' as status;
