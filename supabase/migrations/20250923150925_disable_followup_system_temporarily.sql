-- Migration: Disable followup system temporarily
-- Description: Adds 'enabled: false' flag to followup_settings to temporarily disable the followup system
-- This prevents automatic followup scheduling and sending while the system is being finalized

-- Update followup settings to add enabled flag (disabled)
UPDATE system_config
SET value = '{"enabled": false, "max_followups": 3, "stop_on_bounce": true, "stop_after_days": 30, "stop_on_unsubscribe": true, "default_interval_hours": 4}'
WHERE key = 'followup_settings';

-- Add comment about temporary disabling
COMMENT ON TABLE system_config IS 'System configuration including followup_settings. The "enabled" flag in followup_settings can be used to temporarily disable the followup system.';