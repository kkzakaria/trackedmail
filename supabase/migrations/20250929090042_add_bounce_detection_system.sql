-- Migration: Add Bounce Detection System
-- Description: Implements comprehensive bounce (NDR) detection and management for email tracking
-- Author: TrackedMail System
-- Date: 2025-09-29

-- =====================================================
-- 1. Create email_bounces table for storing bounce information
-- =====================================================

CREATE TABLE IF NOT EXISTS email_bounces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_email_id UUID REFERENCES tracked_emails(id) ON DELETE CASCADE,
  microsoft_message_id TEXT NOT NULL,

  -- Bounce classification
  bounce_type TEXT NOT NULL CHECK (bounce_type IN ('hard', 'soft', 'unknown')),
  bounce_code TEXT, -- SMTP code like 5.1.1, 5.7.1, 4.4.1
  bounce_category TEXT CHECK (bounce_category IN (
    'invalid_recipient',    -- 5.1.x - Address doesn't exist
    'mailbox_full',         -- 5.2.2 - Mailbox full
    'message_too_large',    -- 5.2.3 - Message too large
    'network_error',        -- 4.4.x - Network issues
    'spam_rejection',       -- 5.7.1 - Marked as spam
    'policy_rejection',     -- 5.7.x - Policy reasons
    'temporary_failure',    -- 4.x.x - Temporary issues
    'other'
  )),

  -- Bounce details
  bounce_reason TEXT, -- Human-readable reason from NDR
  failed_recipients TEXT[], -- List of recipients that bounced
  diagnostic_code TEXT, -- Full diagnostic from mail server
  reporting_mta TEXT, -- Mail server that reported the bounce

  -- Original email reference
  original_subject TEXT,
  original_sent_at TIMESTAMPTZ,

  -- NDR details
  ndr_sender TEXT, -- Usually postmaster@domain
  ndr_received_at TIMESTAMPTZ,
  ndr_headers JSONB, -- Store relevant headers for analysis

  -- Processing status
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  followups_cancelled INTEGER DEFAULT 0, -- Number of followups cancelled due to this bounce

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure we don't duplicate bounce records
  UNIQUE(tracked_email_id, microsoft_message_id)
);

-- Create indexes for performance
CREATE INDEX idx_email_bounces_tracked_email ON email_bounces(tracked_email_id);
CREATE INDEX idx_email_bounces_detected_at ON email_bounces(detected_at);
CREATE INDEX idx_email_bounces_bounce_type ON email_bounces(bounce_type);
CREATE INDEX idx_email_bounces_processed ON email_bounces(processed) WHERE processed = false;

-- =====================================================
-- 2. Extend tracked_emails table with bounce information
-- =====================================================

ALTER TABLE tracked_emails
ADD COLUMN IF NOT EXISTS bounce_type TEXT,
ADD COLUMN IF NOT EXISTS bounce_detected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS bounce_reason TEXT,
ADD COLUMN IF NOT EXISTS bounce_count INTEGER DEFAULT 0;

-- Add constraint to ensure bounce_type matches allowed values
ALTER TABLE tracked_emails
DROP CONSTRAINT IF EXISTS tracked_emails_bounce_type_check;

ALTER TABLE tracked_emails
ADD CONSTRAINT tracked_emails_bounce_type_check
CHECK (bounce_type IS NULL OR bounce_type IN ('hard', 'soft', 'unknown'));

-- =====================================================
-- 3. Create bounce statistics view for monitoring
-- =====================================================

CREATE OR REPLACE VIEW bounce_statistics AS
SELECT
  DATE(detected_at) as date,
  bounce_type,
  bounce_category,
  COUNT(*) as count,
  COUNT(DISTINCT tracked_email_id) as unique_emails,
  array_agg(DISTINCT bounce_code) FILTER (WHERE bounce_code IS NOT NULL) as bounce_codes
FROM email_bounces
GROUP BY DATE(detected_at), bounce_type, bounce_category
ORDER BY date DESC, count DESC;

-- =====================================================
-- 4. Create mailbox bounce rate view
-- =====================================================

