# Documentation Complète du Système de Relances

## Vue d'ensemble

Le système de relances de TrackedMail est une architecture sophistiquée qui permet de gérer automatiquement les suivis d'emails non répondus, avec support complet pour les relances manuelles effectuées via Outlook. Le système coordonne intelligemment les relances automatiques et manuelles pour éviter la duplication et maintenir une stratégie de suivi cohérente.

## Architecture Générale

### Composants Principaux

1. **Microsoft Graph Webhook Handler** (`microsoft-webhook`)
   - Détection des nouveaux emails envoyés
   - Détection automatique des relances manuelles
   - Traitement des réponses et mise à jour des statuts

2. **Followup Scheduler** (`followup-scheduler`)
   - Planification intelligente des relances automatiques
   - Respect des heures ouvrables et jours fériés
   - Coordination avec les relances manuelles

3. **Base de données PostgreSQL**
   - Tables de suivi des emails et relances
   - Vues unifiées pour le dashboard
   - Fonctions utilitaires pour la coordination

4. **Interface utilisateur React**
   - Dashboard de monitoring des relances
   - Configuration des templates et planification
   - Métriques et statistiques en temps réel

## Système de Détection des Relances Manuelles

### Principe de Fonctionnement

Le système détecte automatiquement quand un utilisateur envoie une relance manuelle via la fonction "Réponse" d'Outlook en utilisant le `conversationId` de Microsoft Graph.

### Processus de Détection

```typescript
// Dans microsoft-webhook/index.ts
if (detectIsReply(messageDetails) && messageDetails.conversationId) {
  console.log(
    `🔍 Detected reply email, checking for manual followup: ${messageDetails.subject}`
  );
  const manualFollowupHandled = await handlePotentialManualFollowup(
    supabase,
    messageDetails,
    startTime
  );
  if (manualFollowupHandled) {
    console.log(
      `✅ Manual followup detected and processed for conversation: ${messageDetails.conversationId}`
    );
    return;
  }
}
```

### Critères de Détection

1. **Email de type réponse** : Détecté via `detectIsReply()`
2. **ConversationId existant** : Vérifie si le conversationId existe déjà dans `tracked_emails`
3. **Expéditeur identique** : L'expéditeur doit être le même que l'email original
4. **Pas déjà détecté** : Évite les doublons en vérifiant `manual_followups`

## Schema de Base de Données

### Table `manual_followups`

```sql
CREATE TABLE manual_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_email_id UUID NOT NULL REFERENCES tracked_emails(id) ON DELETE CASCADE,
  microsoft_message_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  sender_email TEXT NOT NULL,
  subject TEXT,
  followup_sequence_number INTEGER NOT NULL, -- Position dans le cycle total
  affects_automatic_scheduling BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Fonctions Utilitaires

#### `get_total_followup_count(UUID)`

Calcule le nombre total de relances (manuelles + automatiques) pour un email donné.

```sql
SELECT COUNT(*) FROM followups WHERE tracked_email_id = $1 AND status = 'sent'
UNION ALL
SELECT COUNT(*) FROM manual_followups WHERE tracked_email_id = $1
```

#### `reschedule_pending_followups(UUID, TIMESTAMPTZ, INTEGER)`

Replanifie les relances automatiques en attente suite à une relance manuelle.

```sql
UPDATE followups
SET scheduled_for = p_base_time + (p_adjustment_hours * followup_number || ' hours')::INTERVAL,
    updated_at = NOW()
WHERE tracked_email_id = p_tracked_email_id
  AND status = 'scheduled'
  AND scheduled_for > NOW()
```

### Vue `followup_activity_summary`

Vue unifiée qui combine les données des relances automatiques et manuelles pour l'affichage dans le dashboard.

```sql
CREATE OR REPLACE VIEW followup_activity_summary AS
SELECT
  te.id,
  te.subject,
  te.status,
  te.sent_at,
  COALESCE(auto_stats.count, 0) as automatic_followups,
  COALESCE(manual_stats.count, 0) as manual_followups,
  COALESCE(auto_stats.count, 0) + COALESCE(manual_stats.count, 0) as total_followups,
  CASE
    WHEN COALESCE(auto_stats.count, 0) + COALESCE(manual_stats.count, 0) >= 3 THEN 'max_reached'
    WHEN te.status = 'pending' AND COALESCE(auto_stats.count, 0) + COALESCE(manual_stats.count, 0) > 0 THEN 'active_followup'
    ELSE te.status
  END as effective_status
