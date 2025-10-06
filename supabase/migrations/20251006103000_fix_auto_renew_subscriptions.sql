-- Fix auto-renewal of Microsoft Graph subscriptions
-- The previous cron job was calling 'renew' without subscriptionId which always failed
-- Now using 'auto-renew' action that automatically finds and renews expiring subscriptions

-- Remove existing broken cron job
DO $$
BEGIN
    PERFORM cron.unschedule('renew-webhooks');
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Create new cron job with auto-renew action (every 12 hours)
SELECT cron.schedule(
  'auto-renew-webhooks',
  '0 */12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://hfmsimfohzeareccrnqj.supabase.co/functions/v1/microsoft-subscriptions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'action', 'auto-renew',
      'source', 'cron_auto_renew',
      'timestamp', now()::text
    ),
    timeout_milliseconds := 60000
  ) as request_id;
  $$
);

-- Add comment
COMMENT ON EXTENSION pg_cron IS 'Cron job scheduler - auto-renew-webhooks runs every 12 hours to renew Microsoft Graph subscriptions expiring within 1 hour';
