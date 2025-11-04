-- Migration: Fix subscription renewal cron jobs and add authentication
-- Description:
--   1. Remove legacy auto-renew-webhooks job (12h interval, no auth)
--   2. Ensure auto-renew-subscriptions exists with proper config (6h + auth)
--
-- Background: Migration 20251028093711 should have created auto-renew-subscriptions
-- but the old auto-renew-webhooks job from earlier migrations persists.

-- =====================================================
-- 1. CLEANUP LEGACY JOBS
-- =====================================================
DO $$
BEGIN
  -- Remove old auto-renew-webhooks job (from pre-20251028 migrations)
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-renew-webhooks') THEN
    PERFORM cron.unschedule('auto-renew-webhooks');
    RAISE NOTICE 'Removed legacy auto-renew-webhooks job';
  END IF;

  -- Remove auto-renew-subscriptions if it exists (we'll recreate with auth)
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-renew-subscriptions') THEN
    PERFORM cron.unschedule('auto-renew-subscriptions');
    RAISE NOTICE 'Removed auto-renew-subscriptions for recreation with auth';
  END IF;
END $$;

-- =====================================================
-- 2. CREATE PROPERLY CONFIGURED JOB
-- =====================================================
-- Schedule auto-renewal every 6 hours with X-Internal-Key authentication
-- This replaces both legacy jobs with a single secure job
SELECT cron.schedule(
  'auto-renew-subscriptions',
  '0 */6 * * *',  -- Every 6 hours as originally intended
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/microsoft-subscriptions',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_key'),
        'X-Internal-Key', get_cron_internal_key()
      ),
      body := jsonb_build_object(
        'action', 'auto-renew',
        'source', 'cron_auto_renew',
        'timestamp', now()::text
      ),
      timeout_milliseconds := 90000
    ) AS request_id;
  $$
);

-- =====================================================
-- 3. DOCUMENTATION
-- =====================================================
COMMENT ON EXTENSION pg_cron IS
  'Scheduler cron - auto-renew-subscriptions runs every 6 hours with X-Internal-Key authentication to renew expiring subscriptions';

-- Log the changes
DO $$
BEGIN
  RAISE NOTICE '=== Subscription Renewal Cron Job Fixed ===';
  RAISE NOTICE 'Job name: auto-renew-subscriptions';
  RAISE NOTICE 'Schedule: Every 6 hours (0 */6 * * *)';
  RAISE NOTICE 'Authentication: X-Internal-Key header added';
  RAISE NOTICE 'Timeout: 90 seconds';
  RAISE NOTICE 'Legacy auto-renew-webhooks job removed';
END $$;
