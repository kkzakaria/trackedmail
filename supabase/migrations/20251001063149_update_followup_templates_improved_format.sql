-- Migration: Update Followup Templates to Improved Format
-- Description: Simplify templates by removing original message content and using structured reference format
-- Changes:
--   - Remove {{original_message}} variable usage
--   - Add date and subject reference instead
--   - Use bold formatting for subject with <strong> HTML tag
--   - Keep generic "Monsieur/Madame" greeting for multiple recipients
--   - More professional and concise tone

-- ===================================
-- STEP 1: Update Template 1 (RELANCE 1)
-- ===================================

UPDATE followup_templates
SET
    name = 'Relance 1 - Rappel Initial',
    subject = 'RELANCE 1 {{original_subject}}',
    body = 'Bonjour Monsieur/Madame,

Je me permets de revenir vers vous concernant mon email du <strong>{{date_envoi_original}}</strong> au sujet de : <strong>{{original_subject}}</strong>.

Avez-vous eu l''occasion d''en prendre connaissance ?

Merci de nous revenir sur ce sujet.

Cordialement',
    updated_at = now()
WHERE followup_number = 1 AND is_active = true;

-- ===================================
-- STEP 2: Update Template 2 (RELANCE 2)
-- ===================================

UPDATE followup_templates
SET
    name = 'Relance 2 - Suivi',
    subject = 'RELANCE 2 {{original_subject}}',
    body = 'Bonjour Monsieur/Madame,

Je me permets de revenir vers vous concernant mon email du <strong>{{date_envoi_original}}</strong> au sujet de : <strong>{{original_subject}}</strong>.

Avez-vous eu l''occasion d''en prendre connaissance ?

Merci de nous revenir sur ce sujet.

Cordialement',
    updated_at = now()
WHERE followup_number = 2 AND is_active = true;

-- ===================================
-- STEP 3: Update Template 3 (RELANCE 3)
-- ===================================

UPDATE followup_templates
SET
    name = 'Relance 3 - Relance Ferme',
    subject = 'RELANCE 3 {{original_subject}}',
    body = 'Bonjour Monsieur/Madame,

Je me permets de revenir vers vous concernant mon email du <strong>{{date_envoi_original}}</strong> au sujet de : <strong>{{original_subject}}</strong>.

Avez-vous eu l''occasion d''en prendre connaissance ?

Merci de nous revenir sur ce sujet.

Cordialement',
    updated_at = now()
WHERE followup_number = 3 AND is_active = true;

-- ===================================
-- STEP 4: Update Template 4 (RELANCE 4)
-- ===================================

UPDATE followup_templates
SET
    name = 'Relance 4 - Derniere Chance',
    subject = 'RELANCE 4 {{original_subject}}',
    body = 'Bonjour Monsieur/Madame,

Je me permets de revenir vers vous concernant mon email du <strong>{{date_envoi_original}}</strong> au sujet de : <strong>{{original_subject}}</strong>.

Avez-vous eu l''occasion d''en prendre connaissance ?

Merci de nous revenir sur ce sujet.

Cordialement',
    updated_at = now()
WHERE followup_number = 4 AND is_active = true;

-- ===================================
-- STEP 5: Update available_variables
-- ===================================

-- Remove original_message from available variables as it's no longer used
UPDATE followup_templates
SET
    available_variables = ARRAY[
        'destinataire_nom',
        'destinataire_entreprise',
        'objet_original',
        'original_subject',
        'date_envoi_original',
        'numero_relance',
        'jours_depuis_envoi',
        'expediteur_nom',
        'expediteur_email'
    ],
    updated_at = now()
WHERE is_active = true;

-- ===================================
-- STEP 6: Log migration completion
-- ===================================

INSERT INTO system_config (key, value, description) VALUES (
  'template_improved_format_migration',
  jsonb_build_object(
    'migrated_at', now(),
    'version', '2.0',
    'changes', jsonb_build_object(
      'original_message_removed', true,
      'structured_reference_added', true,
      'subject_bold_formatting', true,
      'date_bold_formatting', true,
      'generic_greeting_preserved', 'Monsieur/Madame',
      'professional_tone_enhanced', true,
      'templates_updated', 4,
      'available_variables_count', 9
    )
  ),
  'Migration to improved followup template format completed'
) ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = now();
