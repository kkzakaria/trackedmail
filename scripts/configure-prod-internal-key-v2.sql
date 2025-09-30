-- Configuration de CRON_INTERNAL_KEY en production (VERSION 2)
-- À exécuter dans le SQL Editor du dashboard Supabase
-- Cette version utilise system_config au lieu de ALTER DATABASE

-- ========================================
-- ÉTAPE 1 : Générer une clé sécurisée (local)
-- ========================================
-- Exécutez localement : openssl rand -base64 32
-- Copiez la clé générée

-- ========================================
-- ÉTAPE 2 : Stocker la clé dans system_config
-- ========================================
-- Remplacez 'VOTRE_CLE_SECURISEE_ICI' par la clé générée
INSERT INTO system_config (key, value, description) VALUES (
  'cron_internal_key',
  jsonb_build_object('key', 'VOTRE_CLE_SECURISEE_ICI'),
  'Internal authentication key for cron jobs and inter-function calls'
) ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();

-- ========================================
-- ÉTAPE 3 : Vérifier le stockage
-- ========================================
SELECT key, value, description, created_at, updated_at
FROM system_config
WHERE key = 'cron_internal_key';

-- ========================================
-- ÉTAPE 4 : Modifier la fonction get_cron_internal_key()
-- ========================================
-- Cette fonction doit lire depuis system_config au lieu de pg_settings
CREATE OR REPLACE FUNCTION get_cron_internal_key()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  internal_key text;
BEGIN
  -- Essayer d'abord depuis system_config
  SELECT (value->>'key')::text INTO internal_key
  FROM system_config
  WHERE key = 'cron_internal_key';

  -- Si trouvé, retourner
  IF internal_key IS NOT NULL THEN
    RETURN internal_key;
  END IF;

  -- Fallback : essayer depuis les variables d'environnement PostgreSQL
  BEGIN
    internal_key := current_setting('app.cron_internal_key', true);
    IF internal_key IS NOT NULL AND internal_key != '' THEN
      RETURN internal_key;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;

  -- Dernier fallback pour développement local
  RETURN 'dev-cron-key-12345';
END;
$$;

-- ========================================
-- ÉTAPE 5 : Tester la fonction
-- ========================================
SELECT get_cron_internal_key();

-- ========================================
-- ÉTAPE 6 : Vérifier les cron jobs
-- ========================================
SELECT
  jobid,
  jobname,
  schedule,
  command
FROM cron.job
WHERE jobname LIKE 'followup%'
ORDER BY jobname;

-- ========================================
-- Notes de sécurité
-- ========================================
-- 1. La même clé doit être configurée dans Edge Functions Secrets
-- 2. Dashboard > Edge Functions > Manage Secrets
-- 3. Ajouter : CRON_INTERNAL_KEY=<même_clé>
-- 4. Ne JAMAIS committer cette clé dans Git
-- 5. Rotation recommandée tous les 90 jours
-- 6. Pour rotation : UPDATE system_config SET value = jsonb_build_object('key', 'nouvelle_clé') WHERE key = 'cron_internal_key';