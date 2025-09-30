-- Vérification de la configuration en production
-- À exécuter dans le SQL Editor du dashboard Supabase

-- 1. Vérifier si la clé est dans system_config
SELECT
  key,
  value,
  description,
  created_at,
  updated_at
FROM system_config
WHERE key = 'cron_internal_key';

-- 2. Tester la fonction get_cron_internal_key()
SELECT get_cron_internal_key() as internal_key;

-- 3. Vérifier les cron jobs
SELECT
  jobid,
  jobname,
  schedule,
  command
FROM cron.job
WHERE jobname LIKE 'followup%'
ORDER BY jobname;

-- 4. Vérifier les dernières exécutions des cron jobs
SELECT
  jobname,
  run_start,
  run_end,
  status,
  return_message
FROM cron.job_run_details
WHERE jobname LIKE 'followup%'
ORDER BY run_start DESC
LIMIT 10;