FROM tracked_emails te
-- Jointures avec stats automatiques et manuelles
```

## Système de Coordination Automatique/Manuelle

### Logique de Coordination

Quand une relance manuelle est détectée :

1. **Enregistrement** : Ajout dans `manual_followups`
2. **Calcul séquence** : Détermine le numéro de séquence dans le cycle global
3. **Replanification** : Reporte les relances automatiques en attente de 4h
4. **Vérification limite** : Applique la limite de 3 relances maximum (manuel + auto)

### Adaptation du Scheduler

Le scheduler adapte sa logique pour tenir compte des relances manuelles :

```typescript
// Dans followup-scheduler/index.ts
const totalFollowupsSent = await getTotalFollowupsCount(supabase, email.id);

if (totalFollowupsSent >= maxFollowups) {
  console.log(
    `📧 Email ${email.id} has reached maximum followups (${totalFollowupsSent}/${maxFollowups})`
  );
  await markEmailAsMaxReached(supabase, email.id);
  continue;
}

const nextAutomaticFollowupNumber = totalFollowupsSent + 1;
```

### Calcul des Intervalles

- **Relance 1** : 4h après envoi original (ou relance manuelle)
- **Relance 2** : 8h après envoi original (ou 4h après relance précédente)
- **Relance 3** : 12h après envoi original (ou 4h après relance précédente)

## Configuration des Heures Ouvrables

### Structure

```typescript
interface WorkingHoursConfig {
  timezone: string;
  start: string; // "07:00"
  end: string; // "18:00"
  working_days: ["monday", "tuesday", "wednesday", "thursday", "friday"];
  holidays: string[]; // ["2024-12-25", "2024-01-01"]
}
```

### Logique de Report

Si une relance est programmée en dehors des heures ouvrables :

1. Calcul du prochain créneau ouvrable
2. Report de la planification
3. Log de l'ajustement
4. Mise à jour du statut `adjusted_for_working_hours: true`

## Templates de Relances

### Variables Disponibles

```typescript
interface TemplateVariables {
  destinataire_nom: string;
  destinataire_entreprise: string;
  objet_original: string;
  date_envoi_original: string;
  numero_relance: number;
  jours_depuis_envoi: number;
  expediteur_nom: string;
  expediteur_email: string;
}
```

### Exemple de Template

```texte
Objet: Re: {{objet_original}} - Rappel {{numero_relance}}

Bonjour {{destinataire_nom}},

Je reviens vers vous concernant mon email du {{date_envoi_original}}
au sujet de "{{objet_original}}".

Il y a {{jours_depuis_envoi}} jours maintenant, et j'aimerais savoir
si vous avez eu l'occasion de consulter ma demande.

Cordialement,
{{expediteur_nom}}
```

## Métriques et Monitoring

### Métriques Clés

1. **Volume des relances**
   - Nombre total envoyé/planifié/échoué
   - Répartition par template
   - Répartition par numéro de relance

2. **Performance des templates**
   - Taux de réponse par template
   - Utilisation sur les 7 derniers jours
   - Temps moyen de réponse

3. **Coordination manuel/automatique**
   - Relances manuelles détectées
   - Relances automatiques reprogrammées
   - Emails ayant atteint le maximum

### Dashboard Components

- **FollowupMetrics.tsx** : Métriques en temps réel
- **FollowupStats.tsx** : Statistiques détaillées
- **FollowupCalendar.tsx** : Vue calendrier des relances
- **TestScheduler.tsx** : Interface de test et debug

## Sécurité et Permissions

### Row Level Security (RLS)

Toutes les tables de relances utilisent RLS pour sécuriser l'accès :

```sql
-- Politique pour manual_followups
CREATE POLICY "manual_followups_select_policy"
ON manual_followups FOR SELECT
USING (
  tracked_email_id IN (
    SELECT te.id FROM tracked_emails te
    JOIN mailboxes mb ON te.mailbox_id = mb.id
    WHERE CASE
      WHEN current_user_role() = 'administrateur' THEN true
      WHEN current_user_role() = 'manager' THEN true
      ELSE mb.id IN (SELECT unnest(current_user_mailbox_ids()))
    END
  )
);
```

### Permissions par Rôle

- **Administrateur** : Accès complet à tous les emails et relances
- **Manager** : Accès à tous les emails, configuration globale
- **Utilisateur** : Accès aux emails de ses mailboxes assignées uniquement

## Flux de Données Complet

### 1. Envoi d'Email Initial

```texte
Outlook → Microsoft Graph → Webhook → tracked_emails
```

### 2. Détection de Réponse

```texte
Outlook Reply → Microsoft Graph → Webhook → email_responses → Annulation relances
```

### 3. Relance Manuelle

```texte
Outlook Reply → Microsoft Graph → Webhook → manual_followups → Replanification auto
```

### 4. Relance Automatique

```texte
Scheduler → Templates → Microsoft Graph Send API → followups.status = 'sent'
```

## Configuration et Déploiement

### Variables d'Environnement

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
MICROSOFT_TENANT_ID=your-tenant-id
MICROSOFT_CLIENT_ID=your-client-id
MICROSOFT_CLIENT_SECRET=your-client-secret
```

