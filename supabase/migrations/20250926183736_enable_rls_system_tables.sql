-- Enable Row Level Security on system tables
-- These tables are technical/system tables that should only be accessed by Edge Functions
-- No direct frontend user access is required

-- =============================================
-- ENABLE RLS ON SYSTEM TABLES
-- =============================================

-- Enable RLS on webhook subscriptions table
ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;

-- Enable RLS on message headers table
ALTER TABLE message_headers ENABLE ROW LEVEL SECURITY;

-- Enable RLS on detection logs table
ALTER TABLE detection_logs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES FOR WEBHOOK_SUBSCRIPTIONS
-- =============================================

-- Service role (Edge Functions) has full access
CREATE POLICY "Service role full access"
  ON webhook_subscriptions
  FOR ALL
  TO service_role
  USING (true);

-- Admins can read for debugging purposes only
CREATE POLICY "Admins read only for debugging"
  ON webhook_subscriptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role = 'administrateur'
    )
  );

-- =============================================
-- RLS POLICIES FOR MESSAGE_HEADERS
-- =============================================

-- Service role (Edge Functions) has full access
CREATE POLICY "Service role full access"
  ON message_headers
  FOR ALL
  TO service_role
  USING (true);

-- Admins can read for debugging purposes only
CREATE POLICY "Admins read only for debugging"
  ON message_headers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role = 'administrateur'
    )
  );

-- =============================================
-- RLS POLICIES FOR DETECTION_LOGS
-- =============================================

-- Service role (Edge Functions) has full access
CREATE POLICY "Service role full access"
  ON detection_logs
  FOR ALL
  TO service_role
  USING (true);

-- Admins can read for debugging purposes only
CREATE POLICY "Admins read only for debugging"
  ON detection_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role = 'administrateur'
    )
  );