-- Row Level Security (RLS) policies for TrackedMail application

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE mailboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_mailbox_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracked_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE followup_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE microsoft_graph_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- USER POLICIES
-- =============================================

-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- Admins and managers can view all users
CREATE POLICY "Admins and managers can view all users"
  ON users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('administrateur', 'manager')
    )
  );

-- Admins can manage all users
CREATE POLICY "Admins can manage all users"
  ON users FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role = 'administrateur'
    )
  );

-- =============================================
-- MAILBOX POLICIES
-- =============================================

-- Users can view their assigned mailboxes
CREATE POLICY "Users can view assigned mailboxes"
  ON mailboxes FOR SELECT
  USING (
    id IN (
      SELECT mailbox_id FROM user_mailbox_assignments
      WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('manager', 'administrateur')
    )
  );

-- Managers and admins can manage mailboxes
CREATE POLICY "Managers and admins can manage mailboxes"
  ON mailboxes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('manager', 'administrateur')
    )
  );

-- =============================================
-- ASSIGNMENT POLICIES
-- =============================================

-- Users can view their own assignments
CREATE POLICY "Users can view their assignments"
  ON user_mailbox_assignments FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('manager', 'administrateur')
    )
  );

-- Managers and admins can manage assignments
CREATE POLICY "Managers and admins can manage assignments"
  ON user_mailbox_assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('manager', 'administrateur')
    )
  );

-- =============================================
-- TRACKED EMAIL POLICIES
-- =============================================

-- Users can view emails from their assigned mailboxes
CREATE POLICY "Users can view assigned mailbox emails"
  ON tracked_emails FOR SELECT
  USING (
    mailbox_id IN (
      SELECT mailbox_id FROM user_mailbox_assignments
      WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('manager', 'administrateur')
    )
  );

-- Users can update emails from their assigned mailboxes (for manual stop)
CREATE POLICY "Users can update assigned mailbox emails"
  ON tracked_emails FOR UPDATE
  USING (
    mailbox_id IN (
      SELECT mailbox_id FROM user_mailbox_assignments
      WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('manager', 'administrateur')
    )
  );

-- Managers and admins can do everything with tracked emails
CREATE POLICY "Managers can manage all tracked emails"
  ON tracked_emails FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('manager', 'administrateur')
    )
  );

-- =============================================
-- FOLLOWUP TEMPLATE POLICIES
-- =============================================

-- Everyone can view active templates
CREATE POLICY "Users can view active templates"
  ON followup_templates FOR SELECT
  USING (is_active = true);

-- Managers and admins can manage templates
CREATE POLICY "Managers can manage templates"
  ON followup_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('manager', 'administrateur')
    )
  );

-- =============================================
-- FOLLOWUP POLICIES
-- =============================================

-- Users can view followups for their assigned mailboxes
CREATE POLICY "Users can view assigned mailbox followups"
  ON followups FOR SELECT
  USING (
    tracked_email_id IN (
      SELECT te.id FROM tracked_emails te
      JOIN user_mailbox_assignments uma ON uma.mailbox_id = te.mailbox_id
      WHERE uma.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('manager', 'administrateur')
    )
  );

-- Managers and admins can manage all followups
CREATE POLICY "Managers can manage all followups"
  ON followups FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('manager', 'administrateur')
    )
  );

-- =============================================
-- EMAIL RESPONSE POLICIES
-- =============================================

-- Users can view responses for their assigned mailboxes
CREATE POLICY "Users can view assigned mailbox responses"
  ON email_responses FOR SELECT
  USING (
    tracked_email_id IN (
      SELECT te.id FROM tracked_emails te
      JOIN user_mailbox_assignments uma ON uma.mailbox_id = te.mailbox_id
      WHERE uma.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('manager', 'administrateur')
    )
  );

-- Managers and admins can manage all responses
CREATE POLICY "Managers can manage all responses"
  ON email_responses FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('manager', 'administrateur')
    )
  );

-- =============================================
-- WEBHOOK EVENT POLICIES
-- =============================================

-- Only admins can view webhook events
CREATE POLICY "Only admins can view webhook events"
  ON webhook_events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role = 'administrateur'
    )
  );

-- =============================================
-- MICROSOFT GRAPH TOKEN POLICIES
-- =============================================

-- Only admins can manage Microsoft Graph tokens
CREATE POLICY "Only admins can manage tokens"
  ON microsoft_graph_tokens FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role = 'administrateur'
    )
  );

-- =============================================
-- SYSTEM CONFIG POLICIES
-- =============================================

-- Everyone can read system config
CREATE POLICY "Users can read system config"
  ON system_config FOR SELECT
  USING (true);

-- Only admins can insert system config
CREATE POLICY "Only admins can insert system config"
  ON system_config FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role = 'administrateur'
    )
  );

-- Only admins can update system config
CREATE POLICY "Only admins can update system config"
  ON system_config FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role = 'administrateur'
    )
  );

-- Only admins can delete system config
CREATE POLICY "Only admins can delete system config"
  ON system_config FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role = 'administrateur'
    )
  );

-- =============================================
-- AUDIT LOG POLICIES
-- =============================================

-- Users can view their own audit logs
CREATE POLICY "Users can view their own audit logs"
  ON audit_logs FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('manager', 'administrateur')
    )
  );

-- Only admins can insert audit logs
CREATE POLICY "Only admins can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role = 'administrateur'
    )
  );

-- Only admins can update audit logs
CREATE POLICY "Only admins can update audit logs"
  ON audit_logs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role = 'administrateur'
    )
  );

-- Only admins can delete audit logs
CREATE POLICY "Only admins can delete audit logs"
  ON audit_logs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role = 'administrateur'
    )
  );