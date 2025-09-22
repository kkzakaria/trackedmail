# Vue d'ensemble

L'application a pour vocation de **suivre les emails envoyés** et d'effectuer des **relances automatiques** pour ceux qui n'ont pas reçu de réponse.

**Architecture mono-tenant** : L'application sert une seule organisation avec configuration globale.

L'application permettra de suivre un ou plusieurs boîtes de messageries.

Le système utilisera les **API Microsoft Graph** et les **webhooks** pour :

- Détecter automatiquement les réponses aux emails suivis via des mécanismes de threading avancés
- Enregistrer et mettre à jour les emails envoyés dans une base de données Supabase
- Arrêter automatiquement le suivi dès la première réponse reçue

L'envoi initial d'e-mail ne se fait pas dans l'application mais via Outlook. Elle se limite au suivi et aux relances.

**Exclusion des emails internes** : Les emails provenant du même domaine/tenant sont automatiquement exclus du suivi.

NB : L'envoi d'e-mail initial via l'application est envisageable mais pas la priorité pour le moment.

## Architecture Technique

### Stack Technologique

- **pnpm** gestionnaire de paquets
- **husky** vérifier les erreurs de type et de linting avant tout commit
- **Microsoft Graph API** avec permissions d'application (Application Permissions)
- **Supabase PostgreSQL** pour la base de données
- **Supabase Auth** pour l'authentification dans l'application
- **Supabase Edge Functions** pour les fonctions serverless gérant :
  - La détection intelligente des réponses via algorithmes multi-niveaux
  - Les souscriptions aux webhooks Microsoft Graph avec renouvellement automatique
  - L'interaction avec les webhooks entrants et validation de sécurité
  - La planification et l'envoi des relances programmées
  - Les opérations sur la base de données avec gestion des transactions
- **Next.js** et **Shadcn/UI** pour l'interface utilisateur
- **TypeScript** en mode type-safe strict

### Principes de Développement

- **Architecture SOLID** pour faciliter l'extension et la maintenance
- **Type Safety** complet avec TypeScript
- **Séparation des responsabilités** entre les couches

## Authentification - Architecture Duale

### 1. Authentification Supabase (Frontend/Utilisateur)

- **Périmètre** : Interface utilisateur de l'application
- **Objectif** : Gestion des sessions utilisateur et contrôle d'accès
- **Implémentation** : Auth Supabase avec JWT

### 2. Authentification Microsoft Graph (Backend)

- **Périmètre** : Interactions avec l'API Microsoft Graph uniquement
- **Objectif** : Accès aux données email de l'organisation avec permissions admin
- **Permissions requises** :
  - `Mail.ReadWrite` (Application)
  - `Mail.Send` (Application)
  - `User.Read.All` (Application) - pour découvrir les boîtes email

## Fonctionnalités Principales

### 1. Tracking des Emails

- Enregistrement automatique des emails envoyés via webhooks Microsoft Graph
- Exclusion automatique des emails internes (même domaine/tenant)
- Suivi du statut : pending, responded, stopped, max_reached, bounced, expired
- Horodatage des événements
- Stockage des propriétés de threading : conversationId, internetMessageId, inReplyTo, references

### 2. Détection Intelligente des Réponses

- **Méthode principale** : conversationId Microsoft Graph
- **Méthodes de fallback** : inReplyTo, references, analyse heuristique
- **Détection des réponses automatiques** : Filtrage via headers et patterns
- **Gestion des bounces** : Détection hard/soft bounce
- **Première réponse uniquement** : Arrêt automatique du suivi après la première réponse

### 3. Système de Relance

- **Configuration** : Maximum 3 relances par email avec intervalles configurables
- **Heures de travail** : 07h00 - 18h00 UTC (configurable globalement)
- **Conditions d'arrêt** : Après réponse, bounce, max relances atteint, ou 30 jours
- **Templates personnalisables** : Variables dynamiques et preview en temps réel
- **Gestion des jours non-ouvrés** : Report automatique

### 4. Dashboard de Suivi

- Vue d'ensemble des emails envoyés avec le statut de suivi
- Statistiques de réponse et métriques de performance
- Gestion des templates de relance
- Monitoring des webhooks et de la détection des réponses
- Logs de détection pour debugging

## API et Webhooks

### Microsoft Graph Integration

