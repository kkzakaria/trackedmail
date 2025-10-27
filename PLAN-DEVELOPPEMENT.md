# Plan de Développement TrackedMail

## 📊 État Actuel du Projet

### ✅ Infrastructure Complète

- **Framework**: Next.js 15 avec App Router et React 19
- **TypeScript**: Configuration stricte avec tsconfig.json et tsconfig.strict.json
- **Styling**: Tailwind CSS 4 + Shadcn/UI (style "new-york", 2,797 lignes de composants)
- **Outils**: ESLint, Prettier, Husky pre-commit hooks
- **Package Manager**: pnpm avec scripts optimisés
- **Build**: Turbopack activé pour développement et production

### ✅ Configuration de Qualité

- **TypeScript**: Mode strict complet avec vérifications avancées
- **Pre-commit**: Husky + lint-staged avec type-safety
- **Scripts**: Commandes pour dev, build, lint, typecheck (normal + strict)
- **Supabase CLI**: Configuration locale prête (config.toml configuré)

### ✅ Base de Données

- **Documentation**: Schéma complet documenté dans SCHEMA-DATABASE.md
- **Migrations**: 13 migrations créées et optimisées (sécurité et performance complètes)
- **Architecture**: 11 tables avec triggers, fonctions, vues et RLS configuré
- **Types**: Types TypeScript auto-générés via `supabase gen types`
- **Sécurité**: Tous les avertissements PostgreSQL résolus (search_path, RLS)
- **Performance**: 62 optimisations RLS appliquées, 0 avertissement restant
- **Extensions**: pgcrypto configuré, gen_salt() opérationnel
- **Seed**: Données de test complètes (5 users, 5 mailboxes, 6 assignments, 3 templates)

### ✅ Authentification et Architecture

- **Supabase Auth**: Client moderne avec `@supabase/ssr` (non déprécié)
- **Middleware**: Protection des routes et gestion des sessions Next.js
- **Structure**: Dossiers lib/ organisés (types, hooks, services, providers)
- **Context React**: Hook useAuth et Provider pour l'état global
- **Variables**: Configuration .env.local avec clés Supabase locales

### ✅ Code Métier (Phase 1 Complète - Phase 2 Démarrée)

- **Interface**: Layout complet avec providers d'authentification et query
- **Fonctionnalités**: 59 fichiers TypeScript avec services, hooks, composants
- **Architecture**: Structure lib/ complète (services, hooks, providers, types)
- **Pages Auth**: Login/signup/dashboard fonctionnels avec validation
- **Admin Mailboxes**: Interface complète de gestion des boîtes mail ✅
- **API**: Microsoft Graph à intégrer (Phase 2.2 - prochaine étape)
- **Services**: MailboxService, AuthService, AssignmentService créés

## 🚀 Accomplissements Récents (23 septembre 2025)

### ✅ Interface de Suivi des Emails Complète (NOUVELLE FONCTIONNALITÉ)

