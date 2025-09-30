-- Migration: Add X-Internal-Key authentication to followup-maintenance cron job
-- Description: Update the maintenance cron job to use X-Internal-Key header for authentication

-- ===================================
-- STEP 1: Remove existing maintenance cron job
-- ===================================

DO $$
BEGIN
    PERFORM cron.unschedule('followup-maintenance');
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- ===================================
-- STEP 2: Recreate maintenance cron job with X-Internal-Key authentication
-- ===================================

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
-- STEP 3: Log migration completion
-- ===================================

INSERT INTO system_config (key, value, description) VALUES (
  'maintenance_cron_auth_updated',
  jsonb_build_object(
    'migration_applied_at', now(),
    'version', '1.0',
    'changes', jsonb_build_array(
      'Updated followup-maintenance cron job with X-Internal-Key authentication',
      'Maintenance function now requires authentication for all calls'
    ),
    'status', 'completed'
  ),
  'Maintenance cron job updated with X-Internal-Key authentication'
) ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();