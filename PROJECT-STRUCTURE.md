# Vue d'ensemble

L'application a pour vocation de **suivre les emails envoyés** et d'effectuer des **relances automatiques toutes les 4 heures** pour ceux qui n'ont pas reçu de réponse.

L'application permettra de suivre un ou plusieurs boîtes de messsageries.

Le système utilisera les **API Microsoft Graph** et les **webhooks** pour enregistrer et mettre à jour les emails envoyés dans une base de données Supabase en fonction des événements reçus.

L'envoie initiale d'e-mail ne se fait pas dans l'application mais via outlook. Elle se se limmite au suivi et aux relance.

NB : L'envoie d'e-mail initial via l'application est envisageable mais pas la priorité pour le momment.
Pas de distinction entre les réponses humaines et système à ce stade même si cela reste envisageable.

## Architecture Technique

### Stack Technologique

- **pnpm** gestionnaire de packet
- **husky** vérifier les erreurs de type et de linting avant tout commit
- **Microsoft Graph API** avec permissions d'application (Application Permissions)
- **Supabase PostgreSQL** pour la base de données
- **Supabase Auth** pour l'authentification dans l'application
- **Supabase Edge Functions** pour les fonctions serverless gérant :
  - Les souscriptions aux webhooks Microsoft Graph
  - L'interaction avec les webhooks entrants
  - Les opérations sur la base de données
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
- Enregistrement automatique des emails envoyés à l'exclusion de ceux envoyé aux adresses du tenant
- Suivi du statut (en attente, répondu)
- Horodatage des événements

### 2. Système de Relance
- **Fréquence** : Toutes les 4 heures aux heure de travail (07h00 - 18h00 utc)
- **Condition** : Emails sans réponse uniquement
- **Personnalisation** : Templates de relance configurables

### 3. Dashboard de Suivi
- Vue d'ensemble des emails envoyés avec le status de suivi
- Statistiques de réponse
- Gestion des campagnes de relance

## API et Webhooks

### Microsoft Graph Integration
- **Permissions requises** :
  - `Mail.Read`
  - `Mail.Send`
  - `Mail.ReadWrite`
- **Webhooks** pour les événements email en temps réel

### Supabase Edge Functions
1. Gestion des souscription Microsoft Graph avec renouvellement automatique
2. Traitement des webhooks Microsoft Graph
2. Gestion des relances programmées
3. Synchronisation périodique des données

## Permission et rôle des utilisateurs de l'application

### Administrteur
gestion et accès complet des paramètres de configuartions.

### Manageur
- Gestion des utilisateurs
- Suivi de toutes les boîte de messageries
- Assignements des boîte de messagerie à suivre aux utilisateurs
- Ne peut pas ajouter ou supprimer des boîtes de messageries à suivre.
- Toutes les permissions utilisateurs

### Utilisateur
- Suivi des boîtes de messagéries assignées
- Arrêt manuel de suivi d'un e-mail
- Relance manuel d'un e-mail
- Gestion des templates de relance

## Sécurité et Conformité

### Sécurité
- Chiffrement des tokens Microsoft Graph
- Validation stricte des webhooks entrants
- Rate limiting sur les API
- Logs d'audit complets

### Conformité
- Respect du RGPD pour les données personnelles
- Possibilité de suppression des données utilisateur
- Anonymisation des données analytiques

