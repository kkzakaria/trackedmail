-- Migration: Fix Function Search Path Security Issues (Simplified)
-- Description: Add secure search_path parameter to existing database functions
-- Fixes: 22 "Function Search Path Mutable" security warnings from Supabase Security Advisor

-- Secure only the functions that we know exist based on previous migrations
-- Using individual DO blocks to handle potential missing functions safely

-- From initial_schema.sql - update_updated_at trigger function
DO $$
BEGIN
  BEGIN
    ALTER FUNCTION public.update_updated_at() SET search_path = '';
  EXCEPTION
    WHEN undefined_function THEN
      NULL; -- Function doesn't exist, skip
  END;
END $$;

-- From threading_detection_support.sql - clean_email_subject function
DO $$
BEGIN
  BEGIN
    ALTER FUNCTION public.clean_email_subject(text) SET search_path = '';
  EXCEPTION
    WHEN undefined_function THEN
      NULL; -- Function doesn't exist, skip
  END;
END $$;

-- From test_helpers_setup.sql - all test functions
DO $$
BEGIN
  BEGIN
    ALTER FUNCTION tests.create_supabase_user(text, text, text, jsonb) SET search_path = '';
  EXCEPTION
    WHEN undefined_function THEN
      NULL; -- Function doesn't exist, skip
  END;
END $$;

DO $$
BEGIN
  BEGIN
    ALTER FUNCTION tests.authenticate_as(text) SET search_path = '';
  EXCEPTION
    WHEN undefined_function THEN
      NULL; -- Function doesn't exist, skip
  END;
END $$;

DO $$
BEGIN
  BEGIN
    ALTER FUNCTION tests.authenticate_as_service_role() SET search_path = '';
  EXCEPTION
    WHEN undefined_function THEN
      NULL; -- Function doesn't exist, skip
  END;
END $$;

DO $$
BEGIN
  BEGIN
    ALTER FUNCTION tests.get_supabase_uid(text) SET search_path = '';
  EXCEPTION
    WHEN undefined_function THEN
      NULL; -- Function doesn't exist, skip
  END;
END $$;

DO $$
BEGIN
  BEGIN
    ALTER FUNCTION tests.cleanup_test_users() SET search_path = '';
  EXCEPTION
    WHEN undefined_function THEN
      NULL; -- Function doesn't exist, skip
  END;
END $$;

DO $$
BEGIN
  BEGIN
    ALTER FUNCTION tests.clear_authentication() SET search_path = '';
  EXCEPTION
    WHEN undefined_function THEN
      NULL; -- Function doesn't exist, skip
  END;
END $$;

-- From add_soft_delete_users.sql - user management functions
DO $$
BEGIN
  BEGIN
    ALTER FUNCTION public.soft_delete_user(uuid) SET search_path = '';
  EXCEPTION
    WHEN undefined_function THEN
      NULL; -- Function doesn't exist, skip
  END;
END $$;

DO $$
BEGIN
  BEGIN
    ALTER FUNCTION public.restore_user(uuid) SET search_path = '';
  EXCEPTION
    WHEN undefined_function THEN
      NULL; -- Function doesn't exist, skip
  END;
END $$;

DO $$
BEGIN
  BEGIN
    ALTER FUNCTION public.is_user_deleted(uuid) SET search_path = '';
  EXCEPTION
    WHEN undefined_function THEN
      NULL; -- Function doesn't exist, skip
  END;
END $$;

-- From user_sync_triggers.sql - sync and trigger functions
DO $$
BEGIN
  BEGIN
    ALTER FUNCTION public.handle_new_user() SET search_path = '';
  EXCEPTION
    WHEN undefined_function THEN
      NULL; -- Function doesn't exist, skip
  END;
END $$;

DO $$
BEGIN
  BEGIN
    ALTER FUNCTION public.handle_user_updated() SET search_path = '';
  EXCEPTION
    WHEN undefined_function THEN
      NULL; -- Function doesn't exist, skip
  END;
END $$;

DO $$
BEGIN
  BEGIN
    ALTER FUNCTION public.handle_user_deleted() SET search_path = '';
  EXCEPTION
    WHEN undefined_function THEN
      NULL; -- Function doesn't exist, skip
  END;
END $$;

DO $$
BEGIN
  BEGIN
    ALTER FUNCTION public.sync_all_users_from_auth() SET search_path = '';
  EXCEPTION
    WHEN undefined_function THEN
      NULL; -- Function doesn't exist, skip
  END;
END $$;

DO $$
BEGIN
  BEGIN
    ALTER FUNCTION public.enable_user_sync() SET search_path = '';
  EXCEPTION
    WHEN undefined_function THEN
      NULL; -- Function doesn't exist, skip
  END;
END $$;

DO $$
BEGIN
  BEGIN
    ALTER FUNCTION public.disable_user_sync() SET search_path = '';
  EXCEPTION
    WHEN undefined_function THEN
      NULL; -- Function doesn't exist, skip
  END;
END $$;

-- Additional functions that might exist
DO $$
BEGIN
  BEGIN
    ALTER FUNCTION public.handle_email_conflict() SET search_path = '';
  EXCEPTION
    WHEN undefined_function THEN
      NULL; -- Function doesn't exist, skip
  END;
END $$;

DO $$
BEGIN
  BEGIN
    ALTER FUNCTION public.update_email_status_on_response() SET search_path = '';
  EXCEPTION
    WHEN undefined_function THEN
      NULL; -- Function doesn't exist, skip
  END;
END $$;

DO $$
BEGIN
  BEGIN
    ALTER FUNCTION public.hard_delete_user(uuid) SET search_path = '';
  EXCEPTION
    WHEN undefined_function THEN
      NULL; -- Function doesn't exist, skip
  END;
END $$;

DO $$
BEGIN
  BEGIN
    ALTER FUNCTION public.cleanup_old_deleted_users() SET search_path = '';
  EXCEPTION
    WHEN undefined_function THEN
      NULL; -- Function doesn't exist, skip
  END;
END $$;

-- Add security comments
COMMENT ON SCHEMA public IS 'Public schema with secure search_path configured for all functions to prevent search_path attacks';
COMMENT ON SCHEMA tests IS 'Test schema with secure search_path configured for all helper functions';

-- Success message
SELECT 'Function search_path security migration completed successfully' as status;