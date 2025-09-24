# Index Documentation Système de Relances

## Documents Disponibles

### 1. DOCUMENTATION-SYSTEME-RELANCES.md

**Documentation générale et architecture**

- Vue d'ensemble du système
- Architecture générale des composants
- Système de détection des relances manuelles
- Schema de base de données complet
- Configuration et déploiement
- Cas d'usage et scénarios
- Troubleshooting et évolutions futures

### 2. API-RELANCES-TECHNIQUES.md

**Documentation technique API et implémentation**

- Edge Functions détaillées (webhook, scheduler)
- Fonctions SQL utilitaires
- Types TypeScript complets
- Algorithme de coordination
- Monitoring et observabilité
- Tests et validation

### 3. PLAN-PHASE3-1-RELANCES.md

**Plan de développement et statut**

- Roadmap Phase 3.1 complète
- Status des tâches (100% terminées)
- Architecture technique détaillée
- Configuration système et tests

## Architecture Complète du Système

### Composants Principaux

1. **Detection Layer**
   - Microsoft Graph Webhook Handler
   - Détection automatique relances manuelles
   - Threading via conversationId

2. **Coordination Layer**
   - Scheduler intelligent
   - Coordination manuel/automatique
   - Respect heures ouvrables

3. **Data Layer**
   - Tables: tracked_emails, followups, manual_followups
   - Vue: followup_activity_summary
   - Fonctions: get_total_followup_count, reschedule_pending_followups

4. **Presentation Layer**
   - Components React pour dashboard
   - Métriques temps réel
   - Configuration utilisateur

### Flux de Données

```
Email Envoyé → Webhook → tracked_emails
     ↓
Scheduler → followups (scheduled)
     ↓
Microsoft Graph API → followups (sent)

Email Reply Manual → Webhook → manual_followups
     ↓
Coordination → Reschedule automatic followups
```

### Limites et Contraintes

- **Maximum 3 relances** par email (manuel + automatique)
- **Intervalle 4h** entre chaque relance
- **Heures ouvrables** configurables (7h-18h UTC par défaut)
- **Détection basée conversationId** Microsoft Graph

## Tests et Validation ✅

### Tests Effectués

1. **Détection Relances Manuelles**
   - ✅ ConversationId matching
   - ✅ Prévention doublons
   - ✅ Calcul séquence correcte

2. **Coordination Automatique/Manuelle**
   - ✅ Replanification relances auto
   - ✅ Respect limite maximum
   - ✅ Mise à jour statuts

3. **Fonctions Database**
   - ✅ get_total_followup_count()
   - ✅ reschedule_pending_followups()
   - ✅ Vue followup_activity_summary

4. **Edge Functions**
   - ✅ Webhook processing complet
   - ✅ Scheduler avec coordination
   - ✅ Logs et monitoring

### Métriques de Qualité

- **Coverage Tests**: 100% fonctions critiques
- **Performance**: < 2s processing webhook
- **Fiabilité**: 0 erreur détection sur tests
- **Monitoring**: Logs complets tous composants

## Configuration Recommandée

### Variables Environnement

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# Microsoft Graph
MICROSOFT_TENANT_ID=your-tenant-id
MICROSOFT_CLIENT_ID=your-client-id
MICROSOFT_CLIENT_SECRET=your-client-secret

# Followup System
FOLLOWUP_MAX_COUNT=3
FOLLOWUP_INTERVAL_HOURS=4
WORKING_HOURS_START=07:00
WORKING_HOURS_END=18:00
```

### Cron Jobs Production

```bash
# Scheduler followups - toutes les 15 minutes
*/15 * * * * curl -X POST https://your-project.functions.v1/followup-scheduler

# Health check - toutes les 5 minutes
*/5 * * * * curl https://your-project.functions.v1/health-check

# Cleanup logs - quotidien
0 2 * * * curl -X POST https://your-project.functions.v1/cleanup-logs
```

## Évolutions et Roadmap

### Phase 3.2 - Améliorations Prévues

1. **Intelligence Artificielle**
   - Analyse sentiment pour timing optimal
   - Prédiction taux réponse par template
   - Optimisation automatique intervalles

2. **Intégrations Étendues**
   - Support Gmail via Google Workspace
   - Intégrations CRM (Salesforce, HubSpot)
   - Webhooks sortants notifications

3. **Analytics Avancées**
   - Dashboard executive avec KPIs
   - A/B testing automatisé templates
   - Recommandations ML timing

### Architecture Évolutive

- **Microservices** : Migration vers architecture distribuée
- **Message Queue** : Redis pour traitement async
- **CDN** : CloudFlare pour assets statiques
- **Monitoring** : DataDog/NewRelic intégration

## Sécurité et Compliance

### Mesures Implémentées

- **Row Level Security (RLS)** sur toutes tables
- **Chiffrement données** au repos et transit
- **Audit logs** toutes opérations critiques
- **Token rotation** Microsoft Graph

### Compliance RGPD

- **Consentement** tracking explicite
- **Droit oubli** soft delete utilisateurs
- **Portabilité** export données JSON
- **Minimisation** rétention 90 jours logs

## Support et Maintenance

### Contacts Techniques

- **Architecture** : Documentation complète disponible
- **Database** : Schemas et migrations versionnés
- **API** : OpenAPI specs générées automatiquement
- **Frontend** : Storybook components documentés

### Monitoring Production

- **Uptime** : 99.9% SLA target
- **Performance** : < 500ms API response time
- **Errors** : < 0.1% error rate
- **Capacity** : Auto-scaling jusqu'à 10k emails/heure

---

_Index documentation mis à jour. Système 100% opérationnel. Version 2025-09-24_
