-- Migration: Update emails_needing_followup view to use 4-hour interval
-- Description: Updates the view to match the new 4-hour followup interval instead of 96 hours

-- Drop and recreate the view with the new 4-hour interval
DROP VIEW IF EXISTS emails_needing_followup;

CREATE OR REPLACE VIEW emails_needing_followup AS
SELECT
    te.id,
    te.microsoft_message_id,
    te.conversation_id,
    te.mailbox_id,
    te.subject,
    te.sender_email,
    te.recipient_emails,
    te.cc_emails,
    te.bcc_emails,
    te.body_preview,
    te.body_content,
    te.has_attachments,
    te.importance,
    te.status,
    te.sent_at,
    te.responded_at,
    te.stopped_at,
    te.is_reply,
    te.parent_message_id,
    te.thread_position,
    te.created_at,
    te.updated_at,
    COALESCE(MAX(f.followup_number), 0) AS last_followup_number,
    MAX(f.sent_at) AS last_followup_at
FROM tracked_emails te
LEFT JOIN followups f ON f.tracked_email_id = te.id AND f.status = 'sent'
WHERE te.status = 'pending'
  AND te.sent_at < (NOW() - INTERVAL '4 hours')  -- Updated from 96 hours to 4 hours
GROUP BY te.id
HAVING COALESCE(MAX(f.followup_number), 0) < 3;

-- Add comment explaining the new logic
COMMENT ON VIEW emails_needing_followup IS 'View showing emails that need followup reminders. Uses 4-hour intervals for the new aggressive followup strategy: 1st at 4h, 2nd at 8h, 3rd at 12h after initial send.';