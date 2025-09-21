-- Initial schema for TrackedMail application
-- TrackedMail: Mono-tenant email tracking and follow-up application

-- 1. users table
-- Application users table (uses Supabase Auth)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT auth.uid(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('administrateur', 'manager', 'utilisateur')),
  mailbox_address TEXT, -- Microsoft email address to track
  timezone TEXT DEFAULT 'UTC',
  pause_relances BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. mailboxes table
-- Mailboxes tracked by the application
CREATE TABLE mailboxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_address TEXT NOT NULL UNIQUE,
  display_name TEXT,
  microsoft_user_id TEXT, -- Microsoft Graph user ID
  is_active BOOLEAN DEFAULT true,
  last_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. user_mailbox_assignments table
-- User to mailbox assignments
CREATE TABLE user_mailbox_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  mailbox_id UUID REFERENCES mailboxes(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES users(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, mailbox_id)
);

-- 4. tracked_emails table
-- Sent emails tracked by the system
CREATE TABLE tracked_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  microsoft_message_id TEXT NOT NULL UNIQUE,
  conversation_id TEXT,
  mailbox_id UUID REFERENCES mailboxes(id) ON DELETE CASCADE,

  -- Email metadata
  subject TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  recipient_emails TEXT[] NOT NULL,
  cc_emails TEXT[],
  bcc_emails TEXT[],

  -- Content
  body_preview TEXT,
  body_content TEXT,
  has_attachments BOOLEAN DEFAULT false,
  importance TEXT CHECK (importance IN ('low', 'normal', 'high')),

  -- Tracking status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',      -- Waiting for response
    'responded',    -- Received a response
    'stopped',      -- Manually stopped
    'max_reached',  -- Max followups reached
    'bounced',      -- Email not delivered
    'expired'       -- Expired after 30 days
  )),

  -- Important dates
  sent_at TIMESTAMPTZ NOT NULL,
  responded_at TIMESTAMPTZ,
  stopped_at TIMESTAMPTZ,

  -- Thread tracking
  is_reply BOOLEAN DEFAULT false,
  parent_message_id TEXT,
  thread_position INTEGER DEFAULT 1,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for frequent searches
CREATE INDEX idx_tracked_emails_status ON tracked_emails(status);
CREATE INDEX idx_tracked_emails_conversation_id ON tracked_emails(conversation_id);
CREATE INDEX idx_tracked_emails_sent_at ON tracked_emails(sent_at);
CREATE INDEX idx_tracked_emails_mailbox_id ON tracked_emails(mailbox_id);

-- 5. followup_templates table
-- Configurable followup templates
CREATE TABLE followup_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  followup_number INTEGER NOT NULL, -- 1st, 2nd, 3rd followup
  delay_hours INTEGER DEFAULT 96, -- Specific delay for this template
  is_active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,

  -- Available variables in the template
  available_variables TEXT[] DEFAULT ARRAY[
    'destinataire_nom',
    'destinataire_entreprise',
    'objet_original',
    'date_envoi_original',
    'numero_relance',
    'jours_depuis_envoi'
  ],

  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(followup_number, is_active) -- Only one active template per level
);

-- 6. followups table
-- Sent followups
CREATE TABLE followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_email_id UUID REFERENCES tracked_emails(id) ON DELETE CASCADE,
  template_id UUID REFERENCES followup_templates(id),

  -- Followup data
  followup_number INTEGER NOT NULL,
  microsoft_message_id TEXT UNIQUE,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,

  -- Status
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN (
    'scheduled',    -- Scheduled
    'sent',        -- Sent
    'failed',      -- Send failed
    'cancelled'    -- Cancelled
  )),

  -- Timing
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for followups to process
CREATE INDEX idx_followups_scheduled ON followups(scheduled_for) WHERE status = 'scheduled';
CREATE INDEX idx_followups_tracked_email ON followups(tracked_email_id);

-- 7. email_responses table
-- Detected responses to tracked emails
CREATE TABLE email_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_email_id UUID REFERENCES tracked_emails(id) ON DELETE CASCADE,
  microsoft_message_id TEXT NOT NULL UNIQUE,

  -- Response metadata
  sender_email TEXT NOT NULL,
  subject TEXT,
  body_preview TEXT,
  received_at TIMESTAMPTZ NOT NULL,

  -- Response type
  response_type TEXT CHECK (response_type IN (
    'direct_reply',     -- Direct reply
    'forward',          -- Forwarded email
    'auto_reply',       -- Auto response
    'bounce'           -- Undelivered email
  )),

  is_auto_response BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_responses_tracked_email ON email_responses(tracked_email_id);

