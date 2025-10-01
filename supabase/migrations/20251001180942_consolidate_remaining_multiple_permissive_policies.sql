-- Migration: Consolidate Multiple Permissive Policies
-- Description: Remove redundant "Admins read only" policies to eliminate "Multiple Permissive Policies" warnings
-- Fixes: 8 performance warnings (4 on detection_logs + 4 on message_headers)
-- Strategy: The "Users can view... based on role and mailbox" policies already use is_manager_or_admin()
--           which covers administrators, making separate admin-only policies redundant

-- =====================================================
-- 1. Remove redundant admin policies on detection_logs
-- =====================================================

DROP POLICY IF EXISTS "Admins read only for debugging" ON detection_logs;

-- The existing "Users can view detection logs based on role and mailbox" policy
-- already handles admins via is_manager_or_admin(), so no replacement needed

-- =====================================================
-- 2. Remove redundant admin policies on message_headers
-- =====================================================

DROP POLICY IF EXISTS "Admins read only for debugging" ON message_headers;

-- The existing "Users can view message headers based on role and mailbox" policy
-- already handles admins via is_manager_or_admin(), so no replacement needed

-- =====================================================
-- 3. Log migration completion
-- =====================================================

INSERT INTO public.system_config (key, value, description) VALUES (
  'consolidate_multiple_permissive_policies',
  jsonb_build_object(
    'migrated_at', now(),
    'version', '1.0',
    'changes', jsonb_build_array(
      'Removed redundant "Admins read only for debugging" policy on detection_logs',
      'Removed redundant "Admins read only for debugging" policy on message_headers',
      'Existing user policies already cover admin access via is_manager_or_admin()'
    ),
    'warnings_fixed', jsonb_build_object(
      'multiple_permissive_policies_detection_logs', 4,
      'multiple_permissive_policies_message_headers', 4,
      'total', 8
    ),
    'status', 'completed'
  ),
  'Migration to consolidate multiple permissive RLS policies'
) ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();
