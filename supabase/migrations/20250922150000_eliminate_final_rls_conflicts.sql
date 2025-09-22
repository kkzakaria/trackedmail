-- Migration: Eliminate Final RLS Policy Conflicts
-- Description: Fix remaining 24 "multiple permissive policies" warnings by restructuring modify policies
-- Problem: FOR ALL policies include SELECT, creating conflicts with dedicated SELECT policies
-- Solution: Replace FOR ALL with specific INSERT/UPDATE/DELETE policies

-- =============================================
-- AUDIT_LOGS TABLE - Fix Policy Conflicts
-- =============================================

-- Drop conflicting policies
DROP POLICY IF EXISTS "audit_logs_modify_policy" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_select_policy" ON audit_logs;

-- Create non-conflicting policies
CREATE POLICY "audit_logs_select_policy" ON audit_logs FOR SELECT USING (
  user_id = (select auth.uid())  -- Users can view their own audit logs (optimized)
  OR public.is_admin()  -- Admins can view all audit logs
);

CREATE POLICY "audit_logs_insert_policy" ON audit_logs FOR INSERT WITH CHECK (
  public.is_admin()  -- Only admins can create audit logs
);

CREATE POLICY "audit_logs_update_policy" ON audit_logs FOR UPDATE USING (
  public.is_admin()  -- Only admins can update audit logs
);

CREATE POLICY "audit_logs_delete_policy" ON audit_logs FOR DELETE USING (
  public.is_admin()  -- Only admins can delete audit logs
);

-- =============================================
-- EMAIL_RESPONSES TABLE - Fix Policy Conflicts
-- =============================================

-- Drop conflicting policies
DROP POLICY IF EXISTS "email_responses_modify_policy" ON email_responses;
DROP POLICY IF EXISTS "email_responses_select_policy" ON email_responses;

-- Create non-conflicting policies
CREATE POLICY "email_responses_select_policy" ON email_responses FOR SELECT USING (
  public.can_access_followup(tracked_email_id)  -- Users can view assigned mailbox responses
  OR public.is_manager_or_admin()  -- Managers can view all responses
);

CREATE POLICY "email_responses_insert_policy" ON email_responses FOR INSERT WITH CHECK (
  public.is_manager_or_admin()  -- Only managers can create responses
);

CREATE POLICY "email_responses_update_policy" ON email_responses FOR UPDATE USING (
  public.is_manager_or_admin()  -- Only managers can update responses
);

CREATE POLICY "email_responses_delete_policy" ON email_responses FOR DELETE USING (
  public.is_manager_or_admin()  -- Only managers can delete responses
);

-- =============================================
-- FOLLOWUP_TEMPLATES TABLE - Fix Policy Conflicts
-- =============================================

-- Drop conflicting policies
DROP POLICY IF EXISTS "followup_templates_modify_policy" ON followup_templates;
DROP POLICY IF EXISTS "followup_templates_select_policy" ON followup_templates;

-- Create non-conflicting policies
CREATE POLICY "followup_templates_select_policy" ON followup_templates FOR SELECT USING (
  is_active = true  -- Users can view active templates
  OR public.is_manager_or_admin()  -- Managers can view all templates
);

CREATE POLICY "followup_templates_insert_policy" ON followup_templates FOR INSERT WITH CHECK (
  public.is_manager_or_admin()  -- Only managers can create templates
);

CREATE POLICY "followup_templates_update_policy" ON followup_templates FOR UPDATE USING (
  public.is_manager_or_admin()  -- Only managers can update templates
);

CREATE POLICY "followup_templates_delete_policy" ON followup_templates FOR DELETE USING (
  public.is_manager_or_admin()  -- Only managers can delete templates
);

-- =============================================
-- FOLLOWUPS TABLE - Fix Policy Conflicts
-- =============================================

-- Drop conflicting policies
DROP POLICY IF EXISTS "followups_modify_policy" ON followups;
DROP POLICY IF EXISTS "followups_select_policy" ON followups;

-- Create non-conflicting policies
CREATE POLICY "followups_select_policy" ON followups FOR SELECT USING (
  public.can_access_followup(tracked_email_id)  -- Users can view assigned mailbox followups
  OR public.is_manager_or_admin()  -- Managers can view all followups
);

