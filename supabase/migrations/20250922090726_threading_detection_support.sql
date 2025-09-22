-- Migration: Threading and Response Detection Support
-- Adds missing properties and tables for email response detection

-- ============================================
-- 1. Add missing threading properties to tracked_emails
-- ============================================
ALTER TABLE tracked_emails
ADD COLUMN IF NOT EXISTS conversation_index TEXT,
ADD COLUMN IF NOT EXISTS internet_message_id TEXT,
ADD COLUMN IF NOT EXISTS in_reply_to TEXT,
ADD COLUMN IF NOT EXISTS "references" TEXT;

-- Add indexes for threading properties
CREATE INDEX IF NOT EXISTS idx_tracked_emails_internet_message_id
  ON tracked_emails(internet_message_id);

CREATE INDEX IF NOT EXISTS idx_tracked_emails_conv_status
  ON tracked_emails(conversation_id, status)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_tracked_emails_msgid_status
  ON tracked_emails(internet_message_id, status)
  WHERE status = 'pending';

-- ============================================
-- 2. Add missing properties to email_responses
-- ============================================
ALTER TABLE email_responses
ADD COLUMN IF NOT EXISTS conversation_id TEXT,
ADD COLUMN IF NOT EXISTS conversation_index TEXT,
ADD COLUMN IF NOT EXISTS internet_message_id TEXT,
ADD COLUMN IF NOT EXISTS in_reply_to TEXT,
ADD COLUMN IF NOT EXISTS "references" TEXT,
ADD COLUMN IF NOT EXISTS body_content TEXT;

-- Add indexes for response detection
CREATE INDEX IF NOT EXISTS idx_email_responses_conversation_id
  ON email_responses(conversation_id);

CREATE INDEX IF NOT EXISTS idx_email_responses_internet_message_id
  ON email_responses(internet_message_id);

-- ============================================
-- 3. Create webhook_subscriptions table
-- ============================================
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id TEXT NOT NULL UNIQUE,
  resource TEXT NOT NULL,
  change_type TEXT NOT NULL,
  notification_url TEXT NOT NULL,
  expiration_date_time TIMESTAMPTZ NOT NULL,
  client_state TEXT NOT NULL,

  -- Lifecycle management
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_renewed_at TIMESTAMPTZ,
  renewal_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  mailbox_id UUID REFERENCES mailboxes(id) ON DELETE CASCADE,
  include_resource_data BOOLEAN DEFAULT false,

  CONSTRAINT chk_change_type CHECK (change_type IN ('created', 'updated', 'deleted'))
);

-- Indexes for subscription management
CREATE INDEX idx_webhook_subscriptions_expiration
  ON webhook_subscriptions(expiration_date_time)
  WHERE is_active = true;

CREATE INDEX idx_webhook_subscriptions_mailbox
  ON webhook_subscriptions(mailbox_id);

-- ============================================
-- 4. Create message_headers table
-- ============================================
CREATE TABLE IF NOT EXISTS message_headers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_email_id UUID REFERENCES tracked_emails(id) ON DELETE CASCADE,
  email_response_id UUID REFERENCES email_responses(id) ON DELETE CASCADE,

  header_name TEXT NOT NULL,
  header_value TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraint: either tracked_email_id or email_response_id must be defined
  CONSTRAINT chk_message_reference CHECK (
    (tracked_email_id IS NOT NULL AND email_response_id IS NULL) OR
    (tracked_email_id IS NULL AND email_response_id IS NOT NULL)
  )
);

-- Indexes for header lookups
CREATE INDEX idx_message_headers_tracked_email
  ON message_headers(tracked_email_id);

CREATE INDEX idx_message_headers_email_response
  ON message_headers(email_response_id);

CREATE INDEX idx_message_headers_name
  ON message_headers(header_name);

-- ============================================
-- 5. Create detection_logs table
-- ============================================
CREATE TABLE IF NOT EXISTS detection_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Analyzed message
  microsoft_message_id TEXT NOT NULL,
  conversation_id TEXT,

  -- Detection result
  is_response BOOLEAN NOT NULL,
  tracked_email_id UUID REFERENCES tracked_emails(id),
  detection_method TEXT CHECK (detection_method IN (
    'conversation_id',
    'in_reply_to',
    'references',
    'heuristic',
    'not_detected'
  )),

  -- Rejection reason if applicable
  rejection_reason TEXT CHECK (rejection_reason IN (
    'internal_email',
    'already_responded',
    'auto_response',
    'no_match',
    NULL
  )),

  -- Metrics
  detection_time_ms INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for monitoring and analysis
CREATE INDEX idx_detection_logs_created_at
  ON detection_logs(created_at);

CREATE INDEX idx_detection_logs_tracked_email
  ON detection_logs(tracked_email_id);

-- ============================================
-- 6. Add tenant configuration to system_config
-- ============================================
INSERT INTO system_config (key, value, description)
VALUES (
  'tenant_config',
  '{
    "domain": "",
    "microsoft_tenant_id": "",
    "exclude_internal_emails": true
  }'::jsonb,
  'Microsoft tenant configuration'
) ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 7. Create utility function for subject cleaning
-- ============================================
CREATE OR REPLACE FUNCTION clean_email_subject(subject TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Remove reply/forward prefixes
  RETURN TRIM(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        subject,
        '^(RE:|FW:|FWD:|TR:)\s*', '', 'gi'
      ),
      '^\[.*?\]\s*', '', 'g'
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Functional index for searching by cleaned subject
CREATE INDEX IF NOT EXISTS idx_tracked_emails_clean_subject
  ON tracked_emails(clean_email_subject(subject));

-- ============================================
-- 8. Create view for pending response detection
-- ============================================
CREATE OR REPLACE VIEW pending_response_detection AS
SELECT
  te.*,
  COALESCE(er.count_responses, 0) as response_count
FROM tracked_emails te
LEFT JOIN (
  SELECT tracked_email_id, COUNT(*) as count_responses
  FROM email_responses
  GROUP BY tracked_email_id
) er ON er.tracked_email_id = te.id
WHERE te.status = 'pending'
  AND NOT EXISTS (
    SELECT 1 FROM email_responses
    WHERE tracked_email_id = te.id
    AND NOT is_auto_response
  );

-- ============================================
-- 9. Add index for internal email detection
-- ============================================
CREATE INDEX IF NOT EXISTS idx_tracked_emails_sender
  ON tracked_emails(sender_email);

-- ============================================
-- 10. Comments for documentation
-- ============================================
COMMENT ON TABLE webhook_subscriptions IS 'Microsoft Graph webhook subscriptions for email notifications';
COMMENT ON TABLE message_headers IS 'Email headers for auto-response and bounce detection';
COMMENT ON TABLE detection_logs IS 'Response detection attempts logging for monitoring and debugging';
COMMENT ON COLUMN tracked_emails.conversation_index IS 'Microsoft Graph conversation order tracking';
COMMENT ON COLUMN tracked_emails.internet_message_id IS 'RFC standard message ID for email threading';
COMMENT ON COLUMN tracked_emails.in_reply_to IS 'Direct reference to parent message';
COMMENT ON COLUMN tracked_emails."references" IS 'Complete thread reference chain';
COMMENT ON FUNCTION clean_email_subject IS 'Remove reply/forward prefixes for heuristic matching';