-- Migration: Manual Followups Support
-- Description: Adds support for detecting and coordinating manual followups sent via Outlook
-- with automatic followup scheduling system

-- ============================================
-- 1. Create manual_followups table
-- ============================================
CREATE TABLE manual_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_email_id UUID NOT NULL REFERENCES tracked_emails(id) ON DELETE CASCADE,
  microsoft_message_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  sender_email TEXT NOT NULL,
  subject TEXT,
  followup_sequence_number INTEGER NOT NULL, -- Position in total cycle
  affects_automatic_scheduling BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_manual_followups_tracked_email ON manual_followups(tracked_email_id);
CREATE INDEX idx_manual_followups_conversation ON manual_followups(conversation_id);
CREATE INDEX idx_manual_followups_detected_at ON manual_followups(detected_at);

-- ============================================
-- 2. Utility function: reschedule pending followups
-- ============================================
CREATE OR REPLACE FUNCTION reschedule_pending_followups(
  p_tracked_email_id UUID,
  p_base_time TIMESTAMPTZ,
  p_adjustment_hours INTEGER DEFAULT 4
) RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- Reschedule all pending followups for this email
  -- Uses followup number to properly space intervals
  UPDATE followups
  SET
    scheduled_for = p_base_time + (p_adjustment_hours * followup_number || ' hours')::INTERVAL,
    updated_at = NOW()
  WHERE tracked_email_id = p_tracked_email_id
    AND status = 'scheduled'
    AND scheduled_for > NOW(); -- Only future ones

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  -- Log the rescheduling
  INSERT INTO audit_logs (
    action, entity_type, entity_id,
    new_values,
    created_at
  ) VALUES (
    'reschedule_followups',
    'followups',
    p_tracked_email_id::text,
    jsonb_build_object(
      'adjustment_hours', p_adjustment_hours,
      'base_time', p_base_time,
      'updated_count', updated_count
    ),
    NOW()
  );

  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 3. Utility function: get total followup count
-- ============================================
CREATE OR REPLACE FUNCTION get_total_followup_count(
  p_tracked_email_id UUID
) RETURNS INTEGER AS $$
DECLARE
  automatic_count INTEGER;
  manual_count INTEGER;
