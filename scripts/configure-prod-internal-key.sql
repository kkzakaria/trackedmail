-- Configuration de CRON_INTERNAL_KEY en production
-- À exécuter dans le SQL Editor du dashboard Supabase

-- ========================================
-- ÉTAPE 1 : Générer une clé sécurisée
-- ========================================
-- Exécutez localement : openssl rand -base64 32
-- Copiez la clé générée

-- ========================================
-- ÉTAPE 2 : Configurer le paramètre PostgreSQL
-- ========================================
-- Remplacez 'VOTRE_CLE_SECURISEE_ICI' par la clé générée
ALTER DATABASE postgres SET app.cron_internal_key = 'VOTRE_CLE_SECURISEE_ICI';

-- ========================================
-- ÉTAPE 3 : Recharger la configuration
-- ========================================
SELECT pg_reload_conf();

-- ========================================
-- ÉTAPE 4 : Vérifier la configuration
-- ========================================
SELECT name, setting
FROM pg_settings
WHERE name = 'app.cron_internal_key';

-- ========================================
-- ÉTAPE 5 : Tester la fonction get_cron_internal_key()
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