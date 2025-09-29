-- Migration: Setup Fixed Schedule Followup System
-- Description: Configure 3 daily time slots (7h, 12h, 16h) with 4 followups max in 48h and 2 max per day

-- ===================================
-- STEP 1: Remove existing cron jobs
-- ===================================

DO $$
BEGIN
    PERFORM cron.unschedule('schedule-followups');
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    PERFORM cron.unschedule('send-followups');
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- ===================================
-- STEP 2: Add new email status
-- ===================================

-- Add new status for emails requiring manual handling (4 followups without response)
-- Update the CHECK constraint to include the new status
ALTER TABLE tracked_emails DROP CONSTRAINT IF EXISTS tracked_emails_status_check;
ALTER TABLE tracked_emails ADD CONSTRAINT tracked_emails_status_check
    CHECK (status = ANY (ARRAY[
        'pending'::text,
        'responded'::text,
        'stopped'::text,
        'max_reached'::text,
        'bounced'::text,
        'expired'::text,
        'requires_manual_handling'::text
    ]));

-- ===================================
-- STEP 3: Update system configuration
-- ===================================

-- Update followup settings for new system
UPDATE system_config
SET value = jsonb_build_object(
    'enabled', true,
    'max_followups', 4,                    -- 4 followups instead of 3
    'max_per_day', 2,                      -- Maximum 2 followups per email per day
    'total_timeframe_hours', 48,           -- Total timeframe: 48 hours
    'min_delay_hours', jsonb_build_object( -- Minimum delays between followups
        'followup_1', 4,                   -- 4h after original email
        'followup_2', 6,                   -- 6h after followup 1
        'followup_3', 12,                  -- 12h after followup 2
        'followup_4', 12                   -- 12h after followup 3
    ),
    'time_slots', jsonb_build_array('07:00', '12:00', '16:00'), -- Fixed time slots
    'stop_on_bounce', true,
    'stop_after_days', 30,
    'stop_on_unsubscribe', true
),
description = 'Fixed schedule followup system: 4 followups max in 48h, 2 per day max, time slots 7h/12h/16h'
WHERE key = 'followup_settings';

-- ===================================
-- STEP 4: Create new cron jobs for fixed time slots
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
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
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
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
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
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
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

-- ===================================
-- STEP 5: Add maintenance cron job (missing from current setup)
-- ===================================

-- Daily maintenance: 2h00 (Monday to Friday) - Off-peak hours
SELECT cron.schedule(
  'followup-maintenance',
  '0 2 * * 1-5',
  $$
  SELECT net.http_post(
    url := 'https://hfmsimfohzeareccrnqj.supabase.co/functions/v1/followup-maintenance',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
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
-- STEP 6: Add 4th followup template
-- ===================================

-- Insert the 4th followup template (Derniere chance)
INSERT INTO followup_templates (
    name,
    subject,
    body,
    followup_number,
    delay_hours,
    is_active,
    version,
    available_variables
) VALUES (
    'Relance 4 - Derniere Chance',
    'Derniere chance: {{objet_original}}',
    'Bonjour {{destinataire_nom}},

Ceci est ma derniere relance concernant {{objet_original}}.

Malgre mes precedents messages, je n''ai pas eu de retour de votre part. Je comprends que vous puissiez etre tres occupe(e).

Si ce sujet ne vous interesse plus ou si vous preferez ne plus recevoir de relances, merci de me le faire savoir brievement.

Dans le cas contraire, j''apprecierais vraiment un retour de votre part, meme bref.

Merci de votre comprehension.

Cordialement,
{{expediteur_nom}}',
    4,                          -- 4th followup
    12,                         -- 12h minimum delay
    true,                       -- Active
    1,                          -- Version 1
    ARRAY[
        'destinataire_nom',
        'destinataire_entreprise',
        'objet_original',
        'date_envoi_original',
        'numero_relance',
        'jours_depuis_envoi',
        'expediteur_nom',
        'expediteur_email'
    ]
) ON CONFLICT (followup_number, is_active) DO UPDATE SET
    name = EXCLUDED.name,
    subject = EXCLUDED.subject,
    body = EXCLUDED.body,
    delay_hours = EXCLUDED.delay_hours,
    is_active = EXCLUDED.is_active,
    updated_at = now();

-- ===================================
-- STEP 7: Log migration completion
-- ===================================

INSERT INTO system_config (key, value, description) VALUES (
  'fixed_schedule_migration',
  jsonb_build_object(
    'migrated_at', now(),
    'version', '1.0',
    'changes', jsonb_build_object(
      'crons_removed', jsonb_build_array('schedule-followups', 'send-followups'),
      'crons_added', jsonb_build_array('followup-7h', 'followup-12h', 'followup-16h', 'followup-maintenance'),
      'new_status', 'requires_manual_handling',
      'max_followups', 4,
      'time_slots', jsonb_build_array('07:00', '12:00', '16:00')
    )
  ),
  'Migration to fixed schedule followup system completed'
) ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();

-- ===================================
-- STEP 8: Update existing followup templates delays
-- ===================================

-- Update existing templates to match new delay system
UPDATE followup_templates SET delay_hours = 4 WHERE followup_number = 1;  -- 4h minimum
UPDATE followup_templates SET delay_hours = 6 WHERE followup_number = 2;  -- 6h minimum
UPDATE followup_templates SET delay_hours = 12 WHERE followup_number = 3; -- 12h minimum