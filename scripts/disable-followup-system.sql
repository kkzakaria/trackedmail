-- Script to disable the followup system in production
-- This will prevent any new followups from being scheduled

UPDATE system_config
SET value = jsonb_set(
  value::jsonb,
  '{enabled}',
  'false'::jsonb
)
WHERE key = 'followup_settings';

-- Verify the change
SELECT key, value FROM system_config WHERE key = 'followup_settings';

-- Optional: Cancel all scheduled followups that haven't been sent yet
-- Uncomment the lines below if you want to cancel pending followups
-- UPDATE followups
-- SET status = 'cancelled',
--     updated_at = now()
-- WHERE status = 'scheduled';