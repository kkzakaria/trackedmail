-- Migration: Fix Remaining Function Search Path Security Issues
-- Description: Add secure search_path parameter to functions missed in previous security migration
-- Fixes: 2 remaining "Function Search Path Mutable" security warnings from Supabase Security Advisor

-- Fix for sync_user_to_auth function (was missing from previous migration)
DO $$
BEGIN
  BEGIN
    ALTER FUNCTION public.sync_user_to_auth() SET search_path = '';
    RAISE NOTICE 'Successfully secured search_path for sync_user_to_auth()';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'Function sync_user_to_auth() does not exist, skipping';
  END;
END $$;

-- Re-apply fix for cleanup_old_deleted_users function (ensure it's properly configured)
DO $$
BEGIN
  BEGIN
    ALTER FUNCTION public.cleanup_old_deleted_users() SET search_path = '';
    RAISE NOTICE 'Successfully secured search_path for cleanup_old_deleted_users()';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'Function cleanup_old_deleted_users() does not exist, skipping';
  END;
END $$;

-- Add security comments
COMMENT ON FUNCTION public.sync_user_to_auth IS 'Trigger function that syncs changes from public.users back to auth.users metadata (search_path secured)';
COMMENT ON FUNCTION public.cleanup_old_deleted_users IS 'Permanently removes users soft deleted longer than specified days (search_path secured)';

-- Success message
SELECT 'Remaining function search_path security issues fixed successfully' as status;