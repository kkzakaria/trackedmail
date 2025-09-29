-- Migration: Update Followup Templates to Unified Format
-- Description: Standardize all followup templates with unified subject format and identical body content

-- ===================================
-- STEP 1: Update Template 1 (RELANCE 1)
-- ===================================

UPDATE followup_templates
SET
    name = 'Relance 1 - Rappel Initial',
    subject = 'RELANCE 1 {{original_subject}}',
    body = 'Bonjour Monsieur/Madame,

J''espere que vous allez bien. Je me permets de revenir vers vous concernant mon email precedent.

{{original_message}}

N''hesitez pas si vous avez des questions ou des points a reviser.

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

J''espere que vous allez bien. Je me permets de revenir vers vous concernant mon email precedent.

{{original_message}}

N''hesitez pas si vous avez des questions ou des points a reviser.

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

J''espere que vous allez bien. Je me permets de revenir vers vous concernant mon email precedent.

{{original_message}}

N''hesitez pas si vous avez des questions ou des points a reviser.

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

J''espere que vous allez bien. Je me permets de revenir vers vous concernant mon email precedent.

{{original_message}}

N''hesitez pas si vous avez des questions ou des points a reviser.

Cordialement',
    updated_at = now()
WHERE followup_number = 4 AND is_active = true;

-- ===================================
-- STEP 5: Update available_variables for all templates
-- ===================================

-- Ensure all templates have consistent available variables
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
        'expediteur_email',
        'original_message'
    ],
    updated_at = now()
WHERE is_active = true;

-- ===================================
-- STEP 6: Log migration completion
-- ===================================

INSERT INTO system_config (key, value, description) VALUES (
  'template_unification_migration',
  jsonb_build_object(
    'migrated_at', now(),
    'version', '1.0',
    'changes', jsonb_build_object(
      'unified_subject_format', 'RELANCE X {{original_subject}}',
      'unified_body_content', true,
      'greeting_standardized', 'Monsieur/Madame',
      'sender_signature_removed', true,
      'templates_updated', 4,
      'available_variables_count', 10
    )
  ),
  'Migration to unified followup template format completed'
) ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = now();