### Edge Functions

```bash
# Déploiement local pour tests
supabase functions serve --debug --env-file .env.local

# Déploiement en production
supabase functions deploy microsoft-webhook
supabase functions deploy followup-scheduler
```

### Cron Jobs

Le scheduler doit être appelé régulièrement via un cron job :

```bash
# Toutes les 15 minutes
*/15 * * * * curl -X POST https://your-project.supabase.co/functions/v1/followup-scheduler
```

## Cas d'Usage et Scénarios

### Scénario 1 : Email Simple

1. Envoi email → Tracking
2. Pas de réponse après 4h → Relance auto #1
3. Pas de réponse après 8h → Relance auto #2
4. Pas de réponse après 12h → Relance auto #3 → Max atteint

### Scénario 2 : Relance Manuelle Précoce

1. Envoi email → Tracking
2. **Relance manuelle après 2h** → Détection → manual_followups
3. Relance auto #2 reprogrammée à 6h (2h + 4h)
4. Relance auto #3 reprogrammée à 10h (2h + 8h)

### Scénario 3 : Mix Manuel/Automatique

1. Envoi email → Tracking
2. Relance auto #1 après 4h → Envoyée
3. **Relance manuelle après 6h** → Détection → manual_followups
4. Relance auto #3 reprogrammée à 10h → Max atteint

### Scénario 4 : Réponse Reçue

1. Envoi email → Tracking
2. **Réponse reçue** → Webhook → email_responses
3. Statut → 'responded', toutes relances annulées

## Troubleshooting et Debug

### Logs Importants

```bash
# Webhook processing
🔍 Detected reply email, checking for manual followup
✅ Manual followup detected and processed for conversation

# Scheduler logs
📧 Found X emails needing followups
📝 Found Y active templates
⏰ Scheduled followup #N for email

# Coordination logs
🔄 Rescheduling pending followups due to manual followup
📊 Total followups count: manual=X, automatic=Y
```

### Commandes de Debug

```bash
# Vérifier les relances en attente
SELECT * FROM followups WHERE status = 'scheduled' ORDER BY scheduled_for;

# Vérifier les relances manuelles récentes
SELECT * FROM manual_followups ORDER BY detected_at DESC LIMIT 10;

# Vue unifiée des activités
SELECT * FROM followup_activity_summary WHERE total_followups > 0;
```

### Problèmes Courants

1. **Relances non détectées** : Vérifier que le conversationId est présent
2. **Double planification** : Vérifier la logique de coordination dans le scheduler
3. **Heures ouvrables** : Vérifier la configuration timezone et working_hours
4. **Templates manquants** : S'assurer qu'au moins un template est actif

## Évolutions Futures

### Améliorations Prévues

1. **Intelligence artificielle** : Analyse du contenu pour optimiser le timing
2. **A/B Testing** : Tests automatisés de différents templates
3. **Intégrations étendues** : Support Gmail, autres providers
4. **Analytics avancées** : ML pour prédiction de taux de réponse

### Architecture Évolutive

Le système est conçu pour être extensible :

- Nouveaux types de relances (SMS, LinkedIn, etc.)
- Intégrations CRM (Salesforce, HubSpot)
- API REST pour intégrations tierces
- Webhooks sortants pour notifier d'autres systèmes

---

Cette documentation est maintenue à jour avec l'évolution du système. Dernière mise à jour : 2025-09-24