BEGIN
  -- Count automatic followups (sent)
  SELECT COUNT(*) INTO automatic_count
  FROM followups
  WHERE tracked_email_id = p_tracked_email_id
    AND status = 'sent';

  -- Count manual followups
  SELECT COUNT(*) INTO manual_count
  FROM manual_followups
  WHERE tracked_email_id = p_tracked_email_id;

  RETURN COALESCE(automatic_count, 0) + COALESCE(manual_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. View: followup activity summary
-- ============================================
CREATE OR REPLACE VIEW followup_activity_summary AS
SELECT
  te.id,
  te.subject,
  te.status,
  te.sent_at,
  te.conversation_id,
  te.sender_email,
  te.recipient_emails,
  COALESCE(auto_stats.count, 0) as automatic_followups,
  COALESCE(manual_stats.count, 0) as manual_followups,
  COALESCE(auto_stats.count, 0) + COALESCE(manual_stats.count, 0) as total_followups,
  GREATEST(
    te.sent_at,
    auto_stats.last_sent,
    manual_stats.last_detected
  ) as last_activity_at,
  CASE
    WHEN COALESCE(auto_stats.count, 0) + COALESCE(manual_stats.count, 0) >= 3 THEN 'max_reached'
    WHEN te.status = 'pending' AND COALESCE(auto_stats.count, 0) + COALESCE(manual_stats.count, 0) > 0 THEN 'active_followup'
    ELSE te.status
  END as effective_status,

  -- Next scheduled automatic followup
  next_auto.scheduled_for as next_automatic_followup,
  next_auto.followup_number as next_followup_number,

  -- Followup details for dashboard
  json_build_object(
    'automatic', auto_stats.details,
    'manual', manual_stats.details
  ) as followup_details

FROM tracked_emails te

-- Automatic followups stats
LEFT JOIN (
  SELECT
    tracked_email_id,
    COUNT(*) as count,
    MAX(sent_at) as last_sent,
    json_agg(
      json_build_object(
        'followup_number', followup_number,
        'sent_at', sent_at,
        'subject', subject,
        'status', status
      ) ORDER BY followup_number
    ) as details
  FROM followups
  WHERE status = 'sent'
  GROUP BY tracked_email_id
) auto_stats ON te.id = auto_stats.tracked_email_id

-- Manual followups stats
LEFT JOIN (
  SELECT
    tracked_email_id,
    COUNT(*) as count,
    MAX(detected_at) as last_detected,
    json_agg(
      json_build_object(
        'sequence_number', followup_sequence_number,
        'detected_at', detected_at,
        'subject', subject,
        'sender_email', sender_email
      ) ORDER BY followup_sequence_number
    ) as details
  FROM manual_followups
  GROUP BY tracked_email_id
) manual_stats ON te.id = manual_stats.tracked_email_id

-- Next scheduled automatic followup
LEFT JOIN (
  SELECT DISTINCT ON (tracked_email_id)
    tracked_email_id,
    scheduled_for,
    followup_number
  FROM followups
  WHERE status = 'scheduled'
    AND scheduled_for > NOW()
  ORDER BY tracked_email_id, scheduled_for ASC
) next_auto ON te.id = next_auto.tracked_email_id;

-- ============================================
-- 5. Update detection_logs enum for manual followups
-- ============================================
ALTER TABLE detection_logs
DROP CONSTRAINT IF EXISTS detection_logs_detection_method_check;

ALTER TABLE detection_logs
ADD CONSTRAINT detection_logs_detection_method_check
CHECK (detection_method IN (
  'conversation_id',
  'in_reply_to',
  'references',
  'heuristic',
  'not_detected',
  'manual_followup_detected',
  'manual_followup_ignored'
));

-- ============================================
-- 6. Update detection_logs rejection reasons for manual followups
-- ============================================
ALTER TABLE detection_logs
DROP CONSTRAINT IF EXISTS detection_logs_rejection_reason_check;

ALTER TABLE detection_logs
ADD CONSTRAINT detection_logs_rejection_reason_check
CHECK (rejection_reason IN (
  'internal_email',
  'already_responded',
  'auto_response',
  'no_match',
  'manual_already_detected',
  'conversation_not_found',
  NULL
));

-- ============================================
-- 7. Comments for documentation
-- ============================================
COMMENT ON TABLE manual_followups IS 'Manual followups sent via Outlook Reply function, detected by conversationId matching';
COMMENT ON COLUMN manual_followups.followup_sequence_number IS 'Sequential position in the total followup cycle (manual + automatic)';
COMMENT ON COLUMN manual_followups.affects_automatic_scheduling IS 'Whether this manual followup should trigger automatic followup rescheduling';
COMMENT ON FUNCTION get_total_followup_count IS 'Returns total count of followups (automatic + manual) for a tracked email';
COMMENT ON FUNCTION reschedule_pending_followups IS 'Reschedules pending automatic followups based on manual followup timing';
COMMENT ON VIEW followup_activity_summary IS 'Unified view of automatic and manual followup activity for dashboard display';

-- ============================================
-- 8. Row Level Security (RLS) policies
-- ============================================
ALTER TABLE manual_followups ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see manual followups for their assigned mailboxes
CREATE POLICY "manual_followups_select_policy"
ON manual_followups FOR SELECT
USING (
  tracked_email_id IN (
    SELECT te.id
    FROM tracked_emails te
    JOIN mailboxes mb ON te.mailbox_id = mb.id
    WHERE CASE
      WHEN current_user_role() = 'administrateur' THEN true
      WHEN current_user_role() = 'manager' THEN true
      ELSE mb.id IN (SELECT unnest(current_user_mailbox_ids()))
    END
  )
);

-- Policy: System can insert manual followups (no user restrictions for system detection)
CREATE POLICY "manual_followups_insert_policy"
ON manual_followups FOR INSERT
WITH CHECK (true); -- System detection should always be allowed

-- Grant permissions
GRANT SELECT ON manual_followups TO authenticated;
GRANT SELECT ON followup_activity_summary TO authenticated;
GRANT EXECUTE ON FUNCTION get_total_followup_count(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION reschedule_pending_followups(UUID, TIMESTAMPTZ, INTEGER) TO service_role;