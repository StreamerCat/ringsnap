-- =====================================================
-- CLEANUP SCRIPT - Reset Database for Fresh Migration
-- =====================================================
-- Run this ONLY if you want to start the migration fresh
-- This will DROP ALL tables and start over
-- =====================================================

-- WARNING: This will delete ALL data and tables!
-- Only use this for a fresh start.

DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop all tables in public schema
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;

    -- Drop all views
    FOR r IN (SELECT viewname FROM pg_views WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP VIEW IF EXISTS public.' || quote_ident(r.viewname) || ' CASCADE';
    END LOOP;

    -- Drop all sequences
    FOR r IN (SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public') LOOP
        EXECUTE 'DROP SEQUENCE IF EXISTS public.' || quote_ident(r.sequence_name) || ' CASCADE';
    END LOOP;

    -- Drop all functions
    FOR r IN (SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_type = 'FUNCTION') LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS public.' || quote_ident(r.routine_name) || ' CASCADE';
    END LOOP;

    -- Drop custom types (enums)
    FOR r IN (SELECT typname FROM pg_type t
              JOIN pg_namespace n ON t.typnamespace = n.oid
              WHERE n.nspname = 'public' AND t.typtype = 'e') LOOP
        EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
    END LOOP;
END $$;

-- Verify cleanup
SELECT
    'Tables' as object_type,
    COUNT(*) as remaining_count
FROM pg_tables
WHERE schemaname = 'public'
UNION ALL
SELECT
    'Views',
    COUNT(*)
FROM pg_views
WHERE schemaname = 'public'
UNION ALL
SELECT
    'Functions',
    COUNT(*)
FROM information_schema.routines
WHERE routine_schema = 'public';

-- If all counts are 0, you're ready for a fresh migration
