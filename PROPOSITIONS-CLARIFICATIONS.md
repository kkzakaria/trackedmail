# Propositions pour les Points Importants

## 1. Logique de Relance

### Configuration des relances

```yaml
relance_config:
  max_relances: 3 # Maximum de relances par email
  intervalle: 4h # Délai entre chaque relance
  heures_travail:
    debut: "07:00"
    fin: "18:00"
    timezone: "UTC"
    jours_ouvres: ["lundi", "mardi", "mercredi", "jeudi", "vendredi"]

  arret_automatique:
    - apres_max_relances: true
    - apres_reponse: true
    - apres_bounce: true
    - apres_desabonnement: true
    - apres_30_jours: true
```

### Gestion intelligente

- **Jours non-ouvrés**: Report automatique au prochain jour ouvré
- **Personnalisation**: Configuration globale des horaires de travail
- **Escalade progressive**: Possibilité de changer de template à chaque relance

## 2. Templates de Relance

### Structure des templates

```typescript
interface RelanceTemplate {
  id: string;
  nom: string;
  objet: string;
  corps: string;
  variables: Variable[];
  niveau_relance: number; // 1, 2, 3...
  delai_personnalise?: number; // Override du délai par défaut
  version: number;
  actif: boolean;
  created_at: Date;
  updated_at: Date;
}

interface Variable {
  nom: string;
  type: "text" | "date" | "number" | "email";
  source: "email_original" | "destinataire" | "expediteur" | "custom";
  valeur_par_defaut?: any;
}
```

### Variables disponibles

```texte
{{destinataire.nom}}
{{destinataire.entreprise}}
{{email_original.objet}}
{{email_original.date_envoi}}
{{numero_relance}}
{{jours_depuis_envoi}}
{{expediteur.nom}}
{{expediteur.signature}}
```

### Fonctionnalités

- **Preview en temps réel** avec données réelles
- **Validation syntaxique** des variables
- **Versioning** avec historique des modifications
- **A/B testing** possible sur les templates

## 3. Permissions Microsoft Graph

### Stratégie de gestion des tokens

```typescript
interface TokenStrategy {
  // Stockage sécurisé
  storage: {
    location: "supabase_vault";
    encryption: "AES-256-GCM";
    rotation_days: 30;
  };

  // Renouvellement automatique
  refresh: {
    auto_refresh: true;
    before_expiry_minutes: 15;
    retry_attempts: 3;
    fallback_notification: true;
  };

  // Permissions consolidées
  permissions: ["Mail.ReadWrite", "Mail.Send", "User.Read.All"];
}
```

### Mécanisme de refresh

1. **Refresh proactif**: 15 minutes avant expiration
2. **Queue de retry**: En cas d'échec, retry exponentiel
3. **Notification admin**: Si échec après 3 tentatives
4. **Token de secours**: Possibilité de token backup

## 4. Webhooks Microsoft Graph

### Gestion des subscriptions

```typescript
interface WebhookSubscription {
  id: string;
  resource: string;
  changeType: "created" | "updated" | "deleted";
  notificationUrl: string;
  expirationDateTime: Date;
  clientState: string;

  // Gestion du cycle de vie
  lifecycle: {
    duree_initiale: "4230 minutes"; // ~3 jours (max Graph API)
    renouvellement_avant: "60 minutes";
    auto_renouvellement: true;
    max_renouvellements: 100;
  };
}
```

### Gestion des échecs

```typescript
interface FailureHandling {
  retry_policy: {
    max_attempts: 5;
    backoff_type: "exponential";
    initial_delay_seconds: 1;
    max_delay_seconds: 300;
  };

  dead_letter_queue: {
    enabled: true;
    storage: "supabase_table";
    retention_days: 30;
    alert_after_count: 10;
  };

  circuit_breaker: {
    enabled: true;
    failure_threshold: 5;
    timeout_seconds: 60;
    half_open_requests: 3;
  };
}
```

### Validation des webhooks

- **Validation du token**: Vérification de la signature Microsoft
- **Validation du clientState**: Correspondance avec notre état stocké
- **Rate limiting**: Protection contre les flood
- **Idempotence**: Gestion des doublons via messageId

## 5. Heures de Travail

### Configuration globale

```typescript
interface HeuresTravail {
  // Configuration unique pour toute l'application
  timezone: "UTC";
  debut: "07:00";
  fin: "18:00";
  jours_ouvres: ["lundi", "mardi", "mercredi", "jeudi", "vendredi"];
  jours_feries: Date[];

  // Override par utilisateur (optionnel)
  overrides_utilisateur?: {
    [userId: string]: {
      timezone?: string;
      pause_relances?: boolean;
    };
  };
}
```

### Gestion des fuseaux horaires

- **Conversion automatique**: UTC en base, conversion pour affichage utilisateur
- **Détection automatique**: Via browser API à l'inscription
- **Support DST**: Gestion automatique des changements d'heure
- **Configuration administrative**: Modifiable uniquement par l'administrateur

## Implementation recommandée

### Priorités

1. **Phase 1**: Templates basiques + logique de relance simple
2. **Phase 2**: Gestion avancée des webhooks + refresh token
3. **Phase 3**: Personnalisation horaires + templates avancés
4. **Phase 4**: A/B testing + analytics avancés

### Points d'attention

- Tester la resilience des webhooks avec des simulations d'échec
- Prévoir un mode dégradé si Graph API indisponible
- Implémenter des métriques de performance dès le début
- Documenter les limites de l'API Graph (throttling, quotas)