CREATE OR REPLACE VIEW mailbox_bounce_rates AS
WITH email_counts AS (
  SELECT
    m.id as mailbox_id,
    m.email_address,
    COUNT(DISTINCT te.id) as total_emails,
    COUNT(DISTINCT te.id) FILTER (WHERE te.status = 'bounced') as bounced_emails,
    COUNT(DISTINCT eb.id) FILTER (WHERE eb.bounce_type = 'hard') as hard_bounces,
    COUNT(DISTINCT eb.id) FILTER (WHERE eb.bounce_type = 'soft') as soft_bounces
  FROM mailboxes m
  LEFT JOIN tracked_emails te ON te.mailbox_id = m.id
  LEFT JOIN email_bounces eb ON eb.tracked_email_id = te.id
  WHERE te.sent_at >= NOW() - INTERVAL '30 days'
  GROUP BY m.id, m.email_address
),
bounce_calculations AS (
  SELECT
    mailbox_id,
    email_address,
    total_emails,
    bounced_emails,
    hard_bounces,
    soft_bounces,
    CASE
      WHEN total_emails > 0 THEN
        ROUND((bounced_emails::numeric / total_emails::numeric) * 100, 2)
      ELSE 0
    END as bounce_rate_percent
  FROM email_counts
)
SELECT
  mailbox_id,
  email_address,
  total_emails,
  bounced_emails,
  hard_bounces,
  soft_bounces,
  bounce_rate_percent,
  CASE
    WHEN bounce_rate_percent > 10 THEN 'critical'
    WHEN bounce_rate_percent > 5 THEN 'warning'
    ELSE 'healthy'
  END as health_status
FROM bounce_calculations
ORDER BY bounce_rate_percent DESC;

-- =====================================================
-- 5. Add bounce detection configuration
-- =====================================================

INSERT INTO system_config (key, value)
VALUES ('bounce_detection', '{
  "enabled": true,
  "hard_bounce_action": "stop_immediately",
  "soft_bounce_action": "retry_limit",
  "soft_bounce_retry_limit": 2,
  "soft_bounce_retry_delay_hours": 24,
  "check_interval_minutes": 5,
  "auto_disable_threshold_percent": 10,
  "warning_threshold_percent": 5,
  "monitoring_window_days": 30,
  "ndr_patterns": {
    "subjects": ["Undeliverable:", "Mail delivery failed", "Delivery Status Notification", "Returned mail:"],
    "senders": ["postmaster@", "mailer-daemon@", "no-reply@"],
    "content_types": ["multipart/report", "message/delivery-status"]
  }
}')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = NOW();

-- =====================================================
-- 6. Create function to mark email as bounced
-- =====================================================

CREATE OR REPLACE FUNCTION mark_email_as_bounced(
  p_tracked_email_id UUID,
  p_bounce_type TEXT,
  p_bounce_reason TEXT
) RETURNS VOID AS $$
BEGIN
  -- Update the tracked email status
  UPDATE tracked_emails
  SET
    status = 'bounced',
    bounce_type = p_bounce_type,
    bounce_detected_at = NOW(),
    bounce_reason = p_bounce_reason,
    bounce_count = bounce_count + 1,
    updated_at = NOW()
  WHERE id = p_tracked_email_id;

  -- Cancel all scheduled followups for this email
  UPDATE followups
  SET
    status = 'cancelled',
    failure_reason = 'Email bounced: ' || p_bounce_reason,
    updated_at = NOW()
  WHERE
    tracked_email_id = p_tracked_email_id
    AND status = 'scheduled';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. Create function to analyze bounce patterns
-- =====================================================

