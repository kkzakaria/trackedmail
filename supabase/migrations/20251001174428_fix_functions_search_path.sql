-- Fix search_path for functions to resolve security warnings
-- Sets search_path to empty string as recommended by Supabase Security Advisor
-- Note: This migration will be superseded by the next migration which adds qualified table names

ALTER FUNCTION public.mark_email_as_bounced(p_tracked_email_id uuid, p_bounce_type text, p_bounce_reason text)
  SET search_path = '';

ALTER FUNCTION public.analyze_bounce_smtp_code(p_smtp_code text)
  SET search_path = '';

ALTER FUNCTION public.trigger_process_email_bounce()
  SET search_path = '';

ALTER FUNCTION public.check_email_bounce_status(p_tracked_email_id uuid)
  SET search_path = '';

ALTER FUNCTION public.get_emails_with_max_followups(p_max_followups integer)
  SET search_path = '';

ALTER FUNCTION public.update_followup_stats()
  SET search_path = '';

ALTER FUNCTION public.mark_email_manually_handled(p_email_id uuid, p_action text, p_reason text)
  SET search_path = '';

ALTER FUNCTION public.get_cron_internal_key()
  SET search_path = '';