- **Permissions requises** :
  - `Mail.ReadWrite` (Application) - Lecture et écriture des emails
  - `Mail.Send` (Application) - Envoi des relances
  - `User.Read.All` (Application) - Découverte des boîtes email
- **Webhooks avancés** :
  - Souscriptions sur `/users/{id}/messages` (nouveaux messages)
  - Souscriptions sur `/users/{id}/mailFolders('inbox')/messages` (inbox)
  - Renouvellement automatique (max 3 jours)
  - Gestion des échecs avec retry exponentiel
- **Propriétés utilisées** :
  - conversationId, conversationIndex
  - internetMessageId, inReplyTo, references
  - internetMessageHeaders (pour détection auto-reply)

### Supabase Edge Functions

1. **webhook-handler** : Traitement des notifications Microsoft Graph et détection des réponses
2. **subscription-manager** : Gestion et renouvellement des souscriptions
3. **followup-scheduler** : Planification et envoi des relances
4. **sync-manager** : Synchronisation périodique et nettoyage

## Base de Données

### Architecture PostgreSQL via Supabase

- **Tables principales** : users, mailboxes, tracked_emails, followups, email_responses
- **Nouvelles tables** : webhook_subscriptions, message_headers, detection_logs
- **Row Level Security (RLS)** : Sécurisation basée sur les rôles utilisateurs
- **Index optimisés** : Pour les recherches par conversation, threading et détection
- **Triggers automatiques** : Mise à jour des statuts et annulation des relances
- **Fonctions utilitaires** : Nettoyage des sujets, détection de threading

### Propriétés de Threading

- **conversationId** : Regroupement Microsoft Graph des messages liés
- **conversationIndex** : Ordre chronologique dans la conversation
- **internetMessageId** : ID unique RFC pour threading standard
- **inReplyTo** : Référence directe au message parent
- **references** : Chaîne complète des IDs du thread

## Permissions et Rôles des Utilisateurs

### Administrateur

- Gestion et accès complet des paramètres de configuration globale
- Configuration des heures de travail et domaine tenant
- Gestion des templates de relance globaux
- Accès aux logs de détection et métriques de performance

### Manager

- Gestion des utilisateurs
- Suivi de toutes les boîtes de messageries
- Assignations des boîtes de messagerie à suivre aux utilisateurs
- Ne peut pas ajouter ou supprimer des boîtes de messageries à suivre
- Toutes les permissions utilisateurs
- Accès aux statistiques globales

### Utilisateur

- Suivi des boîtes de messageries assignées uniquement
- Arrêt manuel de suivi d'un email
- Relance manuelle d'un email
- Gestion des templates de relance personnels
- Consultation des statistiques de ses emails

## Sécurité et Conformité

### Sécurité

- **Tokens Microsoft Graph** : Stockage chiffré dans Supabase Vault avec refresh automatique
- **Validation des webhooks** : Vérification clientState et signatures Microsoft
- **Rate limiting** : Respect des limites Microsoft Graph (10000 req/10min)
- **Authentification duale** : Supabase Auth (frontend) + Microsoft Graph (backend)
- **Logs d'audit complets** : Traçabilité de toutes les actions utilisateurs
- **Circuit breaker** : Protection contre les échecs de webhooks

### Conformité

- **Respect du RGPD** : Gestion des données personnelles avec consentement
- **Droit à l'oubli** : Suppression complète des données utilisateur
- **Anonymisation** : Données analytiques sans information personnelle
- **Rétention des données** : Politique de suppression automatique des anciens emails
- **Exclusion automatique** : Respect de la confidentialité des emails internes

## Configuration Technique

### Limites et Contraintes

- **Webhooks** : Maximum 3 jours d'expiration, renouvellement automatique 1h avant
- **Relances** : Maximum 3 par email, arrêt après 30 jours
- **Première réponse** : Arrêt automatique du suivi, ignorer les réponses ultérieures
- **Threading** : Gestion des clients mail qui cassent le threading standard
- **Latence** : Notifications webhook avec délai possible jusqu'à 3 minutes

### Monitoring et Métriques

- **Détection des réponses** : Tracking par méthode (conversationId, inReplyTo, etc.)
- **Performance** : Temps de traitement des webhooks et détection
- **Fiabilité** : Taux de succès des souscriptions et renouvellements
- **Qualité** : Précision de la détection des réponses vs faux positifs
