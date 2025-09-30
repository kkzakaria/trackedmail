# Configuration des Cron Jobs en Production

Ce guide explique comment configurer les cron jobs pour l'envoi automatique de relances en production.

## ✅ Architecture Simplifiée

L'architecture utilise une **authentification par clé interne** qui ne nécessite **aucune configuration PostgreSQL custom**.

### Flux d'authentification

```texte
PostgreSQL Cron Job
    ↓
    X-Internal-Key: <secret>
    ↓
Edge Function (followup-processor)
    ↓
    Validation de la clé
    ↓
    Traitement des relances
```

## 📋 Configuration en Production

### Étape 1 : Déployer les migrations

Les migrations suivantes ont été créées :

- ✅ `20250930120917_fix_cron_authorization_token.sql` - Correction initiale
- ✅ `20250930122249_simplify_cron_authentication.sql` - Simplification (recommandée)

Déployez la migration via Supabase CLI ou Dashboard :

```bash
supabase db push
```

### Étape 2 : Configurer la clé secrète

#### 2.1 Générer une clé sécurisée

Générez une clé cryptographiquement sécurisée (32+ caractères) :

```bash
# Linux/Mac
openssl rand -base64 32

# Windows PowerShell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

Exemple de clé : `kJ8mN2pQ5rT9wX3yB6eH1jK4lM7nP0sV2uA5cD8fG1h`

#### 2.2 Configurer dans Edge Functions

1. Allez dans **Supabase Dashboard**
2. **Edge Functions** → **Settings** → **Secrets**
3. Ajoutez la variable :

   ```texte
   CRON_INTERNAL_KEY=<votre_clé_générée>
   ```

#### 2.3 Configurer dans PostgreSQL

1. Allez dans **Supabase Dashboard**
2. **Database** → **Database Settings** → **Custom Postgres Configuration**
3. Ajoutez :

   ```texte
   app.cron_internal_key = '<même_clé_que_ci-dessus>'
   ```

4. Redémarrez la base de données ou exécutez :

   ```sql
   SELECT pg_reload_conf();
   ```

### Étape 3 : Vérifier la configuration

#### Test 1 : Vérifier la clé PostgreSQL

```sql
-- Doit retourner votre clé (masquée pour sécurité)
SELECT
  CASE
    WHEN get_cron_internal_key() IS NOT NULL
    THEN '✅ Clé configurée'
    ELSE '❌ Clé non configurée'
  END as status;
```

#### Test 2 : Tester un cron job manuellement

```sql
-- Simuler un appel de cron job
SELECT net.http_post(
  url := 'https://hfmsimfohzeareccrnqj.supabase.co/functions/v1/followup-processor',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'X-Internal-Key', get_cron_internal_key()
  ),
  body := jsonb_build_object(
    'time_slot', '12:00',
    'source', 'manual_test',
    'timestamp', now()::text
  ),
  timeout_milliseconds := 120000
) as request_id;
```

#### Test 3 : Vérifier les logs Edge Functions

1. Allez dans **Supabase Dashboard**
2. **Edge Functions** → **followup-processor** → **Logs**
3. Cherchez :
   - ✅ Statut **200 OK** = Succès
   - ❌ Statut **401 Unauthorized** = Problème d'authentification

### Étape 4 : Vérifier les cron jobs actifs

```sql
-- Liste des cron jobs configurés
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname LIKE 'followup%'
ORDER BY jobname;
```

Résultat attendu :

| jobid | jobname              | schedule      | active |
| ----- | -------------------- | ------------- | ------ |
| X     | followup-7h          | 0 7 \*\* 1-5  | t      |
| X     | followup-12h         | 0 12 \*\* 1-5 | t      |
| X     | followup-16h         | 0 16 \*\* 1-5 | t      |
| X     | followup-maintenance | 0 2 \*\* 1-5  | t      |

## 🔒 Sécurité

### Bonnes pratiques

✅ **DO:**

- Utiliser une clé différente pour développement et production
- Clé d'au moins 32 caractères
- Inclure lettres majuscules, minuscules, chiffres, symboles
- Rotation de la clé tous les 90 jours

❌ **DON'T:**

- Ne jamais commiter la clé dans Git
- Ne pas utiliser `dev-cron-key-12345` en production
- Ne pas partager la clé publiquement

### En cas de compromission

Si la clé est compromise :

1. Générez une nouvelle clé
2. Mettez à jour dans Edge Functions Secrets
3. Mettez à jour dans PostgreSQL Custom Config
4. Redémarrez la base : `SELECT pg_reload_conf();`

## 🧪 Tests

### Test en développement

```bash
# Avec authentification valide
curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/followup-processor' \
  --header 'X-Internal-Key: dev-cron-key-12345' \
  --header 'Content-Type: application/json' \
  --data '{"time_slot": "12:00", "source": "test"}'

# Résultat attendu: 200 OK
```

### Test en production

```bash
# Avec authentification valide
curl -i --location --request POST 'https://hfmsimfohzeareccrnqj.supabase.co/functions/v1/followup-processor' \
  --header 'X-Internal-Key: <votre_clé_production>' \
  --header 'Content-Type: application/json' \
  --data '{"time_slot": "12:00", "source": "manual_test"}'

# Résultat attendu: 200 OK
```

## 📊 Monitoring

### Vérifier l'historique des cron jobs

```sql
-- Historique des exécutions (si extension pg_cron configurée avec logging)
SELECT
  jobid,
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname LIKE 'followup%')
ORDER BY start_time DESC
LIMIT 10;
```

### Vérifier les logs Edge Functions

```sql
-- Récupérer les statistiques des dernières 24h
SELECT
  value->>'time_slot' as time_slot,
  value->>'emails_analyzed' as emails_analyzed,
  value->>'followups_sent' as followups_sent,
  value->>'followups_failed' as followups_failed
FROM system_config
WHERE key LIKE 'followup_stats_%'
  AND updated_at > now() - interval '24 hours'
ORDER BY updated_at DESC;
```

## 🆘 Troubleshooting

### Problème : 401 Unauthorized

**Cause :** Clé mal configurée ou manquante

**Solution :**

1. Vérifier que `CRON_INTERNAL_KEY` est définie dans Edge Functions Secrets
2. Vérifier que `app.cron_internal_key` est définie dans PostgreSQL
3. Les deux clés doivent être **identiques**

### Problème : Les cron jobs ne s'exécutent pas

**Diagnostic :**

```sql
-- Vérifier que les cron jobs sont actifs
SELECT * FROM cron.job WHERE jobname LIKE 'followup%';

-- Vérifier les erreurs récentes
SELECT * FROM cron.job_run_details
WHERE status = 'failed'
ORDER BY start_time DESC
LIMIT 5;
```

**Solution :**

- Vérifier les horaires (timezone UTC)
- Vérifier que le système de relances est activé : `SELECT value->>'enabled' FROM system_config WHERE key = 'followup_settings';`

### Problème : Timeout

**Cause :** Trop d'emails à traiter

**Solution :**

- Augmenter `timeout_milliseconds` dans les cron jobs (max 180000 = 3 min)
- Optimiser les requêtes de sélection des emails éligibles
- Diviser le traitement en plusieurs lots

## 📝 Notes

- Les cron jobs s'exécutent du lundi au vendredi (1-5)
- Horaires en UTC : 7h, 12h, 16h pour les relances, 2h pour la maintenance
- Mode développement : Les emails réels ne sont PAS envoyés si `ALLOW_REAL_EMAILS=false`
