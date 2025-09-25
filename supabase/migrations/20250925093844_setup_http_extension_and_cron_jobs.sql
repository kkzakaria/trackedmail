-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Drop the existing net schema if it exists and recreate with pg_net
DO $$
BEGIN
    -- Try to drop the existing net schema
    DROP SCHEMA IF EXISTS net CASCADE;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Now create pg_net extension which will create its own net schema
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant permissions on the net schema created by pg_net
DO $$
BEGIN
    GRANT USAGE ON SCHEMA net TO authenticated, service_role, postgres;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA net TO postgres;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Remove any existing cron jobs (ignore errors if they don't exist)
DO $$
BEGIN
    PERFORM cron.unschedule('schedule-followups');
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    PERFORM cron.unschedule('send-followups');
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    PERFORM cron.unschedule('renew-webhooks');
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Create cron jobs with correct net.http_post() syntax
-- Planification des relances (toutes les heures)
SELECT cron.schedule(
  'schedule-followups',
  '0 * * * *',
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

-- Envoi des relances (toutes les 15 minutes)
SELECT cron.schedule(
  'send-followups',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://hfmsimfohzeareccrnqj.supabase.co/functions/v1/followup-sender',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'source', 'cron_sender',
      'timestamp', now()::text
    ),
    timeout_milliseconds := 60000
  ) as request_id;
  $$
);

-- Renouvellement des webhooks (toutes les 12 heures)
SELECT cron.schedule(
  'renew-webhooks',
  '0 */12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://hfmsimfohzeareccrnqj.supabase.co/functions/v1/microsoft-subscriptions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'action', 'renew',
      'source', 'cron_webhooks',
      'timestamp', now()::text
    ),
    timeout_milliseconds := 60000
  ) as request_id;
  $$
);