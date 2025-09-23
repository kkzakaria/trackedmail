-- Migration: Update followup intervals to 4-hour pattern
-- Description: Updates followup templates to use 4-hour intervals instead of the previous 48h/120h/168h pattern
-- This aligns with the new requirement: every 4 hours after sending, considering working hours

-- Update followup templates with new 4-hour intervals
UPDATE followup_templates SET
  name = 'Relance 1 - Première tentative (4h)',
  delay_hours = 4
WHERE followup_number = 1;

UPDATE followup_templates SET
  name = 'Relance 2 - Deuxième tentative (8h)',
  delay_hours = 8
WHERE followup_number = 2;

UPDATE followup_templates SET
  name = 'Relance 3 - Dernière tentative (12h)',
  delay_hours = 12
WHERE followup_number = 3;

-- Update system configuration to reflect new default interval
UPDATE system_config
SET value = '{"max_followups": 3, "stop_on_bounce": true, "stop_after_days": 30, "stop_on_unsubscribe": true, "default_interval_hours": 4}'
WHERE key = 'followup_settings';

-- Add a comment explaining the interval pattern
COMMENT ON TABLE followup_templates IS 'Templates for automated followup emails. Uses 4-hour intervals: 1st at 4h, 2nd at 8h, 3rd at 12h after initial send, respecting working hours (7h-18h UTC, Mon-Fri).';