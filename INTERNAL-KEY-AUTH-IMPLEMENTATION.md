# Implémentation X-Internal-Key pour les Edge Functions

## ✅ Résumé de l'implémentation

**Date** : 30 septembre 2025
**Objectif** : Sécuriser toutes les Edge Functions appelées par les cron jobs avec une authentification `X-Internal-Key`

---

## 🎯 Fonctions protégées

### 1. **followup-processor** ✅

- **Appelée par** : Cron jobs `followup-7h`, `followup-12h`, `followup-16h`
- **Authentification** : X-Internal-Key OU Bearer token
- **Tests** : ✅ Passé (200 avec auth, 401 sans auth)

### 2. **followup-maintenance** ✅

- **Appelée par** : Cron job `followup-maintenance`
- **Authentification** : X-Internal-Key OU Bearer token
- **Tests** : ✅ Passé (200 avec auth, 401 sans auth)

### 3. **bounce-processor** ✅

- **Appelée par** : `followup-maintenance` + potentiellement cron
- **Authentification** : X-Internal-Key OU Bearer token
- **Tests** : ✅ Passé (200 avec auth, 401 sans auth)

---

## 📦 Fichiers créés/modifiés

### Nouveau fichier : Module partagé d'authentification

**Fichier** : `supabase/functions/_shared/auth-validator.ts`

```typescript
export function validateInternalKey(req: Request): boolean;
export function unauthorizedResponse(): Response;
```

### Fonctions modifiées

1. `supabase/functions/followup-processor/index.ts`
   - Remplacé fonction locale par fonction partagée
2. `supabase/functions/followup-maintenance/index.ts`
   - Ajout authentification au début du handler
   - Mise à jour appel à bounce-processor avec X-Internal-Key
3. `supabase/functions/bounce-processor/index.ts`
   - Ajout authentification au début du handler

### Migrations SQL

1. **`supabase/migrations/20250930131238_add_internal_key_to_maintenance_cron.sql`**
   - Mise à jour cron job `followup-maintenance` avec header `X-Internal-Key`

2. **`supabase/migrations/20250930133150_update_get_cron_internal_key_use_system_config.sql`**
   - Modification de `get_cron_internal_key()` pour lire depuis `system_config`
   - Résout le problème de permissions avec `ALTER DATABASE SET`
   - Ordre de priorité : system_config → PostgreSQL settings → dev fallback

---

## 🔐 Méthodes d'authentification supportées

### Option 1 : Bearer Token (service_role_key)

```bash
curl -H "Authorization: Bearer <service_role_key>" ...
```

### Option 2 : X-Internal-Key (recommandée pour cron jobs)

```bash
curl -H "X-Internal-Key: <cron_internal_key>" ...
```

---

## ⚙️ Configuration requise

### Développement local

Variable dans `.env.local` :

```bash
CRON_INTERNAL_KEY='dev-cron-key-12345'
```

### Production

**Étape 1** : Générer une clé sécurisée

```bash
openssl rand -base64 32
```

**Étape 2** : Configurer dans Supabase Dashboard

1. **Edge Functions Secrets**

   Dashboard > Edge Functions > Manage Secrets

   ```texte
   CRON_INTERNAL_KEY=<clé_générée>
   ```

2. **PostgreSQL - Stocker dans system_config**

   Dashboard > SQL Editor

   ```sql
   INSERT INTO system_config (key, value, description) VALUES (
     'cron_internal_key',
     jsonb_build_object('key', 'VOTRE_CLE_ICI'),
     'Internal authentication key for cron jobs'
   ) ON CONFLICT (key) DO UPDATE SET
     value = EXCLUDED.value,
     updated_at = now();
   ```

3. **Vérifier la configuration**

   ```sql
   SELECT get_cron_internal_key();
   ```

---

## 🧪 Tests effectués

### Test 1 : Authentification valide (X-Internal-Key)

```bash
curl -X POST http://127.0.0.1:54321/functions/v1/followup-processor \
  -H "X-Internal-Key: dev-cron-key-12345" \
  -H "Content-Type: application/json" \
  -d '{"time_slot":"12:00"}'
```

**Résultat** : ✅ 200 OK

### Test 2 : Authentification valide (Bearer)

```bash
curl -X POST http://127.0.0.1:54321/functions/v1/followup-processor \
  -H "Authorization: Bearer <service_role_key>" \
  -H "Content-Type: application/json" \
  -d '{"time_slot":"12:00"}'
```