-- 8. webhook_events table
-- Microsoft Graph webhook events history
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id TEXT NOT NULL,
  change_type TEXT NOT NULL,
  resource_data JSONB NOT NULL,
  client_state TEXT,

  -- Processing
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  processing_error TEXT,
  retry_count INTEGER DEFAULT 0,

  received_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_events_processed ON webhook_events(processed);
CREATE INDEX idx_webhook_events_received_at ON webhook_events(received_at);

-- 9. microsoft_graph_tokens table
-- Secure management of Microsoft Graph tokens
CREATE TABLE microsoft_graph_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_type TEXT NOT NULL, -- 'access' or 'refresh'
  encrypted_token TEXT NOT NULL, -- Token encrypted with Supabase Vault
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT,
  last_refreshed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. system_config table
-- Global system configuration
CREATE TABLE system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default configuration
INSERT INTO system_config (key, value, description) VALUES
  ('working_hours', '{
    "timezone": "UTC",
    "start": "07:00",
    "end": "18:00",
    "working_days": ["monday", "tuesday", "wednesday", "thursday", "friday"],
    "holidays": []
  }', 'Working hours for followups'),
  ('followup_settings', '{
    "max_followups": 3,
    "default_interval_hours": 96,
    "stop_after_days": 30,
    "stop_on_bounce": true,
    "stop_on_unsubscribe": true
  }', 'Followup settings');

-- 11. audit_logs table
-- Audit logs for compliance
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Functions and Triggers

-- Function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_mailboxes_updated_at BEFORE UPDATE ON mailboxes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_tracked_emails_updated_at BEFORE UPDATE ON tracked_emails
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_followup_templates_updated_at BEFORE UPDATE ON followup_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_followups_updated_at BEFORE UPDATE ON followups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_microsoft_graph_tokens_updated_at BEFORE UPDATE ON microsoft_graph_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_system_config_updated_at BEFORE UPDATE ON system_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to detect responses and update status
CREATE OR REPLACE FUNCTION update_email_status_on_response()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE tracked_emails
  SET
    status = 'responded',
    responded_at = NEW.received_at
  WHERE id = NEW.tracked_email_id
    AND status = 'pending';

  -- Cancel scheduled followups
  UPDATE followups
  SET status = 'cancelled'
  WHERE tracked_email_id = NEW.tracked_email_id
    AND status = 'scheduled';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_email_status
  AFTER INSERT ON email_responses
  FOR EACH ROW EXECUTE FUNCTION update_email_status_on_response();

-- Useful views

-- View of emails needing followup
CREATE VIEW emails_needing_followup AS
SELECT
  te.*,
  COALESCE(MAX(f.followup_number), 0) as last_followup_number,
  MAX(f.sent_at) as last_followup_at
FROM tracked_emails te
LEFT JOIN followups f ON f.tracked_email_id = te.id AND f.status = 'sent'
WHERE te.status = 'pending'
  AND te.sent_at < NOW() - INTERVAL '96 hours'
GROUP BY te.id
HAVING COALESCE(MAX(f.followup_number), 0) < 3;

-- Mailbox statistics view
CREATE VIEW mailbox_statistics AS
SELECT
  m.id,
  m.email_address,
  COUNT(DISTINCT te.id) as total_emails,
  COUNT(DISTINCT te.id) FILTER (WHERE te.status = 'pending') as pending_emails,
  COUNT(DISTINCT te.id) FILTER (WHERE te.status = 'responded') as responded_emails,
  COUNT(DISTINCT f.id) as total_followups_sent,
  ROUND(
    COUNT(DISTINCT te.id) FILTER (WHERE te.status = 'responded')::numeric /
    NULLIF(COUNT(DISTINCT te.id), 0) * 100, 2
  ) as response_rate
FROM mailboxes m
LEFT JOIN tracked_emails te ON te.mailbox_id = m.id
LEFT JOIN followups f ON f.tracked_email_id = te.id AND f.status = 'sent'
GROUP BY m.id, m.email_address;

-- Additional performance indexes

-- Composite index for followup queries
CREATE INDEX idx_tracked_emails_pending_sent
  ON tracked_emails(status, sent_at)
  WHERE status = 'pending';

-- Index for email search
CREATE INDEX idx_tracked_emails_recipient_emails
  ON tracked_emails USING GIN(recipient_emails);

-- Index for unprocessed webhooks
CREATE INDEX idx_webhook_events_unprocessed
  ON webhook_events(received_at)
  WHERE processed = false;