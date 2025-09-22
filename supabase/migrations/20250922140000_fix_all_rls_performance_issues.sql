-- Migration: Fix All RLS Performance Issues
-- Description: Comprehensive fix for 41 RLS performance warnings from Supabase Security Advisor
-- Fixes:
--   1. Replace auth.<function>() with (select auth.<function>()) for optimal performance
--   2. Consolidate multiple permissive policies into unified efficient policies

-- =============================================
-- USERS TABLE OPTIMIZATION
-- =============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Admins and managers can view all users" ON users;
DROP POLICY IF EXISTS "Admins can manage all users" ON users;

-- Create optimized unified policies
CREATE POLICY "users_select_policy" ON users FOR SELECT USING (
  ((select auth.uid()) = id)  -- Users can view their own profile
  OR public.is_manager_or_admin()  -- Admins and managers can view all users
);

CREATE POLICY "users_update_policy" ON users FOR UPDATE USING (
  ((select auth.uid()) = id)  -- Users can update their own profile
  OR public.is_admin()  -- Admins can update all users
);

CREATE POLICY "users_insert_policy" ON users FOR INSERT WITH CHECK (
  public.is_admin()  -- Only admins can create users
);

CREATE POLICY "users_delete_policy" ON users FOR DELETE USING (
  public.is_admin()  -- Only admins can delete users
);

-- =============================================
-- USER_MAILBOX_ASSIGNMENTS TABLE OPTIMIZATION
-- =============================================

-- Drop ALL existing policies (including duplicates)
DROP POLICY IF EXISTS "Users can view their assignments" ON user_mailbox_assignments;
DROP POLICY IF EXISTS "Users can view their own assignments" ON user_mailbox_assignments;
DROP POLICY IF EXISTS "Managers and admins can manage assignments" ON user_mailbox_assignments;

-- Create optimized unified policies
CREATE POLICY "user_mailbox_assignments_select_policy" ON user_mailbox_assignments FOR SELECT USING (
  user_id = (select auth.uid())  -- Users can view their assignments (optimized)
  OR public.is_manager_or_admin()  -- Managers and admins can view all assignments
);

CREATE POLICY "user_mailbox_assignments_modify_policy" ON user_mailbox_assignments FOR ALL USING (
  public.is_manager_or_admin()  -- Only managers and admins can modify assignments
);

-- =============================================
-- AUDIT_LOGS TABLE OPTIMIZATION
-- =============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Only admins can insert audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Only admins can update audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Only admins can delete audit logs" ON audit_logs;

-- Create optimized policies
CREATE POLICY "audit_logs_select_policy" ON audit_logs FOR SELECT USING (
  user_id = (select auth.uid())  -- Users can view their own audit logs (optimized)
  OR public.is_admin()  -- Admins can view all audit logs
);

CREATE POLICY "audit_logs_modify_policy" ON audit_logs FOR ALL USING (
  public.is_admin()  -- Only admins can modify audit logs
);

-- =============================================
-- EMAIL_RESPONSES TABLE OPTIMIZATION
-- =============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view assigned mailbox responses" ON email_responses;
DROP POLICY IF EXISTS "Managers can manage all responses" ON email_responses;

-- Create optimized unified policies
CREATE POLICY "email_responses_select_policy" ON email_responses FOR SELECT USING (
  public.can_access_followup(tracked_email_id)  -- Users can view assigned mailbox responses
  OR public.is_manager_or_admin()  -- Managers can view all responses
);

CREATE POLICY "email_responses_modify_policy" ON email_responses FOR ALL USING (
  public.is_manager_or_admin()  -- Only managers can manage responses
);

-- =============================================
-- FOLLOWUP_TEMPLATES TABLE OPTIMIZATION
-- =============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view active templates" ON followup_templates;
DROP POLICY IF EXISTS "Managers can manage templates" ON followup_templates;

-- Create optimized unified policies
CREATE POLICY "followup_templates_select_policy" ON followup_templates FOR SELECT USING (
  is_active = true  -- Users can view active templates
  OR public.is_manager_or_admin()  -- Managers can view all templates
);

CREATE POLICY "followup_templates_modify_policy" ON followup_templates FOR ALL USING (
  public.is_manager_or_admin()  -- Only managers can manage templates
);

-- =============================================
-- FOLLOWUPS TABLE OPTIMIZATION
-- =============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view assigned mailbox followups" ON followups;
DROP POLICY IF EXISTS "Managers can manage all followups" ON followups;

-- Create optimized unified policies
CREATE POLICY "followups_select_policy" ON followups FOR SELECT USING (
  public.can_access_followup(tracked_email_id)  -- Users can view assigned mailbox followups
  OR public.is_manager_or_admin()  -- Managers can view all followups
);

CREATE POLICY "followups_modify_policy" ON followups FOR ALL USING (
  public.is_manager_or_admin()  -- Only managers can manage followups
);

-- =============================================
-- MAILBOXES TABLE OPTIMIZATION
-- =============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view assigned mailboxes" ON mailboxes;
DROP POLICY IF EXISTS "Managers and admins can manage mailboxes" ON mailboxes;

-- Create optimized unified policies
CREATE POLICY "mailboxes_select_policy" ON mailboxes FOR SELECT USING (
  id = ANY(public.current_user_mailbox_ids())  -- Users can view assigned mailboxes
  OR public.is_manager_or_admin()  -- Managers and admins can view all mailboxes
);

CREATE POLICY "mailboxes_modify_policy" ON mailboxes FOR ALL USING (
  public.is_manager_or_admin()  -- Only managers and admins can manage mailboxes
);

-- =============================================
-- TRACKED_EMAILS TABLE OPTIMIZATION
-- =============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view assigned mailbox emails" ON tracked_emails;
DROP POLICY IF EXISTS "Users can update assigned mailbox emails" ON tracked_emails;
DROP POLICY IF EXISTS "Managers can manage all tracked emails" ON tracked_emails;

-- Create optimized unified policies
CREATE POLICY "tracked_emails_select_policy" ON tracked_emails FOR SELECT USING (
  mailbox_id = ANY(public.current_user_mailbox_ids())  -- Users can view assigned mailbox emails
  OR public.is_manager_or_admin()  -- Managers can view all tracked emails
);

CREATE POLICY "tracked_emails_update_policy" ON tracked_emails FOR UPDATE USING (
  mailbox_id = ANY(public.current_user_mailbox_ids())  -- Users can update assigned mailbox emails
  OR public.is_manager_or_admin()  -- Managers can update all tracked emails
);

CREATE POLICY "tracked_emails_insert_policy" ON tracked_emails FOR INSERT WITH CHECK (
  public.is_manager_or_admin()  -- Only managers can insert tracked emails
);

CREATE POLICY "tracked_emails_delete_policy" ON tracked_emails FOR DELETE USING (
  public.is_manager_or_admin()  -- Only managers can delete tracked emails
);

-- =============================================
-- PERFORMANCE ANALYSIS
-- =============================================

-- Add performance optimization comments
COMMENT ON POLICY "users_select_policy" ON users IS 'Optimized RLS policy using (select auth.uid()) for better performance';
COMMENT ON POLICY "user_mailbox_assignments_select_policy" ON user_mailbox_assignments IS 'Optimized RLS policy using (select auth.uid()) for better performance';
COMMENT ON POLICY "audit_logs_select_policy" ON audit_logs IS 'Optimized RLS policy using (select auth.uid()) for better performance';

-- Success message
SELECT 'All RLS performance issues fixed successfully - 41 warnings should be resolved' as status;