**Résultat** : ✅ 200 OK

### Test 3 : Sans authentification

```bash
curl -X POST http://127.0.0.1:54321/functions/v1/followup-processor \
  -H "Content-Type: application/json" \
  -d '{"time_slot":"12:00"}'
```

**Résultat** : ✅ 401 Unauthorized

### Test 4 : Appel inter-fonctions (maintenance → bounce)

**Résultat** : ✅ Fonctionne avec X-Internal-Key

---

## 📊 Cron Jobs configurés

| Cron Job             | Schedule      | Fonction             | Auth              |
| -------------------- | ------------- | -------------------- | ----------------- |
| followup-7h          | 0 7 \*\* 1-5  | followup-processor   | X-Internal-Key ✅ |
| followup-12h         | 0 12 \*\* 1-5 | followup-processor   | X-Internal-Key ✅ |
| followup-16h         | 0 16 \*\* 1-5 | followup-processor   | X-Internal-Key ✅ |
| followup-maintenance | 0 2 \*\* 1-5  | followup-maintenance | X-Internal-Key ✅ |

---

## ⚠️ Fonctions NON modifiées (et pourquoi)

### microsoft-webhook

- **Raison** : Utilise validation webhook Microsoft (clientState, signature)
- **Auth** : Spécifique Microsoft Graph

### microsoft-auth

- **Raison** : OAuth flow public nécessitant accès externe
- **Auth** : OAuth 2.0

### microsoft-subscriptions

- **Raison** : Gestion interne avec authentification différente
- **Auth** : Spécifique Microsoft

### followup-scheduler

- **Raison** : Fonction legacy, sera supprimée
- **Statut** : Deprecated

### followup-sender

- **Raison** : Fonction utilitaire appelée en interne uniquement
- **Statut** : Interne

---

## 🚀 Déploiement en production

### Étape 1 : Pousser les migrations

```bash
supabase db push
```

### Étape 2 : Déployer les Edge Functions avec --no-verify-jwt

⚠️ **CRITIQUE** : Sans ce flag, les fonctions retournent 401 avant d'atteindre votre code.

```bash
supabase functions deploy followup-processor --no-verify-jwt
supabase functions deploy followup-maintenance --no-verify-jwt
supabase functions deploy bounce-processor --no-verify-jwt
```

### Étape 3 : Configurer les secrets

1. Dashboard > Edge Functions > Secrets
2. Ajouter `CRON_INTERNAL_KEY=<clé_sécurisée>`

### Étape 4 : Configurer PostgreSQL

1. Dashboard > SQL Editor
2. Exécuter :

   ```sql
   INSERT INTO system_config (key, value, description) VALUES (
     'cron_internal_key',
     jsonb_build_object('key', '<clé_sécurisée>'),
     'Internal authentication key for cron jobs'
   ) ON CONFLICT (key) DO UPDATE SET
     value = EXCLUDED.value,
     updated_at = now();
   ```

### Étape 5 : Vérifier les cron jobs

```sql
SELECT jobid, jobname, schedule
FROM cron.job
WHERE jobname LIKE 'followup%';
```

### Étape 6 : Tester manuellement

```bash
curl -X POST https://xxx.supabase.co/functions/v1/followup-processor \
  -H "X-Internal-Key: <votre_clé_prod>" \
  -H "Content-Type: application/json" \
  -d '{"time_slot":"12:00","source":"manual_test"}'
```

---

## 🔒 Sécurité

### Bonnes pratiques

- ✅ Clé d'au moins 32 caractères
- ✅ Rotation tous les 90 jours
- ✅ Clés différentes dev/production
- ✅ Jamais commitées dans Git

### En cas de compromission

1. Générer nouvelle clé : `openssl rand -base64 32`
2. Mettre à jour Edge Functions Secrets (Dashboard > Edge Functions)
3. Mettre à jour system_config :

   ```sql
   UPDATE system_config
   SET value = jsonb_build_object('key', '<nouvelle_clé>'),
       updated_at = now()
   WHERE key = 'cron_internal_key';
   ```

4. Vérifier : `SELECT get_cron_internal_key();`

---

## 📝 Notes

- Mode développement : `ALLOW_REAL_EMAILS=false` empêche l'envoi d'emails réels
- Les fonctions retournent 401 sans authentification valide
- Bearer token (service_role_key) reste accepté pour compatibilité
- X-Internal-Key est la méthode recommandée pour les cron jobs
