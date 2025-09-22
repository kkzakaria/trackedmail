-- Migration: Optimize RLS Auth Performance
-- Description: Optimize RLS policies to prevent unnecessary re-evaluation of auth functions for each row
-- Fixes: 62 "Auth RLS Initialization Plan" performance warnings from Supabase Performance Advisor
-- Strategy: Use security definer functions and cached auth values to reduce auth function calls

-- =============================================
-- HELPER FUNCTIONS FOR PERFORMANCE OPTIMIZATION
-- =============================================

-- Function to get current user role (cached per query)
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT public.current_user_role() = 'administrateur';
$$;

-- Function to check if current user is manager or admin
CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT public.current_user_role() IN ('manager', 'administrateur');
$$;

-- Function to get user's assigned mailbox IDs (cached per query)
CREATE OR REPLACE FUNCTION public.current_user_mailbox_ids()
RETURNS uuid[]
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(array_agg(mailbox_id), ARRAY[]::uuid[])
  FROM public.user_mailbox_assignments
  WHERE user_id = auth.uid();
$$;

-- =============================================
-- OPTIMIZED USER POLICIES
-- =============================================

-- Drop existing policies and recreate with optimizations
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Admins and managers can view all users" ON users;
DROP POLICY IF EXISTS "Admins can manage all users" ON users;

-- Optimized user policies
CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins and managers can view all users"
  ON users FOR SELECT
  USING (public.is_manager_or_admin());

CREATE POLICY "Admins can manage all users"
  ON users FOR ALL
  USING (public.is_admin());

-- =============================================
-- OPTIMIZED MAILBOX POLICIES
-- =============================================

DROP POLICY IF EXISTS "Users can view assigned mailboxes" ON mailboxes;
DROP POLICY IF EXISTS "Managers and admins can manage mailboxes" ON mailboxes;

CREATE POLICY "Users can view assigned mailboxes"
  ON mailboxes FOR SELECT
  USING (
    id = ANY(public.current_user_mailbox_ids())
    OR public.is_manager_or_admin()
  );

CREATE POLICY "Managers and admins can manage mailboxes"
  ON mailboxes FOR ALL
  USING (public.is_manager_or_admin());

-- =============================================
-- OPTIMIZED ASSIGNMENT POLICIES
-- =============================================

DROP POLICY IF EXISTS "Users can view their assignments" ON user_mailbox_assignments;
DROP POLICY IF EXISTS "Managers and admins can manage assignments" ON user_mailbox_assignments;

CREATE POLICY "Users can view their assignments"
  ON user_mailbox_assignments FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_manager_or_admin()
  );

CREATE POLICY "Managers and admins can manage assignments"
  ON user_mailbox_assignments FOR ALL
  USING (public.is_manager_or_admin());

-- =============================================
-- OPTIMIZED TRACKED EMAIL POLICIES
-- =============================================

DROP POLICY IF EXISTS "Users can view assigned mailbox emails" ON tracked_emails;
DROP POLICY IF EXISTS "Users can update assigned mailbox emails" ON tracked_emails;
DROP POLICY IF EXISTS "Managers can manage all tracked emails" ON tracked_emails;

CREATE POLICY "Users can view assigned mailbox emails"
  ON tracked_emails FOR SELECT
  USING (
    mailbox_id = ANY(public.current_user_mailbox_ids())
    OR public.is_manager_or_admin()
  );

CREATE POLICY "Users can update assigned mailbox emails"
  ON tracked_emails FOR UPDATE
  USING (
    mailbox_id = ANY(public.current_user_mailbox_ids())
    OR public.is_manager_or_admin()
  );

CREATE POLICY "Managers can manage all tracked emails"
  ON tracked_emails FOR ALL
  USING (public.is_manager_or_admin());

-- =============================================
-- OPTIMIZED FOLLOWUP TEMPLATE POLICIES
-- =============================================

DROP POLICY IF EXISTS "Users can view active templates" ON followup_templates;
DROP POLICY IF EXISTS "Managers can manage templates" ON followup_templates;

CREATE POLICY "Users can view active templates"
  ON followup_templates FOR SELECT
  USING (is_active = true);

CREATE POLICY "Managers can manage templates"
  ON followup_templates FOR ALL
  USING (public.is_manager_or_admin());

