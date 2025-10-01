-- Migration: Qualify all table names with schema for empty search_path
-- Description: Recreate 8 functions with fully qualified table names (public.table_name)
--              to enable search_path = '' for maximum security
-- Author: TrackedMail System
-- Date: 2025-10-01

-- =====================================================
-- 1. mark_email_as_bounced - Bounce detection system
-- =====================================================

CREATE OR REPLACE FUNCTION mark_email_as_bounced(
  p_tracked_email_id UUID,
  p_bounce_type TEXT,
  p_bounce_reason TEXT
) RETURNS VOID AS $$
BEGIN
  -- Update the tracked email status
  UPDATE public.tracked_emails
  SET
    status = 'bounced',
    bounce_type = p_bounce_type,
    bounce_detected_at = NOW(),
    bounce_reason = p_bounce_reason,
    bounce_count = bounce_count + 1,
    updated_at = NOW()
  WHERE id = p_tracked_email_id;

  -- Cancel all scheduled followups for this email
  UPDATE public.followups
  SET
    status = 'cancelled',
    failure_reason = 'Email bounced: ' || p_bounce_reason,
    updated_at = NOW()
  WHERE
    tracked_email_id = p_tracked_email_id
    AND status = 'scheduled';
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- =====================================================
-- 2. analyze_bounce_smtp_code - SMTP code analyzer
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
$$ LANGUAGE plpgsql
SET search_path = '';

-- =====================================================
-- 3. trigger_process_email_bounce - Bounce trigger
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
  UPDATE public.email_bounces
  SET followups_cancelled = (
    SELECT COUNT(*)
    FROM public.followups
    WHERE tracked_email_id = NEW.tracked_email_id
      AND status = 'cancelled'
      AND failure_reason LIKE 'Email bounced:%'
  )
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- =====================================================
-- 4. check_email_bounce_status - Bounce status checker
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
  FROM public.system_config
  WHERE key = 'bounce_detection';

  -- Check if email has bounced
  SELECT
    te.bounce_type,
    te.bounce_reason,
    te.bounce_count
  INTO v_bounce_record
  FROM public.tracked_emails te
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
$$ LANGUAGE plpgsql
SET search_path = '';

-- =====================================================
-- 5. get_emails_with_max_followups - Max followups detector
-- =====================================================

CREATE OR REPLACE FUNCTION get_emails_with_max_followups(p_max_followups INTEGER)
RETURNS TABLE(id UUID)
LANGUAGE SQL
STABLE
AS $$
    SELECT te.id
    FROM public.tracked_emails te
    WHERE te.status = 'pending'
      AND te.followup_count >= p_max_followups;
$$
SET search_path = '';

-- =====================================================
-- 6. update_followup_stats - Followup statistics updater
-- =====================================================

CREATE OR REPLACE FUNCTION update_followup_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only process when a followup is marked as sent
    IF NEW.status = 'sent' AND (OLD.status IS NULL OR OLD.status != 'sent') THEN
        UPDATE public.tracked_emails
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
            NEW.tracked_email_id, (SELECT followup_count FROM public.tracked_emails WHERE id = NEW.tracked_email_id);
    END IF;

    RETURN NEW;
END;
$$
SET search_path = '';

-- =====================================================
-- 7. mark_email_manually_handled - Manual handling marker
-- =====================================================

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
    UPDATE public.tracked_emails
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
$$
SET search_path = '';

-- =====================================================
-- 8. get_cron_internal_key - Cron authentication key retriever
-- =====================================================

CREATE OR REPLACE FUNCTION get_cron_internal_key()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  internal_key text;
BEGIN
  -- Try to get from system_config table first (production)
  SELECT (value->>'key')::text INTO internal_key
  FROM public.system_config
  WHERE key = 'cron_internal_key';

  -- If found, return it
  IF internal_key IS NOT NULL THEN
    RETURN internal_key;
  END IF;

  -- Fallback: try PostgreSQL settings (if configured via ALTER DATABASE)
  BEGIN
    internal_key := current_setting('app.cron_internal_key', true);
    IF internal_key IS NOT NULL AND internal_key != '' THEN
      RETURN internal_key;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;

  -- Last fallback for local development
  RETURN 'dev-cron-key-12345';
END;
$$
SET search_path = '';

-- =====================================================
-- 9. Log migration completion
-- =====================================================

INSERT INTO public.system_config (key, value, description) VALUES (
  'qualified_table_names_migration',
  jsonb_build_object(
    'migrated_at', now(),
    'version', '1.0',
    'changes', jsonb_build_array(
      'Recreated 8 functions with fully qualified table names (public.table_name)',
      'Set search_path to empty string for maximum security',
      'Functions: mark_email_as_bounced, analyze_bounce_smtp_code, trigger_process_email_bounce',
      'Functions: check_email_bounce_status, get_emails_with_max_followups, update_followup_stats',
      'Functions: mark_email_manually_handled, get_cron_internal_key'
    ),
    'status', 'completed'
  ),
  'Migration to enable empty search_path with qualified table names'
) ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();
