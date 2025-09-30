-- Migration: Simplify Cron Job Authentication
-- Description: Remove dependency on PostgreSQL custom settings, use internal key authentication
--
-- Benefits:
-- - No need to configure supabase.service_role_key in PostgreSQL
-- - Simpler cron job configuration
-- - Works out-of-the-box without manual setup
-- - Uses shared secret (CRON_INTERNAL_KEY) between PostgreSQL and Edge Functions

-- ===================================
-- STEP 1: Remove existing cron jobs
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
-- STEP 2: Store internal key in system_config
-- ===================================

-- Store the CRON_INTERNAL_KEY for reference (DO NOT expose in production logs)
INSERT INTO system_config (key, value, description) VALUES (
  'cron_internal_key_config',
  jsonb_build_object(
    'configured_at', now(),
    'method', 'X-Internal-Key header',
    'note', 'The actual key must be set as CRON_INTERNAL_KEY environment variable in Edge Functions'
  ),
  'Cron job authentication uses internal key instead of service_role_key'
) ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();

-- ===================================
-- STEP 3: Create function to get internal key securely
-- ===================================

-- This function retrieves the CRON_INTERNAL_KEY from environment
-- In production, set this via Supabase Dashboard > Project Settings > Edge Functions > Secrets
CREATE OR REPLACE FUNCTION get_cron_internal_key()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  internal_key text;
BEGIN
  -- Try to get from environment variable
  internal_key := current_setting('app.cron_internal_key', true);

  -- Fallback to a default key for development (MUST be changed in production)
  IF internal_key IS NULL OR internal_key = '' THEN
    internal_key := 'dev-cron-key-12345';
    RAISE WARNING 'Using default CRON_INTERNAL_KEY - MUST be configured in production!';
  END IF;

  RETURN internal_key;
END;
$$;

-- ===================================
-- STEP 4: Recreate cron jobs with simplified authentication
-- ===================================

-- Morning slot: 7h00 (Monday to Friday)
SELECT cron.schedule(
  'followup-7h',
  '0 7 * * 1-5',
  $$
  SELECT net.http_post(
    url := 'https://hfmsimfohzeareccrnqj.supabase.co/functions/v1/followup-processor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Internal-Key', get_cron_internal_key()
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
    url := 'https://hfmsimfohzeareccrnqj.supabase.co/functions/v1/followup-processor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Internal-Key', get_cron_internal_key()
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
    url := 'https://hfmsimfohzeareccrnqj.supabase.co/functions/v1/followup-processor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Internal-Key', get_cron_internal_key()
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
    url := 'https://hfmsimfohzeareccrnqj.supabase.co/functions/v1/followup-maintenance',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Internal-Key', get_cron_internal_key()
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
-- STEP 5: Grant execute permissions
-- ===================================

GRANT EXECUTE ON FUNCTION get_cron_internal_key() TO postgres;
GRANT EXECUTE ON FUNCTION get_cron_internal_key() TO service_role;

-- ===================================
-- STEP 6: Log migration completion
-- ===================================

INSERT INTO system_config (key, value, description) VALUES (
  'cron_authentication_simplified',
  jsonb_build_object(
    'migration_applied_at', now(),
    'version', '2.0',
    'changes', jsonb_build_array(
      'Removed dependency on supabase.service_role_key PostgreSQL setting',
      'Implemented X-Internal-Key header authentication',
      'Added get_cron_internal_key() function for secure key retrieval',
      'Simplified cron job configuration - works out-of-the-box'
    ),
    'production_setup', jsonb_build_object(
      'step_1', 'Set CRON_INTERNAL_KEY in Supabase Dashboard > Project Settings > Edge Functions > Secrets',
      'step_2', 'Set app.cron_internal_key in PostgreSQL via Dashboard > Database > Custom Config',
      'step_3', 'Both values MUST be identical and cryptographically secure (32+ chars)'
    ),
    'status', 'completed'
  ),
  'Simplified cron job authentication using internal key instead of service_role_key'
) ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();