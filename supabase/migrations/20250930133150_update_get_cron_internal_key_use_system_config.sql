-- Migration: Update get_cron_internal_key() to use system_config table
-- Description: Modify the function to read from system_config instead of PostgreSQL settings
--              This solves permission issues with ALTER DATABASE SET commands

-- ===================================
-- STEP 1: Update get_cron_internal_key() function
-- ===================================

CREATE OR REPLACE FUNCTION get_cron_internal_key()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  internal_key text;
BEGIN
  -- Try to get from system_config table first (production)
  SELECT (value->>'key')::text INTO internal_key
  FROM system_config
  WHERE key = 'cron_internal_key';

  -- If found, return it
  IF internal_key IS NOT NULL THEN
    RETURN internal_key;
  END IF;

  -- Fallback: try PostgreSQL settings (if configured via ALTER DATABASE)
  BEGIN
    internal_key := current_setting('app.cron_internal_key', true);
    IF internal_key IS NOT NULL AND internal_key != '' THEN
      RETURN internal_key;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;

  -- Last fallback for local development
  RETURN 'dev-cron-key-12345';
END;
$$;

-- ===================================
-- STEP 2: Add comment
-- ===================================

COMMENT ON FUNCTION get_cron_internal_key() IS 'Retrieves the internal authentication key for cron jobs. Priority: 1) system_config table, 2) PostgreSQL settings, 3) dev fallback';

-- ===================================
-- STEP 3: Log migration completion
-- ===================================

INSERT INTO system_config (key, value, description) VALUES (
  'get_cron_internal_key_updated',
  jsonb_build_object(
    'migration_applied_at', now(),
    'version', '2.0',
    'changes', jsonb_build_array(
      'Updated get_cron_internal_key() to read from system_config table',
      'Added fallback to PostgreSQL settings for backward compatibility',
      'Solves permission issues with ALTER DATABASE SET commands'
    ),
    'status', 'completed'
  ),
  'get_cron_internal_key() function updated to use system_config'
) ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();