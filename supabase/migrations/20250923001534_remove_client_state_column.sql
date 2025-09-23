-- Migration: Remove client_state column from webhook_subscriptions
--
-- The client_state is already available via MICROSOFT_WEBHOOK_SECRET environment variable
-- No need to duplicate this sensitive information in database
--
-- Benefits:
-- - Single source of truth (environment variables)
-- - Simplified secret rotation
-- - Reduced attack surface
-- - DRY principle compliance

-- Remove client_state column from webhook_subscriptions table
ALTER TABLE webhook_subscriptions DROP COLUMN IF EXISTS client_state;

-- Add comment to document the change
COMMENT ON TABLE webhook_subscriptions IS
'Microsoft Graph webhook subscriptions management table.
The client_state is managed via MICROSOFT_WEBHOOK_SECRET environment variable for security reasons.';