CREATE OR REPLACE FUNCTION analyze_bounce_smtp_code(p_smtp_code TEXT)
RETURNS TABLE (
  bounce_type TEXT,
  bounce_category TEXT,
  is_permanent BOOLEAN,
  should_retry BOOLEAN
) AS $$
BEGIN
  -- Parse SMTP codes according to RFC 3463
  -- Format: class.subject.detail (e.g., 5.1.1)

  IF p_smtp_code IS NULL THEN
    RETURN QUERY SELECT 'unknown'::TEXT, 'other'::TEXT, false, false;
    RETURN;
  END IF;

  -- Permanent failures (5.x.x)
  IF p_smtp_code LIKE '5.1.%' THEN
    -- Address errors
    RETURN QUERY SELECT 'hard'::TEXT, 'invalid_recipient'::TEXT, true, false;
  ELSIF p_smtp_code = '5.2.2' THEN
    -- Mailbox full
    RETURN QUERY SELECT 'soft'::TEXT, 'mailbox_full'::TEXT, false, true;
  ELSIF p_smtp_code = '5.2.3' THEN
    -- Message too large
    RETURN QUERY SELECT 'soft'::TEXT, 'message_too_large'::TEXT, false, false;
  ELSIF p_smtp_code LIKE '5.7.%' THEN
    -- Policy/Security rejections
    RETURN QUERY SELECT 'hard'::TEXT,
      CASE
        WHEN p_smtp_code = '5.7.1' THEN 'spam_rejection'::TEXT
        ELSE 'policy_rejection'::TEXT
      END, true, false;

  -- Temporary failures (4.x.x)
  ELSIF p_smtp_code LIKE '4.4.%' THEN
    -- Network/routing errors
    RETURN QUERY SELECT 'soft'::TEXT, 'network_error'::TEXT, false, true;
  ELSIF p_smtp_code LIKE '4.%' THEN
    -- Other temporary failures
    RETURN QUERY SELECT 'soft'::TEXT, 'temporary_failure'::TEXT, false, true;

  -- Unknown or other codes
  ELSE
    RETURN QUERY SELECT 'unknown'::TEXT, 'other'::TEXT, false, false;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 8. Create trigger to auto-update tracked_emails on bounce insert
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_process_email_bounce()
RETURNS TRIGGER AS $$
BEGIN
  -- Mark the email as bounced
  PERFORM mark_email_as_bounced(
    NEW.tracked_email_id,
    NEW.bounce_type,
    NEW.bounce_reason
  );

  -- Count cancelled followups
  UPDATE email_bounces
  SET followups_cancelled = (
    SELECT COUNT(*)
    FROM followups
    WHERE tracked_email_id = NEW.tracked_email_id
      AND status = 'cancelled'
      AND failure_reason LIKE 'Email bounced:%'
  )
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER process_email_bounce_trigger
AFTER INSERT ON email_bounces
FOR EACH ROW
EXECUTE FUNCTION trigger_process_email_bounce();

-- =====================================================
-- 9. Create RPC function to check bounce status
-- =====================================================

CREATE OR REPLACE FUNCTION check_email_bounce_status(p_tracked_email_id UUID)
RETURNS TABLE (
  has_bounced BOOLEAN,
  bounce_type TEXT,
  bounce_reason TEXT,
  can_retry BOOLEAN,
  retry_count INTEGER
) AS $$
DECLARE
  v_bounce_record RECORD;
  v_config JSONB;
BEGIN
  -- Get bounce detection config
  SELECT value INTO v_config
  FROM system_config
  WHERE key = 'bounce_detection';

  -- Check if email has bounced
  SELECT
    te.bounce_type,
    te.bounce_reason,
    te.bounce_count
  INTO v_bounce_record
  FROM tracked_emails te
  WHERE te.id = p_tracked_email_id;

  IF v_bounce_record.bounce_type IS NULL THEN
    -- No bounce detected
    RETURN QUERY SELECT false, NULL::TEXT, NULL::TEXT, true, 0;
  ELSE
    -- Determine if we can retry based on bounce type and config
    RETURN QUERY SELECT
      true,
      v_bounce_record.bounce_type,
      v_bounce_record.bounce_reason,
      CASE
        WHEN v_bounce_record.bounce_type = 'hard' THEN false
        WHEN v_bounce_record.bounce_type = 'soft' THEN
          v_bounce_record.bounce_count < COALESCE((v_config->>'soft_bounce_retry_limit')::INTEGER, 2)
        ELSE false
      END,
      v_bounce_record.bounce_count;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 10. Add comments for documentation
-- =====================================================

COMMENT ON TABLE email_bounces IS 'Stores NDR (Non-Delivery Report) information for bounced emails, enabling automatic followup cancellation and sender reputation management';
COMMENT ON COLUMN email_bounces.bounce_type IS 'Classification: hard (permanent failure), soft (temporary), or unknown';
COMMENT ON COLUMN email_bounces.bounce_code IS 'SMTP status code from the bounce message (e.g., 5.1.1 for invalid recipient)';
COMMENT ON COLUMN email_bounces.bounce_category IS 'Categorized reason for bounce to enable pattern analysis';
COMMENT ON COLUMN email_bounces.failed_recipients IS 'Array of email addresses that failed delivery';
COMMENT ON COLUMN email_bounces.followups_cancelled IS 'Count of followup emails cancelled due to this bounce';

COMMENT ON VIEW bounce_statistics IS 'Daily aggregate view of bounce metrics for monitoring email delivery health';
COMMENT ON VIEW mailbox_bounce_rates IS 'Per-mailbox bounce rate calculation with health status indicators';

COMMENT ON FUNCTION mark_email_as_bounced IS 'Marks an email as bounced and automatically cancels all scheduled followups';
COMMENT ON FUNCTION analyze_bounce_smtp_code IS 'Parses SMTP status codes to determine bounce type and retry eligibility';
COMMENT ON FUNCTION check_email_bounce_status IS 'Checks if an email has bounced and whether retry is allowed based on configuration';