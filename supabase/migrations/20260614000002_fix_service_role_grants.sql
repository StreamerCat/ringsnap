-- Migration: Fix service_role table grants
-- Purpose: Ensure service_role has ALL privileges on public schema tables.
--          The initial table-creation migrations only granted to 'authenticated'
--          and relied on Supabase default privileges which are not guaranteed
--          in every environment (e.g. fresh CI databases).
-- Date: 2026-06-14

-- Grant ALL on every existing table in public schema to service_role
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Grant ALL on every existing sequence (for serial/identity columns)
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Set default privileges so future tables/sequences also get the grant
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
