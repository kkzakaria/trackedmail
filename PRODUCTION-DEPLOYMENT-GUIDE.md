# Guide de Déploiement en Production - X-Internal-Key

**Date** : 30 septembre 2025
**Objectif** : Déployer l'authentification X-Internal-Key en production sans erreurs de permissions

---

## 🚀 Procédure de Déploiement

### Étape 1 : Générer une Clé Sécurisée

```bash
openssl rand -base64 32
```

**Exemple de sortie** : `Xk7m2pQ9vL4nR8wY3sH5tJ6bN0cZ1fG4=`

⚠️ **Important** : Copiez cette clé, vous en aurez besoin pour les étapes suivantes.

---

### Étape 2 : Déployer les Migrations

```bash
# Vérifier les migrations en attente
supabase db diff

# Pousser toutes les migrations
supabase db push
```

**Migrations à déployer** :

- `20250930131238_add_internal_key_to_maintenance_cron.sql`
- `20250930133150_update_get_cron_internal_key_use_system_config.sql`

---

### Étape 3 : Configurer Edge Functions Secrets

**Via Dashboard Supabase** :

1. Aller dans **Edge Functions** > **Manage Secrets**
2. Ajouter le secret :
   - **Nom** : `CRON_INTERNAL_KEY`
   - **Valeur** : La clé générée à l'étape 1

**Via CLI** (alternative) :

```bash
supabase secrets set CRON_INTERNAL_KEY="<votre_clé_générée>"
```

---

### Étape 4 : Configurer PostgreSQL (system_config)

**Via Dashboard Supabase** :

1. Aller dans **SQL Editor**
2. Exécuter cette requête :

```sql
INSERT INTO system_config (key, value, description) VALUES (
  'cron_internal_key',
  jsonb_build_object('key', 'VOTRE_CLE_ICI'),
  'Internal authentication key for cron jobs and inter-function calls'
) ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();
```

⚠️ **Remplacez** `VOTRE_CLE_ICI` par la même clé générée à l'étape 1.

---

### Étape 5 : Vérifier la Configuration

**Test 1 : Vérifier la fonction get_cron_internal_key()**

```sql
SELECT get_cron_internal_key();
```

**Résultat attendu** : Doit retourner votre clé (pas `dev-cron-key-12345`).

**Test 2 : Vérifier les cron jobs**

```sql
SELECT
  jobid,
  jobname,
  schedule,
  command
FROM cron.job
WHERE jobname LIKE 'followup%'
ORDER BY jobname;
```

**Résultat attendu** : 4 cron jobs avec headers X-Internal-Key.

---

### Étape 6 : Tester Manuellement les Edge Functions

**Test followup-processor** :

```bash
curl -X POST https://hfmsimfohzeareccrnqj.supabase.co/functions/v1/followup-processor \
  -H "X-Internal-Key: <votre_clé>" \
  -H "Content-Type: application/json" \
  -d '{"time_slot":"12:00","source":"manual_test"}'
```

**Test followup-maintenance** :

```bash
curl -X POST https://hfmsimfohzeareccrnqj.supabase.co/functions/v1/followup-maintenance \
  -H "X-Internal-Key: <votre_clé>" \
  -H "Content-Type: application/json" \
  -d '{"source":"manual_test"}'
```

**Test bounce-processor** :

```bash
curl -X POST https://hfmsimfohzeareccrnqj.supabase.co/functions/v1/bounce-processor \
  -H "X-Internal-Key: <votre_clé>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Résultat attendu** : Toutes les fonctions doivent retourner **200 OK**.

---

## ✅ Checklist de Validation

- [x] Migration `20250930131238` déployée
- [x] Migration `20250930133150` déployée
- [x] Secret `CRON_INTERNAL_KEY` configuré dans Edge Functions
- [x] Clé stockée dans `system_config` table
- [x] `SELECT get_cron_internal_key()` retourne la bonne clé
- [x] Les 4 cron jobs sont configurés avec X-Internal-Key
- [x] Test manuel followup-processor → 200 OK
- [x] Test manuel followup-maintenance → 200 OK
- [x] Test manuel bounce-processor → 200 OK

---

## 🔧 Dépannage

### Erreur : "permission denied to set parameter"

**Cause** : Tentative d'utiliser `ALTER DATABASE SET app.cron_internal_key`.

**Solution** : Utilisez `system_config` table à la place (déjà corrigé dans la migration `20250930133150`).

### Erreur : get_cron_internal_key() retourne "dev-cron-key-12345"

**Cause** : Clé non configurée dans `system_config`.

**Solution** : Exécutez l'étape 4 (INSERT INTO system_config).

### Erreur : 401 Unauthorized sur les Edge Functions

**Causes possibles** :

1. Secret `CRON_INTERNAL_KEY` non configuré dans Edge Functions
2. Clé différente entre Edge Functions et system_config

**Solution** : Vérifiez que la même clé est utilisée partout.

### Cron jobs ne s'exécutent pas

**Vérification** :

```sql
SELECT
  jobname,
  last_run_time,
  status
FROM cron.job_run_details
WHERE jobname LIKE 'followup%'
ORDER BY run_start DESC
LIMIT 10;
```

**Solution** : Vérifiez les logs des Edge Functions dans le dashboard.

---

## 🔒 Sécurité

### Bonnes Pratiques

- ✅ Clé d'au moins 32 caractères (générée avec `openssl rand -base64 32`)
- ✅ Clés différentes pour développement et production
- ✅ Ne JAMAIS committer la clé dans Git
- ✅ Rotation tous les 90 jours

### Rotation de Clé

Pour changer la clé tous les 90 jours :

1. Générer nouvelle clé :

   ```bash
   openssl rand -base64 32
   ```

2. Mettre à jour Edge Functions Secrets :

   ```bash
   supabase secrets set CRON_INTERNAL_KEY="<nouvelle_clé>"
   ```

3. Mettre à jour system_config :

   ```sql
   UPDATE system_config
   SET value = jsonb_build_object('key', '<nouvelle_clé>'),
       updated_at = now()
   WHERE key = 'cron_internal_key';
   ```

4. Vérifier :

   ```sql
   SELECT get_cron_internal_key();
   ```

---

## 📊 Architecture

### Ordre de Priorité pour get_cron_internal_key()

1. **system_config table** (production) ← **Recommandé**
2. **PostgreSQL settings** (`app.cron_internal_key`) ← Fallback
3. **Dev fallback** (`dev-cron-key-12345`) ← Développement local uniquement

### Flux d'Authentification

```texte
Cron Job
  ↓ (appel HTTP avec X-Internal-Key header)
Edge Function
  ↓ (validation via auth-validator.ts)
validateInternalKey()
  ↓ (compare avec CRON_INTERNAL_KEY env var)
200 OK ou 401 Unauthorized
```

### Appels Inter-Fonctions

```texte
followup-maintenance
  ↓ (appel avec X-Internal-Key)
bounce-processor
  ↓ (validation)
Traitement des bounces
```

---

## 📝 Support

En cas de problème :

1. Vérifier les logs Edge Functions : Dashboard > Edge Functions > Logs
2. Vérifier les cron jobs : `SELECT * FROM cron.job_run_details ORDER BY run_start DESC LIMIT 20;`
3. Consulter `INTERNAL-KEY-AUTH-IMPLEMENTATION.md` pour les détails techniques
