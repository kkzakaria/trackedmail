-- Fix extension schema security warnings by recreating extensions in correct schemas
-- Following Supabase best practices as shown in the documentation
-- https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/ai/automatic-embeddings.mdx

-- =============================================
-- CREATE SECURE SCHEMAS
-- =============================================

-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- =============================================
-- RECREATE PG_NET IN EXTENSIONS SCHEMA
-- =============================================

-- Note: This approach follows Supabase best practices by recreating the extension
-- in the correct schema rather than trying to move it (which requires superuser permissions)

DO $$
BEGIN
    -- Check if pg_net exists in public schema
    IF EXISTS (
        SELECT 1 FROM pg_extension e
        JOIN pg_namespace n ON e.extnamespace = n.oid
        WHERE e.extname = 'pg_net' AND n.nspname = 'public'
    ) THEN
        -- Drop the extension from public schema
        DROP EXTENSION IF EXISTS pg_net CASCADE;
        RAISE NOTICE 'Dropped pg_net extension from public schema';

        -- Recreate in extensions schema
        CREATE EXTENSION pg_net WITH SCHEMA extensions;
        RAISE NOTICE 'Recreated pg_net extension in extensions schema';
    ELSE
        -- If not in public, check if already in extensions
        IF NOT EXISTS (
            SELECT 1 FROM pg_extension e
            JOIN pg_namespace n ON e.extnamespace = n.oid
            WHERE e.extname = 'pg_net' AND n.nspname = 'extensions'
        ) THEN
            -- Create in extensions schema
            CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
            RAISE NOTICE 'Created pg_net extension in extensions schema';
        ELSE
            RAISE NOTICE 'pg_net extension already exists in extensions schema';
        END IF;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error handling pg_net extension: %', SQLERRM;
END $$;

-- =============================================
-- RECREATE HTTP EXTENSION IN EXTENSIONS SCHEMA
-- =============================================

-- Note: Apply same approach as pg_net - recreate in correct schema
DO $$
BEGIN
    -- Check if http extension exists in public schema
    IF EXISTS (
        SELECT 1 FROM pg_extension e
        JOIN pg_namespace n ON e.extnamespace = n.oid
        WHERE e.extname = 'http' AND n.nspname = 'public'
    ) THEN
        -- Drop the extension from public schema
        DROP EXTENSION IF EXISTS http CASCADE;
        RAISE NOTICE 'Dropped http extension from public schema';

        -- Recreate in extensions schema
        CREATE EXTENSION http WITH SCHEMA extensions;
        RAISE NOTICE 'Recreated http extension in extensions schema';
    ELSE
        -- If not in public, check if already in extensions
        IF NOT EXISTS (
            SELECT 1 FROM pg_extension e
            JOIN pg_namespace n ON e.extnamespace = n.oid
            WHERE e.extname = 'http' AND n.nspname = 'extensions'
        ) THEN
            -- Create in extensions schema if it doesn't exist anywhere
            CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;
            RAISE NOTICE 'Created http extension in extensions schema';
        ELSE
            RAISE NOTICE 'http extension already exists in extensions schema';
        END IF;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error handling http extension: %', SQLERRM;
END $$;

-- =============================================
-- GRANT PERMISSIONS TO SERVICE_ROLE
-- =============================================

-- Grant necessary permissions to service_role for the extensions schema
GRANT USAGE ON SCHEMA extensions TO service_role;

-- Grant execute permissions on all functions in extensions schema
DO $$
BEGIN
    -- Grant execute on all functions in extensions schema
    EXECUTE format('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO service_role');

    RAISE NOTICE 'Granted function execute permissions to service_role for extensions schema';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error granting permissions: %', SQLERRM;
END $$;

-- =============================================
-- VERIFY EXTENSION LOCATIONS
-- =============================================

-- Display final extension locations for verification
DO $$
DECLARE
    rec RECORD;
BEGIN
    RAISE NOTICE 'Extension locations after migration:';
    FOR rec IN
        SELECT e.extname, n.nspname as schema_name
        FROM pg_extension e
        JOIN pg_namespace n ON e.extnamespace = n.oid
        WHERE e.extname IN ('pg_net', 'http')
        ORDER BY e.extname
    LOOP
        RAISE NOTICE '  Extension "%" is in schema "%"', rec.extname, rec.schema_name;
    END LOOP;
END $$;