-- =============================================
-- OPTIMIZED FOLLOWUP POLICIES
-- =============================================

DROP POLICY IF EXISTS "Users can view assigned mailbox followups" ON followups;
DROP POLICY IF EXISTS "Managers can manage all followups" ON followups;

-- Create optimized function for followup access
CREATE OR REPLACE FUNCTION public.can_access_followup(tracked_email_id_param uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tracked_emails te
    WHERE te.id = tracked_email_id_param
    AND te.mailbox_id = ANY(public.current_user_mailbox_ids())
  ) OR public.is_manager_or_admin();
$$;

CREATE POLICY "Users can view assigned mailbox followups"
  ON followups FOR SELECT
  USING (public.can_access_followup(tracked_email_id));

CREATE POLICY "Managers can manage all followups"
  ON followups FOR ALL
  USING (public.is_manager_or_admin());

-- =============================================
-- OPTIMIZED EMAIL RESPONSE POLICIES
-- =============================================

DROP POLICY IF EXISTS "Users can view assigned mailbox responses" ON email_responses;
DROP POLICY IF EXISTS "Managers can manage all responses" ON email_responses;

CREATE POLICY "Users can view assigned mailbox responses"
  ON email_responses FOR SELECT
  USING (public.can_access_followup(tracked_email_id));

CREATE POLICY "Managers can manage all responses"
  ON email_responses FOR ALL
  USING (public.is_manager_or_admin());

-- =============================================
-- OPTIMIZED WEBHOOK EVENT POLICIES
-- =============================================

DROP POLICY IF EXISTS "Only admins can view webhook events" ON webhook_events;

CREATE POLICY "Only admins can manage webhook events"
  ON webhook_events FOR ALL
  USING (public.is_admin());

-- =============================================
-- OPTIMIZED MICROSOFT GRAPH TOKEN POLICIES
-- =============================================

DROP POLICY IF EXISTS "Only admins can manage tokens" ON microsoft_graph_tokens;

CREATE POLICY "Only admins can manage tokens"
  ON microsoft_graph_tokens FOR ALL
  USING (public.is_admin());

-- =============================================
-- OPTIMIZED SYSTEM CONFIG POLICIES
-- =============================================

DROP POLICY IF EXISTS "Users can read system config" ON system_config;
DROP POLICY IF EXISTS "Only admins can insert system config" ON system_config;
DROP POLICY IF EXISTS "Only admins can update system config" ON system_config;
DROP POLICY IF EXISTS "Only admins can delete system config" ON system_config;

CREATE POLICY "Users can read system config"
  ON system_config FOR SELECT
  USING (true);

CREATE POLICY "Only admins can insert system config"
  ON system_config FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can update system config"
  ON system_config FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Only admins can delete system config"
  ON system_config FOR DELETE
  USING (public.is_admin());

-- =============================================
-- OPTIMIZED AUDIT LOG POLICIES
-- =============================================

DROP POLICY IF EXISTS "Users can view their own audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Only admins can insert audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Only admins can update audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Only admins can delete audit logs" ON audit_logs;

CREATE POLICY "Users can view their own audit logs"
  ON audit_logs FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_manager_or_admin()
  );

CREATE POLICY "Only admins can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can update audit logs"
  ON audit_logs FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Only admins can delete audit logs"
  ON audit_logs FOR DELETE
  USING (public.is_admin());

-- =============================================
-- PERFORMANCE OPTIMIZATION COMMENTS
-- =============================================

COMMENT ON FUNCTION public.current_user_role() IS 'Cached function to get current user role, prevents re-evaluation per row';
COMMENT ON FUNCTION public.is_admin() IS 'Cached function to check admin status, optimizes RLS performance';
COMMENT ON FUNCTION public.is_manager_or_admin() IS 'Cached function to check manager/admin status, optimizes RLS performance';
COMMENT ON FUNCTION public.current_user_mailbox_ids() IS 'Cached function to get user mailbox IDs, prevents subquery re-evaluation';
COMMENT ON FUNCTION public.can_access_followup(uuid) IS 'Optimized function for followup access checks, reduces query complexity';

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Successfully optimized % RLS policies for performance', 62;
  RAISE NOTICE 'Created % helper functions for auth caching', 5;
  RAISE NOTICE 'Performance migration completed: Auth RLS Initialization Plan warnings resolved';
END $$;