# Checklist de Déploiement en Production

## 📋 Variables d'Environnement

### 1. **Supabase Dashboard**

Configurer les secrets dans `Settings > Edge Functions > Secrets`:

- [x] `MICROSOFT_CLIENT_ID`
- [x] `MICROSOFT_CLIENT_SECRET`
- [x] `MICROSOFT_TENANT_ID`
- [x] `MICROSOFT_WEBHOOK_SECRET`
- [x] `MICROSOFT_TOKEN_ENCRYPTION_KEY`
- [x] `MICROSOFT_JWT_VALIDATION_KEY`

### 2. **Vercel/Netlify (Frontend)**

Ajouter dans les variables d'environnement:

- [x] `NEXT_PUBLIC_SUPABASE_URL`
- [x] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [x] `SUPABASE_SERVICE_ROLE_KEY`
- [x] `NEXT_PUBLIC_APP_URL`
- [x] `MICROSOFT_WEBHOOK_BASE_URL`

## 🔐 Génération des Clés de Sécurité

```bash
# Générer MICROSOFT_WEBHOOK_SECRET (32+ caractères)
openssl rand -base64 32

# Générer MICROSOFT_TOKEN_ENCRYPTION_KEY (256-bit)
openssl rand -base64 32

# Générer MICROSOFT_JWT_VALIDATION_KEY (hex)
openssl rand -hex 32
```

## 🚀 Étapes de Déploiement

### 1. Base de données Supabase

- [x] Créer le projet Supabase
- [x] Appliquer les migrations
- [x] Configurer RLS (Row Level Security)
- [ ] Créer les indexes de performance

### 2. Edge Functions

- [x] Déployer `webhook-processor`
- [x] Déployer `subscription-manager`
- [x] Déployer `followup-scheduler`
- [x] Déployer `followup-sender`
- [x] Configurer les secrets (voir section 1)
- [x] Tester les endpoints

### 3. Microsoft Azure AD

- [x] Créer l'application dans Azure AD
- [x] Configurer les permissions Application:
  - `Mail.ReadWrite`
  - `Mail.Send`
  - `User.Read.All`
- [x] Créer un Client Secret
- [x] Accorder le consentement administrateur
- [x] Noter les IDs (Client, Tenant)

### 4. Configuration des Webhooks

- [x] URL de notification: `https://[PROJECT_ID].supabase.co/functions/v1/webhook-processor`
- [x] Créer les abonnements via `subscription-manager`
- [x] Vérifier la réception des notifications

### 5. Frontend (Next.js)

- [x] Build de production: `pnpm build`
- [x] Déployer sur Vercel/Netlify
- [x] Configurer le domaine personnalisé
- [x] Activer HTTPS
- [x] Configurer les variables d'environnement

### 6. Tâches Cron (Supabase)

Configurer dans `Cron Jobs` du dashboard Supabase:

```sql
-- Planification des relances (toutes les heures)
SELECT cron.schedule(
  'schedule-followups',
  '0 * * * *', -- Toutes les heures
  $$
  SELECT net.http_post(
    url := 'https://[PROJECT_ID].supabase.co/functions/v1/followup-scheduler',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Envoi des relances (toutes les 15 minutes)
SELECT cron.schedule(
  'send-followups',
  '*/15 * * * *', -- Toutes les 15 minutes
  $$
  SELECT net.http_post(
    url := 'https://[PROJECT_ID].supabase.co/functions/v1/followup-sender',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Renouvellement des webhooks (toutes les 12 heures)
SELECT cron.schedule(
  'renew-webhooks',
  '0 */12 * * *', -- Toutes les 12 heures
  $$
  SELECT net.http_post(
    url := 'https://[PROJECT_ID].supabase.co/functions/v1/subscription-manager',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"action": "renew"}'::jsonb
  );
  $$
);
```

## ✅ Tests Post-Déploiement

### 1. Authentification

- [x] Login avec compte Microsoft
- [x] Vérification des rôles utilisateur
- [x] Logout

### 2. Tracking d'Emails

- [x] Envoi d'un email depuis Outlook
- [x] Vérification de l'enregistrement dans la BD
- [x] Statut "pending" correctement défini

### 3. Détection de Réponses

- [x] Répondre à un email tracké
- [x] Vérifier le changement de statut à "responded"
- [x] Annulation automatique des relances

### 4. Système de Relances

- [x] Création automatique après délai
- [x] Envoi dans les heures ouvrables
- [x] Maximum 3 relances respecté
- [x] Threading correct dans Outlook

### 5. Performance

- [x] Temps de chargement < 3s
- [x] Pagination fonctionnelle
- [x] Recherche responsive

## 📊 Monitoring

### Métriques à Surveiller

- Taux de succès des webhooks
- Nombre d'emails trackés/jour
- Taux de réponse
- Performance des Edge Functions
- Utilisation de la base de données

### Logs à Vérifier

- Logs des Edge Functions (Supabase)
- Logs d'application (Vercel/Netlify)
- Erreurs Microsoft Graph API
- Échecs d'envoi de relances

## 🔧 Maintenance

### Quotidienne

- Vérifier les logs d'erreur
- Monitorer les webhooks actifs

### Hebdomadaire

- Nettoyer les relances expirées
- Vérifier les performances

### Mensuelle

- Revoir les métriques d'utilisation
- Optimiser les requêtes lentes
- Mettre à jour les dépendances de sécurité
