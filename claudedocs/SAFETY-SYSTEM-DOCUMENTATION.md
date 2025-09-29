# Système de Sécurité - Protection contre l'Envoi d'Emails en Développement

## Vue d'ensemble

Le système de sécurité a été implémenté pour prévenir l'envoi accidentel d'emails réels pendant le développement et les tests. Cette protection est cruciale pour éviter d'envoyer des relances non désirées aux vrais destinataires lors des phases de développement.

## Configuration des Variables d'Environnement

### Fichier `.env.local`

```env
# Development Safety Configuration
# Protège contre l'envoi d'emails réels pendant le développement
ENVIRONMENT='development'
ALLOW_REAL_EMAILS='false'  # ⚠️ Set to 'true' only when you want to send real emails!
```

### Variables de Sécurité

- **ENVIRONMENT** : Définit l'environnement d'exécution
  - `'development'` : Mode développement (protection activée)
  - `'production'` : Mode production (protection désactivée)

- **ALLOW_REAL_EMAILS** : Contrôle l'autorisation d'envoi d'emails réels
  - `'false'` : Bloque l'envoi d'emails réels (recommandé en développement)
  - `'true'` : Autorise l'envoi d'emails réels

## Implémentation Technique

### Code de Protection dans `followup-processor`

```typescript
// 🚨 SAFETY CHECK: Protection contre l'envoi d'emails en développement
const isDevelopment = Deno.env.get("ENVIRONMENT") !== "production";
const allowRealEmails = Deno.env.get("ALLOW_REAL_EMAILS") === "true";

if (isDevelopment && !allowRealEmails) {
  console.log("🛡️ BLOCKED: Real email sending disabled in development");
  console.log(`📧 Would send to: ${email.recipient_emails.join(", ")}`);
  console.log(`📝 Subject: ${renderedTemplate.subject}`);

  // Simuler l'envoi en sauvegardant comme "sent" mais sans vraiment envoyer
  await recordFollowupSent(supabase, email.id, template, renderedTemplate);
  console.log("✅ Simulated email send (DEVELOPMENT MODE)");
  return;
}
```

### Mécanisme de Simulation

Quand la protection est activée :

1. **Blocage** : L'envoi réel via Microsoft Graph est bloqué
2. **Logging** : Les détails de l'email sont affichés dans les logs
3. **Simulation** : L'email est marqué comme envoyé dans la base de données
4. **Confirmation** : Un message confirme la simulation

## Modes d'Utilisation

### Mode Développement Sécurisé (Recommandé)

```env
ENVIRONMENT='development'
ALLOW_REAL_EMAILS='false'
```

- ✅ Aucun email réel envoyé
- ✅ Fonctionnalités testables
- ✅ Base de données mise à jour normalement
- ✅ Logs détaillés disponibles

### Mode Développement avec Envoi Réel (Attention)

```env
ENVIRONMENT='development'
ALLOW_REAL_EMAILS='true'
```

- ⚠️ Emails réels envoyés
- ⚠️ Risque d'envoi accidentel
- ✅ Test complet du flux d'envoi

### Mode Production

```env
ENVIRONMENT='production'
ALLOW_REAL_EMAILS='true' # ou 'false' selon les besoins
```

- 🚀 Envoi d'emails réels activé par défaut
- 🚀 Fonctionnement normal en production

## Procédures Recommandées

### Pour le Développement

1. **Toujours commencer en mode sécurisé** :

   ```bash
   # Vérifier la configuration
   grep -E "ENVIRONMENT|ALLOW_REAL_EMAILS" .env.local
   ```

2. **Tester avec des données de test** :
   - Utiliser des emails fictifs pour les tests
   - Vérifier les logs de simulation

3. **Activer l'envoi réel seulement si nécessaire** :
   - Pour les tests d'intégration spécifiques
   - Avec des destinataires contrôlés

### Pour les Tests

1. **Tests unitaires** : Mode sécurisé uniquement
2. **Tests d'intégration** : Mode sécurisé avec simulation
3. **Tests de bout en bout** : Mode réel avec destinataires de test

### Pour la Production

1. **Configuration explicite** :

   ```env
   ENVIRONMENT='production'
   ALLOW_REAL_EMAILS='true'
   ```

2. **Vérification avant déploiement** :
   - Confirmer la configuration de production
   - Tester avec un email de validation

## Surveillance et Logs

### Messages de Sécurité

```
🛡️ BLOCKED: Real email sending disabled in development
📧 Would send to: user@example.com
📝 Subject: RELANCE 1 Sujet Original
✅ Simulated email send (DEVELOPMENT MODE)
```

### Vérification de l'État

Pour vérifier si la protection est active :

```bash
# Vérifier les variables d'environnement
echo "ENVIRONMENT: $(grep ENVIRONMENT .env.local)"
echo "ALLOW_REAL_EMAILS: $(grep ALLOW_REAL_EMAILS .env.local)"
```

## Historique des Incidents

### Incident du 29 Septembre 2025

**Problème** : Envoi accidentel d'emails réels pendant les tests de restructuration du système de relances.

**Cause** : Absence de protection en mode développement lors des tests avec des données réelles.

**Solution** : Implémentation du système de sécurité avec variables d'environnement.

**Prévention** : Configuration par défaut en mode sécurisé pour tous les nouveaux développements.

## Recommandations de Sécurité

1. **Jamais de données réelles en développement** sans protection explicite
2. **Toujours vérifier la configuration** avant les tests
3. **Utiliser des environnements séparés** pour le développement et la production
4. **Documenter tous les changements** de configuration de sécurité
5. **Former l'équipe** aux procédures de sécurité

## Contact et Support

En cas de questions ou d'incidents liés au système de sécurité, documenter :

- Configuration actuelle des variables d'environnement
- Logs de l'incident
- Étapes pour reproduire le problème
- Impact potentiel sur les utilisateurs externes
