-- Move HTTP extensions from public schema to secure schemas
-- This resolves production security warnings about extensions in public schema

-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Create net schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS net;

-- Move http extension from public to extensions schema (if it exists in public)
DO $$
BEGIN
    -- Check if http extension exists in public schema
    IF EXISTS (
        SELECT 1 FROM pg_extension e
        JOIN pg_namespace n ON e.extnamespace = n.oid
        WHERE e.extname = 'http' AND n.nspname = 'public'
    ) THEN
        -- Move http extension to extensions schema
        ALTER EXTENSION http SET SCHEMA extensions;
        RAISE NOTICE 'Moved http extension from public to extensions schema';
    ELSE
        RAISE NOTICE 'http extension not found in public schema or already moved';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not move http extension: %', SQLERRM;
END $$;

-- Move pg_net extension from public to extensions schema (if it exists in public)
DO $$
BEGIN
    -- Check if pg_net extension exists in public schema
    IF EXISTS (
        SELECT 1 FROM pg_extension e
        JOIN pg_namespace n ON e.extnamespace = n.oid
        WHERE e.extname = 'pg_net' AND n.nspname = 'public'
    ) THEN
        -- Move pg_net extension to extensions schema
        ALTER EXTENSION pg_net SET SCHEMA extensions;
        RAISE NOTICE 'Moved pg_net extension from public to extensions schema';
    ELSE
        RAISE NOTICE 'pg_net extension not found in public schema or already moved';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not move pg_net extension: %', SQLERRM;
END $$;

-- Grant necessary permissions to service_role for the extensions schema
GRANT USAGE ON SCHEMA extensions TO service_role;
GRANT USAGE ON SCHEMA net TO service_role;

-- Grant execute permissions on http functions to service_role
DO $$
BEGIN
    -- Grant execute on all functions in extensions schema
    EXECUTE format('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO service_role');

    -- Grant execute on all functions in net schema
    EXECUTE format('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA net TO service_role');

    RAISE NOTICE 'Granted function execute permissions to service_role';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error granting permissions: %', SQLERRM;
END $$;

-- Ensure extensions schema is in search_path for service_role
-- This will be handled by Supabase configuration, but we document it here
-- ALTER ROLE service_role SET search_path = extensions, net, public;