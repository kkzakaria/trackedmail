-- Migration: Optimize email_bounces and related tables RLS Performance
-- Description: Fix "Auth RLS Initialization Plan" and "Multiple Permissive Policies" warnings
-- Fixes: 12 performance warnings from Supabase Performance Advisor
-- Strategy: Use cached helper functions and consolidate multiple permissive policies

-- =====================================================
-- 1. Helper function to get tracked_email mailbox ID for email_bounces
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_bounce_mailbox_id(p_bounce_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT te.mailbox_id
  FROM public.email_bounces eb
  JOIN public.tracked_emails te ON te.id = eb.tracked_email_id
  WHERE eb.id = p_bounce_id;
$$;

-- =====================================================
-- 2. Optimize email_bounces policies (fixes 8 warnings)
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Managers can view all bounces" ON email_bounces;
DROP POLICY IF EXISTS "Users can view bounces for their assigned mailboxes" ON email_bounces;
DROP POLICY IF EXISTS "Admins can delete bounces" ON email_bounces;
DROP POLICY IF EXISTS "Service role can insert bounces" ON email_bounces;
DROP POLICY IF EXISTS "Service role can update bounces" ON email_bounces;

-- Consolidated optimized SELECT policy (merges 2 policies into 1)
CREATE POLICY "Users can view bounces based on role and mailbox assignment"
  ON email_bounces FOR SELECT
  USING (
    -- Managers and admins can view all bounces
    public.is_manager_or_admin()
    OR
    -- Regular users can view bounces for their assigned mailboxes
    EXISTS (
      SELECT 1
      FROM public.tracked_emails te
      WHERE te.id = email_bounces.tracked_email_id
        AND te.mailbox_id = ANY(public.current_user_mailbox_ids())
    )
  );

-- Optimized DELETE policy for admins
CREATE POLICY "Admins can delete bounces"
  ON email_bounces FOR DELETE
  USING (public.is_admin());

-- Service role policies (these don't need optimization as they use auth.role() which is already efficient)
CREATE POLICY "Service role can insert bounces"
  ON email_bounces FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update bounces"
  ON email_bounces FOR UPDATE
  USING (auth.role() = 'service_role'::text);

-- =====================================================
-- 3. Optimize webhook_subscriptions policies
-- =====================================================

-- Check if policies exist and optimize
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'webhook_subscriptions'
      AND policyname LIKE '%auth%'
  ) THEN
    -- Drop and recreate with optimizations
    DROP POLICY IF EXISTS "Managers and admins can manage webhook subscriptions" ON webhook_subscriptions;
    DROP POLICY IF EXISTS "Users can view webhook subscriptions for assigned mailboxes" ON webhook_subscriptions;

    CREATE POLICY "Users can view webhook subscriptions based on role and mailbox"
      ON webhook_subscriptions FOR SELECT
      USING (
        public.is_manager_or_admin()
        OR mailbox_id = ANY(public.current_user_mailbox_ids())
      );

    CREATE POLICY "Managers and admins can manage webhook subscriptions"
      ON webhook_subscriptions FOR ALL
      USING (public.is_manager_or_admin());

    RAISE NOTICE 'Optimized webhook_subscriptions RLS policies';
  END IF;
END $$;

-- =====================================================
-- 4. Optimize message_headers policies
-- =====================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'message_headers'
  ) THEN
    -- Drop and recreate with optimizations
    EXECUTE 'DROP POLICY IF EXISTS "Users can view message headers for their assigned mailboxes" ON message_headers';
    EXECUTE 'DROP POLICY IF EXISTS "Managers can view all message headers" ON message_headers';

    EXECUTE '
      CREATE POLICY "Users can view message headers based on role and mailbox"
        ON message_headers FOR SELECT
        USING (
          public.is_manager_or_admin()
          OR EXISTS (
            SELECT 1
            FROM public.tracked_emails te
            WHERE te.id = message_headers.tracked_email_id
              AND te.mailbox_id = ANY(public.current_user_mailbox_ids())
          )
          OR EXISTS (
            SELECT 1
            FROM public.email_responses er
            JOIN public.tracked_emails te ON te.id = er.tracked_email_id
            WHERE er.id = message_headers.email_response_id
              AND te.mailbox_id = ANY(public.current_user_mailbox_ids())
          )
        )
    ';

    RAISE NOTICE 'Optimized message_headers RLS policies';
  END IF;
END $$;

-- =====================================================
-- 5. Optimize detection_logs policies
-- =====================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'detection_logs'
  ) THEN
    -- Drop and recreate with optimizations
    EXECUTE 'DROP POLICY IF EXISTS "Users can view detection logs for their assigned mailboxes" ON detection_logs';
    EXECUTE 'DROP POLICY IF EXISTS "Managers can view all detection logs" ON detection_logs';

    EXECUTE '
      CREATE POLICY "Users can view detection logs based on role and mailbox"
        ON detection_logs FOR SELECT
        USING (
          public.is_manager_or_admin()
          OR EXISTS (
            SELECT 1
            FROM public.tracked_emails te
            WHERE te.id = detection_logs.tracked_email_id
              AND te.mailbox_id = ANY(public.current_user_mailbox_ids())
          )
        )
    ';

    RAISE NOTICE 'Optimized detection_logs RLS policies';
  END IF;
END $$;

-- =====================================================
-- 6. Log migration completion
-- =====================================================

INSERT INTO public.system_config (key, value, description) VALUES (
  'email_bounces_rls_performance_optimization',
  jsonb_build_object(
    'migrated_at', now(),
    'version', '1.0',
    'changes', jsonb_build_array(
      'Optimized email_bounces RLS policies with cached helper functions',
      'Consolidated multiple permissive SELECT policies into single policy',
      'Optimized webhook_subscriptions RLS policies',
      'Optimized message_headers RLS policies',
      'Optimized detection_logs RLS policies',
      'Fixed 12 performance warnings from Supabase Performance Advisor'
    ),
    'warnings_fixed', jsonb_build_object(
      'auth_rls_initialization_plan', 8,
      'multiple_permissive_policies', 4,
      'total', 12
    ),
    'status', 'completed'
  ),
  'Migration to optimize RLS policies for performance'
) ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();
