-- Migration: Optimize RLS Policies with (SELECT auth.uid()) Pattern
-- Description: Replace direct auth.uid() calls with SELECT wrapper to enable query caching
-- Fixes: Supabase advisor warning 0003_auth_rls_initplan (10 policies affected)

BEGIN;

-- =====================================================
-- 1. WEBHOOK_SUBSCRIPTIONS - Optimize admin policy
-- =====================================================

DROP POLICY IF EXISTS "Admins read only for debugging" ON public.webhook_subscriptions;

CREATE POLICY "Admins read only for debugging"
  ON public.webhook_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid())
      AND role = 'administrateur'
    )
  );

COMMENT ON POLICY "Admins read only for debugging" ON webhook_subscriptions IS
  'Optimized admin read-only policy using (SELECT auth.uid()) for better performance';

-- =====================================================
-- 2. MESSAGE_HEADERS - Optimize admin policy
-- =====================================================

DROP POLICY IF EXISTS "Admins read only for debugging" ON public.message_headers;

CREATE POLICY "Admins read only for debugging"
  ON public.message_headers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid())
      AND role = 'administrateur'
    )
  );

COMMENT ON POLICY "Admins read only for debugging" ON message_headers IS
  'Optimized admin read-only policy using (SELECT auth.uid()) for better performance';

-- =====================================================
-- 3. DETECTION_LOGS - Optimize admin policy
-- =====================================================

DROP POLICY IF EXISTS "Admins read only for debugging" ON public.detection_logs;

CREATE POLICY "Admins read only for debugging"
  ON public.detection_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid())
      AND role = 'administrateur'
    )
  );

COMMENT ON POLICY "Admins read only for debugging" ON detection_logs IS
  'Optimized admin read-only policy using (SELECT auth.uid()) for better performance';

-- =====================================================
-- 4. EMAIL_BOUNCES - Optimize 4 policies
-- =====================================================

-- 4.1. Users can view bounces for their assigned mailboxes
DROP POLICY IF EXISTS "Users can view bounces for their assigned mailboxes" ON public.email_bounces;

CREATE POLICY "Users can view bounces for their assigned mailboxes"
  ON public.email_bounces
  FOR SELECT
  TO authenticated
  USING (
    tracked_email_id IN (
      SELECT te.id
      FROM public.tracked_emails te
      JOIN public.mailboxes m ON te.mailbox_id = m.id
      JOIN public.user_mailbox_assignments uma ON m.id = uma.mailbox_id
      WHERE uma.user_id = (SELECT auth.uid())
    )
  );

COMMENT ON POLICY "Users can view bounces for their assigned mailboxes" ON email_bounces IS
  'Optimized user view policy using (SELECT auth.uid()) with restructured query for better performance';

-- 4.2. Managers can view all bounces
DROP POLICY IF EXISTS "Managers can view all bounces" ON public.email_bounces;

CREATE POLICY "Managers can view all bounces"
  ON public.email_bounces
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid())
      AND role IN ('administrateur', 'manager')
    )
  );

COMMENT ON POLICY "Managers can view all bounces" ON email_bounces IS
  'Optimized manager view policy using (SELECT auth.uid()) for better performance';

-- 4.3. Service role can insert bounces
DROP POLICY IF EXISTS "Service role can insert bounces" ON public.email_bounces;

CREATE POLICY "Service role can insert bounces"
  ON public.email_bounces
  FOR INSERT
  TO service_role
  WITH CHECK (
    (SELECT auth.role()) = 'service_role'
  );

COMMENT ON POLICY "Service role can insert bounces" ON email_bounces IS
  'Optimized service role insert policy using (SELECT auth.role()) for better performance';

-- 4.4. Service role can update bounces
DROP POLICY IF EXISTS "Service role can update bounces" ON public.email_bounces;

CREATE POLICY "Service role can update bounces"
  ON public.email_bounces
  FOR UPDATE
  TO service_role
  USING (
    (SELECT auth.role()) = 'service_role'
  );

COMMENT ON POLICY "Service role can update bounces" ON email_bounces IS
  'Optimized service role update policy using (SELECT auth.role()) for better performance';

-- 4.5. Admins can delete bounces
DROP POLICY IF EXISTS "Admins can delete bounces" ON public.email_bounces;

CREATE POLICY "Admins can delete bounces"
  ON public.email_bounces
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid())
      AND role = 'administrateur'
    )
  );

COMMENT ON POLICY "Admins can delete bounces" ON email_bounces IS
  'Optimized admin delete policy using (SELECT auth.uid()) for better performance';

-- =====================================================
-- 5. ARCHIVED_TRACKED_EMAILS - Optimize user policy
-- =====================================================
-- Note: This table may not exist yet in all environments

DO $$
BEGIN
  -- Check if table exists before modifying policies
  IF EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'archived_tracked_emails'
  ) THEN
    -- Drop existing policy
    DROP POLICY IF EXISTS "Users can view their archived emails" ON public.archived_tracked_emails;

    -- Create optimized policy
    CREATE POLICY "Users can view their archived emails"
      ON public.archived_tracked_emails
      FOR SELECT
      TO authenticated
      USING (
        mailbox_id IN (
          SELECT m.id
          FROM public.mailboxes m
          JOIN public.user_mailbox_assignments uma ON uma.mailbox_id = m.id
          WHERE uma.user_id = (SELECT auth.uid())
        )
      );

    -- Add comment
    EXECUTE 'COMMENT ON POLICY "Users can view their archived emails" ON archived_tracked_emails IS ''Optimized user view policy using (SELECT auth.uid()) with restructured query for better performance''';

    RAISE NOTICE 'Successfully optimized archived_tracked_emails policies';
  ELSE
    RAISE NOTICE 'Table archived_tracked_emails does not exist yet, skipping policy optimization';
  END IF;
END $$;

COMMIT;
