-- Migration: Fix Final Auth RLS Warnings
-- Description: Optimize the last 2 "Auth RLS Initialization Plan" warnings
-- Fixes: 2 performance warnings (webhook_subscriptions + email_bounces)
-- Strategy: Use cached helper functions instead of direct auth.* calls in RLS policies

-- =====================================================
-- 1. Fix webhook_subscriptions admin policy
-- =====================================================

-- Drop the existing admin policy that uses auth.uid() in EXISTS
DROP POLICY IF EXISTS "Admins read only for debugging" ON webhook_subscriptions;

-- Replace with optimized policy using is_admin() helper
CREATE POLICY "Admins can view all webhook subscriptions"
  ON webhook_subscriptions FOR SELECT
  USING (public.is_admin());

-- =====================================================
-- 2. Create helper function for service role check
-- =====================================================

CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT auth.role() = 'service_role';
$$;

-- =====================================================
-- 3. Fix email_bounces service role policy
-- =====================================================

-- Drop the existing service role UPDATE policy
DROP POLICY IF EXISTS "Service role can update bounces" ON email_bounces;

-- Replace with optimized policy using is_service_role() helper
CREATE POLICY "Service role can update bounces"
  ON email_bounces FOR UPDATE
  USING (public.is_service_role());

-- =====================================================
-- 4. Log migration completion
-- =====================================================

INSERT INTO public.system_config (key, value, description) VALUES (
  'fix_final_auth_rls_warnings',
  jsonb_build_object(
    'migrated_at', now(),
    'version', '1.0',
    'changes', jsonb_build_array(
      'Replaced "Admins read only for debugging" policy on webhook_subscriptions with is_admin() helper',
      'Created is_service_role() helper function for auth.role() caching',
      'Optimized "Service role can update bounces" policy on email_bounces with is_service_role() helper'
    ),
    'warnings_fixed', jsonb_build_object(
      'auth_rls_initialization_plan_webhook_subscriptions', 1,
      'auth_rls_initialization_plan_email_bounces', 1,
      'total', 2
    ),
    'status', 'completed'
  ),
  'Migration to fix the final 2 Auth RLS Initialization Plan warnings'
) ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();
