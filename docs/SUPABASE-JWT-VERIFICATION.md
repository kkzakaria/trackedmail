# Comprendre verify_jwt dans Supabase Edge Functions

**Date** : 30 septembre 2025
**Sujet** : Comportement par défaut de la vérification JWT dans les Edge Functions

---

## 🔐 Comportement par Défaut de Supabase

### Règle Importante

**Toutes les Edge Functions ont `verify_jwt = true` par défaut**, même si aucune configuration n'est spécifiée dans `config.toml`.

### Pourquoi ?

Supabase protège vos fonctions par défaut en exigeant une authentification JWT pour chaque requête. C'est une mesure de sécurité pour éviter les appels non autorisés.

---

## 📋 Niveaux de Configuration

### Niveau 1 : Comportement par Défaut (Implicite)

```toml
# Aucune configuration = verify_jwt: true par défaut
# Toutes les fonctions NON configurées utilisent ce comportement
```

**Résultat** :

- Requêtes sans JWT → **401 Unauthorized**
- Requêtes avec JWT valide → ✅ Fonction exécutée

### Niveau 2 : Configuration dans config.toml

```toml
[functions.ma-fonction]
enabled = true
verify_jwt = false  # Override le comportement par défaut
```

**Résultat** :

- Toutes les requêtes → ✅ Fonction exécutée (pas de vérification JWT)
- En développement local uniquement

### Niveau 3 : Déploiement en Production (--no-verify-jwt)

```bash
supabase functions deploy ma-fonction --no-verify-jwt
```

**Résultat** :

- Configuration en production
- Override la vérification JWT pour cette fonction spécifique
- Nécessaire pour les cron jobs et webhooks

---

## 🔧 Notre Cas d'Usage : Cron Jobs

### Problème Rencontré

1. **followup-processor** n'avait **aucune configuration** dans `config.toml`
2. Supabase a appliqué `verify_jwt = true` par défaut
3. Les cron jobs n'envoient pas de JWT → **401 Unauthorized**

### Solution Appliquée

**1. Configuration locale (config.toml)**

```toml
[functions.followup-processor]
enabled = true
verify_jwt = false
import_map = "./functions/followup-processor/deno.json"
entrypoint = "./functions/followup-processor/index.ts"

[functions.followup-maintenance]
enabled = true
verify_jwt = false
entrypoint = "./functions/followup-maintenance/index.ts"

[functions.bounce-processor]
enabled = true
verify_jwt = false
import_map = "./functions/bounce-processor/deno.json"
entrypoint = "./functions/bounce-processor/index.ts"
```

**2. Déploiement en production**

```bash
supabase functions deploy followup-processor --no-verify-jwt
supabase functions deploy followup-maintenance --no-verify-jwt
supabase functions deploy bounce-processor --no-verify-jwt
```

**3. Authentification personnalisée**

Nous avons implémenté notre propre système d'authentification :

- Header `X-Internal-Key` pour les cron jobs
- Header `Authorization: Bearer` pour compatibilité
- Validation dans le code via `auth-validator.ts`

---

## 📊 Tableau Comparatif

| Configuration                            | Local (dev)          | Production           | Authentification                |
| ---------------------------------------- | -------------------- | -------------------- | ------------------------------- |
| Aucune config                            | `verify_jwt = true`  | `verify_jwt = true`  | JWT requis                      |
| `verify_jwt = false` dans config.toml    | `verify_jwt = false` | `verify_jwt = true`  | Local: aucune, Prod: JWT requis |
| `verify_jwt = false` + `--no-verify-jwt` | `verify_jwt = false` | `verify_jwt = false` | Aucune (gérée par code)         |

---

## ⚠️ Implications de Sécurité

### Avec verify_jwt = true (défaut)

✅ **Avantages** :

- Protection automatique contre les accès non autorisés
- Intégration native avec Supabase Auth
- Pas besoin d'implémenter sa propre authentification

❌ **Inconvénients** :

- Les cron jobs ne peuvent pas appeler les fonctions (pas de JWT)
- Les webhooks externes nécessitent un JWT
- Moins de flexibilité pour les appels inter-services

### Avec verify_jwt = false + authentification personnalisée

✅ **Avantages** :

- Flexibilité pour les cron jobs et webhooks
- Authentification adaptée au cas d'usage (X-Internal-Key)
- Contrôle total sur la logique d'authentification

❌ **Inconvénients** :

- Responsabilité de sécuriser correctement les fonctions
- Besoin d'implémenter et maintenir le code d'authentification
- Risque si l'implémentation est incorrecte

---

## 🎯 Recommandations

### Pour les fonctions publiques (API endpoints)

✅ **Garder** `verify_jwt = true`

- Protection automatique
- Intégration avec Supabase Auth
- Meilleure sécurité par défaut

### Pour les cron jobs et services internes

✅ **Utiliser** `verify_jwt = false` + authentification personnalisée

- X-Internal-Key pour les cron jobs
- Bearer token pour les appels avec service_role_key
- Validation explicite dans le code

### Pour les webhooks externes (Microsoft, Stripe, etc.)

✅ **Utiliser** `verify_jwt = false` + validation spécifique

- Validation de signature pour Microsoft webhooks
- Validation de secret pour Stripe webhooks
- Chaque provider a sa propre méthode d'authentification

---

## 📝 Checklist de Sécurité

Pour les fonctions avec `verify_jwt = false` :

- [ ] Implémenter une authentification alternative (X-Internal-Key, signature, etc.)
- [ ] Valider TOUS les headers et paramètres entrants
- [ ] Logger les tentatives d'accès non autorisées
- [ ] Limiter les endpoints exposés publiquement
- [ ] Rotation régulière des clés d'authentification (tous les 90 jours)
- [ ] Utiliser HTTPS uniquement en production
- [ ] Ne jamais exposer les clés dans le code source ou logs

---

## 🔗 Références

- [Supabase Edge Functions - JWT Verification](https://supabase.com/docs/guides/functions/auth)
- [Supabase CLI - Deploy Functions](https://supabase.com/docs/reference/cli/supabase-functions-deploy)
- Documentation interne : `INTERNAL-KEY-AUTH-IMPLEMENTATION.md`
- Guide de déploiement : `PRODUCTION-DEPLOYMENT-GUIDE.md`