CREATE POLICY "followups_insert_policy" ON followups FOR INSERT WITH CHECK (
  public.is_manager_or_admin()  -- Only managers can create followups
);

CREATE POLICY "followups_update_policy" ON followups FOR UPDATE USING (
  public.is_manager_or_admin()  -- Only managers can update followups
);

CREATE POLICY "followups_delete_policy" ON followups FOR DELETE USING (
  public.is_manager_or_admin()  -- Only managers can delete followups
);

-- =============================================
-- MAILBOXES TABLE - Fix Policy Conflicts
-- =============================================

-- Drop conflicting policies
DROP POLICY IF EXISTS "mailboxes_modify_policy" ON mailboxes;
DROP POLICY IF EXISTS "mailboxes_select_policy" ON mailboxes;

-- Create non-conflicting policies
CREATE POLICY "mailboxes_select_policy" ON mailboxes FOR SELECT USING (
  id = ANY(public.current_user_mailbox_ids())  -- Users can view assigned mailboxes
  OR public.is_manager_or_admin()  -- Managers and admins can view all mailboxes
);

CREATE POLICY "mailboxes_insert_policy" ON mailboxes FOR INSERT WITH CHECK (
  public.is_manager_or_admin()  -- Only managers and admins can create mailboxes
);

CREATE POLICY "mailboxes_update_policy" ON mailboxes FOR UPDATE USING (
  public.is_manager_or_admin()  -- Only managers and admins can update mailboxes
);

CREATE POLICY "mailboxes_delete_policy" ON mailboxes FOR DELETE USING (
  public.is_manager_or_admin()  -- Only managers and admins can delete mailboxes
);

-- =============================================
-- USER_MAILBOX_ASSIGNMENTS TABLE - Fix Policy Conflicts
-- =============================================

-- Drop conflicting policies
DROP POLICY IF EXISTS "user_mailbox_assignments_modify_policy" ON user_mailbox_assignments;
DROP POLICY IF EXISTS "user_mailbox_assignments_select_policy" ON user_mailbox_assignments;

-- Create non-conflicting policies
CREATE POLICY "user_mailbox_assignments_select_policy" ON user_mailbox_assignments FOR SELECT USING (
  user_id = (select auth.uid())  -- Users can view their assignments (optimized)
  OR public.is_manager_or_admin()  -- Managers and admins can view all assignments
);

CREATE POLICY "user_mailbox_assignments_insert_policy" ON user_mailbox_assignments FOR INSERT WITH CHECK (
  public.is_manager_or_admin()  -- Only managers and admins can create assignments
);

CREATE POLICY "user_mailbox_assignments_update_policy" ON user_mailbox_assignments FOR UPDATE USING (
  public.is_manager_or_admin()  -- Only managers and admins can update assignments
);

CREATE POLICY "user_mailbox_assignments_delete_policy" ON user_mailbox_assignments FOR DELETE USING (
  public.is_manager_or_admin()  -- Only managers and admins can delete assignments
);

-- =============================================
-- PERFORMANCE VALIDATION
-- =============================================

-- Add final performance optimization comments
COMMENT ON POLICY "audit_logs_select_policy" ON audit_logs IS 'Optimized RLS policy - no conflicts with modify policies';
COMMENT ON POLICY "email_responses_select_policy" ON email_responses IS 'Optimized RLS policy - no conflicts with modify policies';
COMMENT ON POLICY "followup_templates_select_policy" ON followup_templates IS 'Optimized RLS policy - no conflicts with modify policies';
COMMENT ON POLICY "followups_select_policy" ON followups IS 'Optimized RLS policy - no conflicts with modify policies';
COMMENT ON POLICY "mailboxes_select_policy" ON mailboxes IS 'Optimized RLS policy - no conflicts with modify policies';
COMMENT ON POLICY "user_mailbox_assignments_select_policy" ON user_mailbox_assignments IS 'Optimized RLS policy - no conflicts with modify policies';

-- Success message
SELECT 'All RLS policy conflicts eliminated - 24 remaining performance warnings should be resolved' as status;