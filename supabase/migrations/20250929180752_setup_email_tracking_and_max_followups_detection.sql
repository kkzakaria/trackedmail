-- Migration: Setup Email Tracking and Max Followups Detection
-- Description: Add tracking columns, RPC function, triggers and views for emails requiring manual handling

-- ===================================
-- STEP 1: Add tracking columns to tracked_emails
-- ===================================

-- Add new columns for better followup tracking
ALTER TABLE tracked_emails
ADD COLUMN IF NOT EXISTS followup_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_followup_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS requires_manual_review BOOLEAN DEFAULT FALSE;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_tracked_emails_followup_count ON tracked_emails(followup_count);
CREATE INDEX IF NOT EXISTS idx_tracked_emails_manual_review ON tracked_emails(requires_manual_review) WHERE requires_manual_review = TRUE;
CREATE INDEX IF NOT EXISTS idx_tracked_emails_status_followup_count ON tracked_emails(status, followup_count);

-- ===================================
-- STEP 2: Create RPC function for max followups detection
-- ===================================

-- Drop function if exists to allow recreation
DROP FUNCTION IF EXISTS get_emails_with_max_followups(INTEGER);

-- Create function to identify emails with max followups
CREATE OR REPLACE FUNCTION get_emails_with_max_followups(p_max_followups INTEGER)
RETURNS TABLE(id UUID)
LANGUAGE SQL
STABLE
AS $$
    SELECT te.id
    FROM tracked_emails te
    WHERE te.status = 'pending'
      AND te.followup_count >= p_max_followups;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_emails_with_max_followups(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_emails_with_max_followups(INTEGER) TO service_role;

-- ===================================
-- STEP 3: Create function to update followup stats
-- ===================================

-- Function to update followup statistics for an email
CREATE OR REPLACE FUNCTION update_followup_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only process when a followup is marked as sent
    IF NEW.status = 'sent' AND (OLD.status IS NULL OR OLD.status != 'sent') THEN
        UPDATE tracked_emails
        SET
            followup_count = followup_count + 1,
            last_followup_sent_at = NEW.sent_at,
            requires_manual_review = CASE
                WHEN followup_count + 1 >= 4 THEN TRUE
                ELSE requires_manual_review
            END,
            updated_at = NOW()
        WHERE id = NEW.tracked_email_id;

        -- Log the update
        RAISE LOG 'Updated followup stats for email %, new count: %',
            NEW.tracked_email_id, (SELECT followup_count FROM tracked_emails WHERE id = NEW.tracked_email_id);
    END IF;

    RETURN NEW;
END;
$$;

-- ===================================
-- STEP 4: Create trigger for automatic stats update
-- ===================================

-- Drop trigger if exists
DROP TRIGGER IF EXISTS update_followup_stats_trigger ON followups;

-- Create trigger on followups table
CREATE TRIGGER update_followup_stats_trigger
    AFTER INSERT OR UPDATE ON followups
    FOR EACH ROW
    EXECUTE FUNCTION update_followup_stats();

-- ===================================
-- STEP 5: Create view for manual handling dashboard
-- ===================================

-- Drop view if exists
DROP VIEW IF EXISTS emails_requiring_manual_handling;

-- Create comprehensive view for dashboard
CREATE VIEW emails_requiring_manual_handling AS
SELECT
    te.id,
    te.microsoft_message_id,
    te.subject,
    te.sender_email,
    te.recipient_emails,
    te.status,
    te.sent_at,
    te.followup_count,
    te.last_followup_sent_at,
    te.requires_manual_review,
    EXTRACT(DAYS FROM NOW() - te.sent_at) as days_since_sent,
    EXTRACT(DAYS FROM NOW() - te.last_followup_sent_at) as days_since_last_followup,
    m.email_address as mailbox_email,
    m.display_name as mailbox_name,
    -- Count of sent followups (verification)
    (SELECT COUNT(*) FROM followups f WHERE f.tracked_email_id = te.id AND f.status = 'sent') as verified_sent_count,
    -- Last followup details
    (SELECT f.subject FROM followups f WHERE f.tracked_email_id = te.id AND f.status = 'sent' ORDER BY f.sent_at DESC LIMIT 1) as last_followup_subject,
    -- Next possible action date (considering min delays)
    CASE
        WHEN te.followup_count = 0 THEN te.sent_at + INTERVAL '4 hours'
        WHEN te.followup_count = 1 THEN te.last_followup_sent_at + INTERVAL '6 hours'
        WHEN te.followup_count = 2 THEN te.last_followup_sent_at + INTERVAL '12 hours'
        WHEN te.followup_count = 3 THEN te.last_followup_sent_at + INTERVAL '12 hours'
        ELSE NULL
    END as next_possible_action_at
FROM tracked_emails te
LEFT JOIN mailboxes m ON te.mailbox_id = m.id
WHERE
    (te.status = 'requires_manual_handling' OR te.requires_manual_review = TRUE)
    AND te.status != 'responded'
    AND te.status != 'stopped'
ORDER BY
    te.followup_count DESC,
    te.last_followup_sent_at DESC,
    te.sent_at DESC;

-- Grant access to the view
GRANT SELECT ON emails_requiring_manual_handling TO authenticated;
GRANT SELECT ON emails_requiring_manual_handling TO service_role;

-- ===================================
-- STEP 6: Initialize existing data
-- ===================================

-- Update followup counts for existing emails
UPDATE tracked_emails
SET followup_count = (
    SELECT COUNT(*)
    FROM followups f
    WHERE f.tracked_email_id = tracked_emails.id
    AND f.status = 'sent'
),
last_followup_sent_at = (
    SELECT MAX(f.sent_at)
    FROM followups f
    WHERE f.tracked_email_id = tracked_emails.id
    AND f.status = 'sent'
),
requires_manual_review = (
    SELECT COUNT(*) >= 4
    FROM followups f
    WHERE f.tracked_email_id = tracked_emails.id
    AND f.status = 'sent'
);

-- Mark emails with 4+ followups as requiring manual handling
UPDATE tracked_emails
SET status = 'requires_manual_handling'
WHERE status = 'pending'
AND followup_count >= 4
AND requires_manual_review = TRUE;

-- ===================================
-- STEP 7: Create helper function for manual actions
-- ===================================

-- Function to mark an email as manually handled
CREATE OR REPLACE FUNCTION mark_email_manually_handled(
    p_email_id UUID,
    p_action TEXT DEFAULT 'manually_stopped',
    p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_updated_count INTEGER;
BEGIN
    UPDATE tracked_emails
    SET
        status = CASE
            WHEN p_action = 'manually_stopped' THEN 'stopped'
            WHEN p_action = 'requires_manual_handling' THEN 'requires_manual_handling'
            ELSE status
        END,
        requires_manual_review = FALSE,
        stopped_at = CASE WHEN p_action = 'manually_stopped' THEN NOW() ELSE stopped_at END,
        updated_at = NOW()
    WHERE id = p_email_id;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    -- Log the action
    RAISE LOG 'Manual action % applied to email % with reason: %. Updated % rows.',
        p_action, p_email_id, COALESCE(p_reason, 'No reason provided'), v_updated_count;

    RETURN v_updated_count > 0;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION mark_email_manually_handled(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_email_manually_handled(UUID, TEXT, TEXT) TO service_role;

-- ===================================
-- STEP 8: Log migration completion
-- ===================================

INSERT INTO system_config (key, value, description) VALUES (
  'email_tracking_enhancement_migration',
  jsonb_build_object(
    'migrated_at', now(),
    'version', '1.0',
    'features', jsonb_build_object(
      'followup_count_tracking', true,
      'manual_review_flags', true,
      'rpc_function_created', 'get_emails_with_max_followups',
      'dashboard_view_created', 'emails_requiring_manual_handling',
      'helper_functions', jsonb_build_array('mark_email_manually_handled'),
      'automatic_triggers', true,
      'existing_data_initialized', true
    )
  ),
  'Migration to add email tracking enhancements and max followups detection completed'
) ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = now();

-- Final verification query (commented for production)
-- SELECT
--     'Migration completed successfully' as status,
--     COUNT(*) as total_emails,
--     COUNT(CASE WHEN requires_manual_review THEN 1 END) as emails_requiring_review,
--     COUNT(CASE WHEN followup_count >= 4 THEN 1 END) as emails_with_4plus_followups
-- FROM tracked_emails;