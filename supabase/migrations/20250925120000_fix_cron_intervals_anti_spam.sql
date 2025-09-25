-- Fix cron job intervals to prevent spam
-- Migration: Correction des intervalles de cron jobs anti-spam

-- Remove existing potentially spammy cron jobs
DO $$
BEGIN
    PERFORM cron.unschedule('send-followups');
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    PERFORM cron.unschedule('schedule-followups');
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- CORRECTION 1: Scheduler moins fréquent (toutes les 2h au lieu de 1h)
-- La planification n'a pas besoin d'être si fréquente
SELECT cron.schedule(
  'schedule-followups',
  '0 */2 * * *', -- Toutes les 2 heures (était: toutes les heures)
  $$
  SELECT net.http_post(
    url := 'https://hfmsimfohzeareccrnqj.supabase.co/functions/v1/followup-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'source', 'cron_scheduler',
      'timestamp', now()::text
    ),
    timeout_milliseconds := 60000
  ) as request_id;
  $$
);

-- CORRECTION 2: Sender beaucoup moins fréquent (toutes les 60 minutes au lieu de 15)
-- CRITICAL: Évite les bursts de spam
SELECT cron.schedule(
  'send-followups',
  '0 * * * *', -- Toutes les heures (était: */15 minutes - DANGEREUX)
  $$
  SELECT net.http_post(
    url := 'https://hfmsimfohzeareccrnqj.supabase.co/functions/v1/followup-sender',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'source', 'cron_sender',
      'timestamp', now()::text,
      'anti_spam_mode', true
    ),
    timeout_milliseconds := 60000
  ) as request_id;
  $$
);

-- Commentaire explicatif pour la documentation
-- COMMENT ON SCHEMA cron IS 'Cron jobs with anti-spam intervals: scheduler=2h, sender=1h (was 15min - too spammy)';
-- Note: Schema comment disabled due to permission restrictions in local dev

-- Log de la correction
INSERT INTO system_config (key, value, description) VALUES (
  'cron_anti_spam_fix',
  jsonb_build_object(
    'fixed_at', now(),
    'changes', jsonb_build_object(
      'schedule_followups', 'hourly -> 2hourly',
      'send_followups', '15min -> hourly (CRITICAL spam fix)'
    ),
    'reason', 'Prevent email burst spam scenarios'
  ),
  'Anti-spam fix for cron job intervals'
) ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();