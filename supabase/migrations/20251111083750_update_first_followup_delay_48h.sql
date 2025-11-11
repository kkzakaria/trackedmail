-- Migration: Update First Followup Delay to 48 hours
-- Description: Change the minimum delay for the first followup from 4h to 48h (2 days)
--
-- Rationale: First followup should be sent 48 hours after the original email
-- if no response has been received, giving recipients more time to respond.
--
-- Changes:
--   1. Update system_config: min_delay_hours.followup_1 from 4 to 48
--   2. Update followup_templates: delay_hours for followup #1 from 4 to 48
--
-- Impact: Only affects NEW followups scheduled after this migration.
-- Existing scheduled followups remain unchanged.

-- =====================================================
-- STEP 1: Update system configuration
-- =====================================================

UPDATE system_config
SET
  value = jsonb_set(
    value,
    '{min_delay_hours,followup_1}',
    '48'::jsonb
  ),
  updated_at = now()
WHERE key = 'followup_settings';

-- =====================================================
-- STEP 2: Update followup template #1
-- =====================================================

UPDATE followup_templates
SET
  delay_hours = 48,
  updated_at = now()
WHERE followup_number = 1;

-- =====================================================
-- STEP 3: Log the migration
-- =====================================================

INSERT INTO system_config (key, value, description) VALUES (
  'migration_first_followup_48h',
  jsonb_build_object(
    'migrated_at', now(),
    'previous_delay_hours', 4,
    'new_delay_hours', 48,
    'rationale', 'Give recipients 48 hours to respond before first followup',
    'version', '1.0'
  ),
  'Migration: First followup delay updated to 48 hours'
) ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();

-- =====================================================
-- STEP 4: Verification query (commented - for manual check)
-- =====================================================

-- Verify the changes:
-- SELECT
--   key,
--   value->'min_delay_hours'->'followup_1' as first_followup_delay_hours
-- FROM system_config
-- WHERE key = 'followup_settings';

-- SELECT
--   followup_number,
--   name,
--   delay_hours
-- FROM followup_templates
-- WHERE followup_number = 1;
