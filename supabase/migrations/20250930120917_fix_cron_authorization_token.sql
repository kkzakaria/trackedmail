-- Migration: Fix Cron Job Authorization Token
-- Description: Use Supabase environment variables for Edge Function authentication
--
-- Supabase automatically provides these settings:
-- - current_setting('supabase.service_role_key') - Service role JWT
-- - current_setting('supabase.api_url') - Project API URL
--
-- No manual configuration needed!

-- ===================================
-- STEP 2: Remove existing cron jobs with broken authorization
-- ===================================

DO $$
BEGIN
    PERFORM cron.unschedule('followup-7h');
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    PERFORM cron.unschedule('followup-12h');
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    PERFORM cron.unschedule('followup-16h');
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    PERFORM cron.unschedule('followup-maintenance');
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- ===================================
-- STEP 3: Recreate cron jobs with proper authorization
-- ===================================
-- Important: The SUPABASE_SERVICE_ROLE_KEY must be configured in the pg_cron extension
-- via Supabase Dashboard under Project Settings > Database > Custom Postgres Config

-- Morning slot: 7h00 (Monday to Friday)
SELECT cron.schedule(
  'followup-7h',
  '0 7 * * 1-5',
  $$
  SELECT net.http_post(
    url := current_setting('supabase.api_url') || '/functions/v1/followup-processor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key')
    ),
    body := jsonb_build_object(
      'time_slot', '07:00',
      'source', 'cron_followup_morning',
      'timestamp', now()::text
    ),
    timeout_milliseconds := 120000
  ) as request_id;
  $$
);

-- Lunch slot: 12h00 (Monday to Friday)
SELECT cron.schedule(
  'followup-12h',
  '0 12 * * 1-5',
  $$
  SELECT net.http_post(
    url := current_setting('supabase.api_url') || '/functions/v1/followup-processor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key')
    ),
    body := jsonb_build_object(
      'time_slot', '12:00',
      'source', 'cron_followup_lunch',
      'timestamp', now()::text
    ),
    timeout_milliseconds := 120000
  ) as request_id;
  $$
);

-- Afternoon slot: 16h00 (Monday to Friday)
SELECT cron.schedule(
  'followup-16h',
  '0 16 * * 1-5',
  $$
  SELECT net.http_post(
    url := current_setting('supabase.api_url') || '/functions/v1/followup-processor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key')
    ),
    body := jsonb_build_object(
      'time_slot', '16:00',
      'source', 'cron_followup_afternoon',
      'timestamp', now()::text
    ),
    timeout_milliseconds := 120000
  ) as request_id;
  $$
);

-- Daily maintenance: 2h00 (Monday to Friday)
SELECT cron.schedule(
  'followup-maintenance',
  '0 2 * * 1-5',
  $$
  SELECT net.http_post(
    url := current_setting('supabase.api_url') || '/functions/v1/followup-maintenance',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key')
    ),
    body := jsonb_build_object(
      'source', 'cron_maintenance',
      'timestamp', now()::text
    ),
    timeout_milliseconds := 180000
  ) as request_id;
  $$
);

-- ===================================
-- STEP 4: Store migration log
-- ===================================

INSERT INTO system_config (key, value, description) VALUES (
  'cron_authorization_fix',
  jsonb_build_object(
    'migration_applied_at', now(),
    'version', '1.0',
    'changes', jsonb_build_array(
      'Fixed authorization using Supabase environment variables',
      'Changed from app.settings.service_role_key to supabase.service_role_key',
      'Changed from hardcoded URL to current_setting(supabase.api_url)'
    ),
    'status', 'completed'
  ),
  'Cron job authorization fix using Supabase built-in environment variables'
) ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();