- **Page principale de suivi** : `/dashboard/emails` avec table complète ✅
  - Pagination avancée avec contrôles de navigation
  - Tri multi-colonnes (sujet, date d'envoi, statut, relances)
  - Filtrage en temps réel par recherche multi-colonnes
  - Sélection multiple pour actions en lot
- **Page de détails** : `/dashboard/emails/[id]` avec interface riche ✅
  - Onglets organisés (Détails, Réponses, Relances)
  - Sidebar avec statistiques et actions
  - Design responsive avec Shadcn UI complet
- **Actions de gestion** : Interface administrative complète ✅
  - Arrêt/reprise du suivi avec confirmations
  - Suppression individuelle et en lot (administrateurs uniquement)
  - Navigation fluide avec breadcrumb et retour
- **Sécurité et permissions** : Contrôles d'accès granulaires ✅
  - Vérification de rôle administrateur pour suppressions
  - Utilitaires d'authentification centralisés
  - Interface conditionnelle basée sur les permissions

### ✅ Infrastructure Base de Données (DÉPASSEMENT OBJECTIFS)

- **13 migrations Supabase créées et optimisées**:
  - `20250921232935_initial_schema.sql` (11 tables + triggers + vues)
  - `20250921233130_rls_policies.sql` (politiques de sécurité complètes)
  - `20250922102000_enable_pgcrypto_extension.sql` (support gen_salt)
  - `20250922103000_test_helpers_setup.sql` (fonctions de test sécurisées)
  - `20250922120000_fix_function_search_path_security.sql` (sécurité search_path)
  - `20250922121000_optimize_rls_auth_performance.sql` (62 optimisations RLS)
  - `20250922140000_fix_all_rls_performance_issues.sql` (consolidation policies)
  - `20250922150000_eliminate_final_rls_conflicts.sql` (résolution conflits)
  - - 5 autres migrations de sécurité et performance
- **Sécurité PostgreSQL**: 100% des avertissements Supabase résolus
- **Performance**: 0 avertissement restant, base optimisée
- **Types TypeScript auto-générés** via `supabase gen types typescript --local`
- **Base locale opérationnelle** avec `supabase db reset` fonctionnel

### ✅ Architecture et Authentification

- **Client Supabase moderne** avec `@supabase/ssr` (remplacement de auth-helpers-nextjs déprécié)
- **Middleware Next.js** pour protection des routes et gestion des sessions
- **Structure complète** : `lib/{types,hooks,services,providers,supabase}/`
- **Context React** : Hook `useAuth` et AuthProvider fonctionnels
- **Variables d'environnement** : Configuration locale avec clés Supabase

### ✅ Qualité et Configuration

- **TypeScript strict** : Compilation sans erreurs avec types stricts
- **Package Manager** : Dépendances Supabase mises à jour (pnpm)
- **Dev Server** : Next.js 15 + Turbopack fonctionnel en 902ms
- **Git Ready** : Projet prêt pour commit avec structure professionnelle

### ✅ Pages UI et Interface (Complète - 22 septembre 2025)

- **Page de connexion** : `/login` avec formulaire complet (email/password, validation, états de chargement)
- **Page d'inscription** : `/signup` avec rôle selection et validation des mots de passe
- **Dashboard de base** : `/dashboard` avec métriques, actions rapides et état du système
- **Interface Admin Mailboxes** : `/admin/mailboxes` complète avec CRUD, recherche, filtres ✅
- **Redirection automatique** : Page d'accueil redirige vers le dashboard
- **Layout groups** : Organisation avec `(auth)/` et `(protected)/` pour la structure des routes
- **Composants Shadcn/UI** : Card, Button, Input, Select, Badge, Alert utilisés de manière cohérente
- **Services TypeScript** : 59 fichiers avec MailboxService, hooks, providers complets

### ✅ Optimisations Sécurité et Performance (22 septembre 2025)

- **Résolution gen_salt()** : Extension pgcrypto configurée, fonctions de test opérationnelles
- **Sécurité search_path** : Toutes les fonctions sécurisées contre les attaques de chemin
- **Optimisation RLS** : 62 améliorations de performance appliquées sur les politiques
- **Consolidation policies** : Élimination des conflits entre politiques permissives
- **Triggers sécurisés** : Noms de tables qualifiés pour fonctions avec search_path vide
- **Base de données optimale** : 0 avertissement Supabase restant, performance maximale

### ✅ Intégration Microsoft Graph Complète (23 septembre 2025)

- **Edge Functions Microsoft Graph** : 2 fonctions opérationnelles (`microsoft-webhook`, `microsoft-subscriptions`)
- **Authentification Application Permissions** : Tokens Microsoft Graph validés et fonctionnels
- **Surveillance Globale** : Migration de `/mailFolders/sentitems/messages` vers `/messages` pour détection complète
- **Classification Intelligente** : Fonction `classifyEmailType()` pour distinguer emails sortants/entrants
- **Détection Réponses** : Multi-méthodes (conversationId, internetMessageId, references, inReplyTo)
- **Sécurité Webhook OWASP** : Validation JWT, HMAC-SHA256, protection replay attacks
- **Tests Réels Concluants** : Système validé en conditions réelles avec ngrok tunnel

### ✅ Système de Relances avec Coordination Manuel/Automatique (24 septembre 2025)

- **Architecture Complète** : Système de relances automatiques avec coordination intelligente ✅
- **Détection Relances Manuelles** : Via conversationId Microsoft Graph pour détecter Reply Outlook ✅
- **Coordination Intelligente** : Replanification automatique des relances auto après relance manuelle ✅
- **Base de Données Étendue** : Table `manual_followups`, vue `followup_activity_summary`, fonctions SQL ✅
- **Edge Functions Adaptées** : `microsoft-webhook` détecte, `followup-scheduler` coordonne ✅
- **Respect Limites** : Maximum 3 relances total (manuel + automatique) avec séquençage ✅
- **Configuration Heures Ouvrables** : 7h-18h UTC configurable avec report automatique ✅
- **Interface Dashboard** : Components React pour métriques et gestion des relances ✅
- **Documentation Technique** : 3 documents complets (architecture, API, guide) ✅
- **Tests Validés** : Scénarios complets testés en local avec debug logging ✅

### ✅ Refactorisation Architecture Next.js 15 (24 septembre 2025)

- **Séparation Client/Serveur** : Architecture REST API complète pour toutes les opérations mailbox ✅
- **Routes API Sécurisées** : 8 endpoints avec authentification et contrôle des rôles ✅
- **Compatibilité Next.js 15** : Correction des problèmes `params: Promise<{id}>` ✅
- **Hooks React Optimisés** : Refactorisation complète pour utiliser uniquement fetch API ✅
- **Respect RLS** : Politiques de sécurité respectées sans contournement service_role ✅
- **Qualité Code** : 0 erreur TypeScript, 0 warning ESLint ✅
- **Microsoft Graph Intégré** : Résolution automatique des IDs utilisateur Microsoft ✅
- **Page Admin Fonctionnelle** : `/admin/mailboxes` complètement opérationnelle ✅

### ✅ Gestion Complète des Utilisateurs (24 septembre 2025)

- **Interface Administration** : Page `/admin/users` complète avec tableaux et statistiques ✅
- **CRUD Sécurisé** : Création, lecture, modification, activation/désactivation des utilisateurs ✅
- **Système de Rôles** : Contrôles granulaires administrateur/manager/utilisateur ✅
- **Assignations Mailboxes** : Interface complète d'assignation utilisateurs ↔ boîtes mail ✅
- **API REST Complète** : Routes sécurisées pour toutes les opérations utilisateur ✅
- **Hooks React Optimisés** : `useUsers`, `useSoftDeleteUser`, `useRestoreUser` ✅
- **Interface Responsive** : Design adaptatif avec filtres, recherche et actions ✅
- **Validation TypeScript** : Conformité stricte et qualité code maintenue ✅

## 🎯 Plan de Développement Structuré

### Phase 1: Fondations Techniques (1-2 semaines)

#### 1.1 Infrastructure Base de Données ✅ COMPLÉTÉ

- [x] Créer migrations Supabase depuis le schéma documenté
- [x] Configurer Row Level Security (RLS)
- [x] Créer triggers et fonctions automatiques
- [x] Tester migrations en local

#### 1.2 Architecture de Code ✅ COMPLÉTÉ

- [x] Structure des dossiers:

  ```texte
  lib/
  ├── supabase/          # Client et configuration ✅
  ├── types/             # Types TypeScript ✅
  ├── hooks/             # Custom React hooks ✅
  ├── services/          # Services API ✅
  ├── providers/         # React providers ✅
  └── utils/             # Utilitaires ✅
  ```

- [x] Configuration des variables d'environnement
- [x] Types TypeScript pour toutes les entités (auto-générés)

#### 1.3 Authentification et Autorisations ✅ COMPLÉTÉ

- [x] Configuration Supabase Auth (client moderne avec @supabase/ssr)
- [x] Système de rôles (admin/manager/user) intégré dans RLS
- [x] Protection des routes et middlewares Next.js
- [x] Context React et hooks d'authentification
- [x] Composants Login/Logout (pages UI créées)
- [x] Dashboard de base avec état du système
- [x] Interface de gestion des utilisateurs (admin panel) ✅ Mailboxes complète

### Phase 2: Fonctionnalités Core (2-3 semaines)

#### 2.1 Gestion des Boîtes Mail ✅ COMPLÉTÉE

- [x] Interface d'administration des mailboxes ✅ `/admin/mailboxes`
- [x] CRUD complet pour les boîtes mail ✅ MailboxForm + MailboxList
- [x] Assignation utilisateurs ↔ mailboxes ✅ AssignmentService
- [x] Hooks React et services TypeScript ✅ useMailboxes, MailboxService
- [x] Validation et synchronisation avec Microsoft Graph (Phase 2.2) ✅

#### 2.1.6 Résolution Automatique des IDs Microsoft ✅ COMPLÉTÉE

- [x] Service Microsoft Graph pour résolution des email → microsoft_user_id ✅
- [x] Endpoints API REST complets pour toutes les opérations mailbox ✅
- [x] Architecture client/serveur Next.js 15 compatible ✅
- [x] Gestion des erreurs (email inexistant, permissions insuffisantes) ✅
- [x] Validation de l'accessibilité via Microsoft Graph ✅
- [x] Respect des politiques RLS (Row Level Security) ✅
- [x] Correction des problèmes de compatibilité Next.js 15 ✅

#### 2.1.7 Gestion des Utilisateurs de l'Application ✅ COMPLÉTÉE

- [x] Interface d'administration des utilisateurs `/admin/users` ✅
- [x] CRUD complet pour les utilisateurs (create, read, update, soft delete) ✅
- [x] Gestion des rôles (administrateur, manager, utilisateur) ✅
- [x] Interface d'assignation mailboxes ↔ utilisateurs ✅
- [x] Système d'activation/désactivation des utilisateurs ✅
- [x] Contrôles de permissions granulaires (admin/manager/user) ✅
- [x] Interface responsive avec statistiques et filtres ✅

#### 2.2 Intégration Microsoft Graph ✅ COMPLÉTÉE

- [x] Configuration API Microsoft Graph ✅ Credentials configurés
- [x] Service d'authentification Application Permissions ✅ Tokens validés
- [x] Gestion des webhooks et abonnements ✅ Surveillance globale
- [x] Détection automatique des emails envoyés ✅ Classification intelligente

#### 2.3 Suivi des Emails ✅ COMPLÉTÉ

- [x] Interface de visualisation des emails suivis ✅ TrackedEmailsTable avec pagination et tri
- [x] Système de statuts (pending, responded, stopped, etc.) ✅ Base de données + badges UI
- [x] Filtres et recherche avancée ✅ Filtrage multi-colonnes et filtres par statut
- [x] Détection intelligente des réponses ✅ Threading + surveillance globale
- [x] Page de détails des emails ✅ EmailDetailsCard avec onglets complets
- [x] Actions de gestion ✅ Arrêt/reprise du suivi, suppression admin-only
- [x] Navigation fluide ✅ Liste vers détails avec breadcrumb
- [x] Interface responsive ✅ Design adaptatif mobile/desktop

#### 2.4 Edge Functions Supabase ✅ COMPLÉTÉES

- [x] Webhook receiver pour Microsoft Graph ✅ Fonctionnel avec validation OWASP
- [x] Logique de détection des réponses (threading) ✅ Multi-méthodes (conversationId, references)
- [x] Gestion automatique des abonnements webhook ✅ Surveillance globale /messages
- [x] Fonctions de planification des relances ✅ Edge Function followup-scheduler complète

### Phase 3: Relances et Analytics (1-2 semaines)

#### 3.1 Système de Relances ✅ COMPLÉTÉE

- [x] Templates de relances personnalisables ✅ Base de données + types TypeScript
- [x] Planification automatique avec intervalles ✅ Scheduler avec coordination manuel/auto
- [x] Respect des heures ouvrables (7h-18h UTC) ✅ Configuration working_hours complète
- [x] Interface de gestion des relances ✅ Components React dashboard
- [x] Maximum 3 relances par email ✅ Limite appliquée avec coordination intelligente
- [x] Détection relances manuelles ✅ Via conversationId Microsoft Graph
- [x] Coordination manuel/automatique ✅ Replanification intelligente
- [x] Base de données complète ✅ Tables, vues, fonctions SQL
- [x] Documentation technique complète ✅ 3 documents de référence

#### 3.2 Dashboard et Analytics

- [ ] Métriques de suivi et performance
- [ ] Graphiques avec Recharts
- [ ] Exports de données (CSV, Excel)
- [ ] Rapports par utilisateur/mailbox

#### 3.3 Configuration Globale ✅ COMPLÉTÉE

- [x] Paramètres globaux de l'application ✅
- [x] Configuration des heures ouvrables ✅
- [x] Templates globaux et personnalisables ✅
- [x] Gestion des domaines exclus ✅

## 📋 Plan Détaillé - Gestion des Utilisateurs

### Architecture Technique

#### 1. Services Backend (`lib/services/`)

- **user.service.ts** : Service complet avec méthodes CRUD
  - `getUsers()` : Liste avec pagination et filtres
  - `createUser()` : Création avec validation
  - `updateUser()` : Modification des données
  - `softDeleteUser()` / `restoreUser()` : Gestion soft delete
  - `getUserActivity()` : Historique d'activité

#### 2. Composants Frontend (`components/users/`)

- **UserList.tsx** : Table avec recherche et actions
- **UserForm.tsx** : Formulaire création/édition
- **UserDetail.tsx** : Vue détaillée avec stats
- **UserAssignments.tsx** : Gestion mailboxes
- **UserActivity.tsx** : Timeline d'activité

#### 3. Pages Application (`app/(protected)/admin/users/`)

- `/admin/users` : Liste principale
- `/admin/users/[id]` : Détail utilisateur
- `/admin/users/new` : Création
- `/admin/users/import` : Import CSV

### Fonctionnalités Clés

- ✨ **Gestion Complète** : CRUD avec soft delete
- 🔐 **Rôles et Permissions** : Admin, Manager, User
- 📊 **Dashboard Stats** : Métriques par utilisateur
- 📥 **Import/Export CSV** : Gestion en masse
- 📝 **Audit Trail** : Historique complet
- 🔄 **Assignations** : Interface mailboxes ↔ users

### Estimation : 2-3 jours

**Jour 1** : Backend (services, hooks)
**Jour 2** : Frontend (composants, pages)
**Jour 3** : Tests et finalisation

## 🛠️ Actions Immédiates (Semaine 1)

### Jour 1-2: Base de Données

1. **Créer migrations Supabase**

   ```bash
   supabase migration new initial_schema
   supabase migration new rls_policies
   supabase migration new triggers_functions
   ```

2. **Structure des tables principales**:
   - users (avec Supabase Auth)
   - mailboxes
   - user_mailbox_assignments
   - tracked_emails
   - followups
   - email_responses

### Jour 3-4: Architecture

1. **Structure des dossiers métier**
2. **Types TypeScript complets**
3. **Configuration Supabase client**
4. **Variables d'environnement**

### Jour 5-7: Authentification

1. **Composants auth de base**
2. **Middleware de protection**
3. **Système de rôles**
4. **Interface utilisateur simple**

## 📋 Critères de Validation

### Phase 1 - Critères de Complétion ✅ 100% COMPLÉTÉ

- [x] Migrations Supabase déployées et testées (13 migrations optimisées)
- [x] Structure de code organisée et documentée (lib/ structuré - 59 fichiers)
- [x] Authentification fonctionnelle avec rôles (Context + middleware)
- [x] Types TypeScript pour toutes les entités (auto-générés)
- [x] Tests de connexion Supabase réussis (dev server opérationnel)
- [x] Composants UI de login/logout (pages créées et fonctionnelles)
- [x] Dashboard de base avec état du système
- [x] Interface d'administration des utilisateurs ✅ Mailboxes complète
- [x] Sécurité PostgreSQL ✅ 100% avertissements résolus
- [x] Performance base de données ✅ 62 optimisations appliquées

### Phase 2 - Critères de Complétion ✅ 100% COMPLÉTÉ

- [x] CRUD complet pour mailboxes ✅ Interface admin complète
- [x] Intégration Microsoft Graph opérationnelle ✅ Surveillance globale implémentée
- [x] Détection automatique des emails ✅ Classification intelligente fonctionnelle
- [x] Edge Functions déployées et testées ✅ Webhook + subscriptions opérationnelles
- [x] Interface utilisateur pour le suivi ✅ Interface complète avec détails et actions admin

### Phase 3.1 - Critères de Complétion ✅ 100% COMPLÉTÉ

- [x] Système de relances automatiques fonctionnel ✅ Edge Functions opérationnelles
- [x] Détection et coordination relances manuelles ✅ ConversationId + replanification
- [x] Configuration heures ouvrables ✅ Interface et respect automatique
- [x] Base de données optimisée ✅ Tables, vues, fonctions complètes
- [x] Documentation technique complète ✅ Architecture, API, guide utilisation
- [x] Tests et validation ✅ Scénarios complets validés en local

### Phase 3.2 - Critères de Complétion ✅ PARTIELLEMENT COMPLÉTÉE

- [ ] Dashboard avec métriques temps réel (En cours)
- [x] Configuration globale complète ✅
- [ ] Interface utilisateur finalisée (En cours)

## 🚀 Points d'Attention

### Sécurité

- Row Level Security (RLS) sur toutes les tables
- Validation des webhooks Microsoft Graph
- Gestion sécurisée des tokens d'accès
- Protection CSRF sur les Edge Functions

### Performance

- Indexation optimale des tables
- Pagination des listes d'emails
- Cache des requêtes Microsoft Graph
- Optimisation des Edge Functions

### Maintenabilité

- Code TypeScript strict
- Tests unitaires pour les fonctions critiques
- Documentation technique complète
- Monitoring et logs des erreurs

## 📈 Métriques de Succès

### Techniques

- [x] 0 erreur TypeScript en mode strict ✅ (compilation réussie)
- [x] Dev server < 1s de démarrage ✅ (902ms avec Turbopack)
- [x] Structure de code maintenable ✅ (lib/ organisé avec services)
- [ ] Couverture de tests > 80% pour les fonctions critiques
- [ ] Temps de réponse < 500ms pour les opérations courantes

### Fonctionnelles

- Détection automatique des réponses > 95% de précision
- Envoi des relances selon planification exacte
- Interface utilisateur intuitive et responsive

---

**Dernière mise à jour**: 25 septembre 2025 - 10h00
**Version**: 1.9
**Statut**: Phase 1, 2 & 3.1 100% complètes - Phase 3.3 Configuration Globale complète - Microsoft Graph validation et synchronisation complète - Architecture Next.js 15 optimisée - Système de relances terminé - Documentation complète - Phase 3.2 en cours (Dashboard et Analytics)
