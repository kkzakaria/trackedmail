# API Technique - Système de Relances

## Edge Functions

### microsoft-webhook

**Endpoint** : `POST /functions/v1/microsoft-webhook`

#### Fonctions Principales microsoft-webhook

##### `handlePotentialManualFollowup()`

Détecte et traite les relances manuelles basées sur le conversationId.

```typescript
async function handlePotentialManualFollowup(
  supabase: EdgeSupabaseClient,
  messageDetails: EmailMessage,
  startTime: Date
): Promise<boolean>;
```

**Paramètres** :

- `supabase` : Client Supabase avec droits service
- `messageDetails` : Détails de l'email Microsoft Graph
- `startTime` : Timestamp de début de traitement

**Retour** : `true` si relance manuelle détectée et traitée

**Logique** :

1. Recherche email original par conversationId
2. Vérification expéditeur identique
3. Vérification absence de doublon dans manual_followups
4. Calcul du numéro de séquence
5. Insertion dans manual_followups
6. Replanification des relances automatiques

##### `detectIsReply()`

Détecte si un email est une réponse basé sur les headers Microsoft.

```typescript
function detectIsReply(messageDetails: EmailMessage): boolean;
```

**Critères de détection** :

- Présence de `inReplyTo` header
- Présence de `references` header
- Subject commençant par "RE:", "Re:" ou équivalent
- ConversationIndex indiquant une réponse

#### Logs de Debug

```texte
🔍 Detected reply email, checking for manual followup: ${subject}
📧 Found original email for conversation ${conversationId}
✅ Manual followup detected and processed
⚠️ Manual followup already exists for this message
🚨 Failed to insert manual followup: ${error}
```

### followup-scheduler

**Endpoint** : `POST /functions/v1/followup-scheduler`

#### Fonctions Principales followup-scheduler

##### `getEmailsNeedingFollowup()`

Récupère les emails nécessitant des relances en tenant compte des relances manuelles.

```typescript
async function getEmailsNeedingFollowup(
  supabase: EdgeSupabaseClient
): Promise<Array<TrackedEmailWithCounts>>;
```

**Query SQL** :

```sql
SELECT
  te.*,
  GREATEST(te.sent_at, COALESCE(last_activity.last_activity_at, te.sent_at)) as last_activity_at,
  COALESCE(total_counts.total_followups, 0) as total_followups_sent
FROM tracked_emails te
LEFT JOIN (
  SELECT
    tracked_email_id,
    GREATEST(
      COALESCE(MAX(f.sent_at), '1970-01-01'::timestamptz),
      COALESCE(MAX(mf.detected_at), '1970-01-01'::timestamptz)
    ) as last_activity_at
  FROM followups f
  FULL OUTER JOIN manual_followups mf ON f.tracked_email_id = mf.tracked_email_id
  GROUP BY COALESCE(f.tracked_email_id, mf.tracked_email_id)
) last_activity ON te.id = last_activity.tracked_email_id
WHERE te.status = 'pending'
AND GREATEST(te.sent_at, COALESCE(last_activity.last_activity_at, te.sent_at)) <= NOW() - INTERVAL '4 hours'
```

##### `processEmailForFollowups()`

Traite un email pour créer les relances automatiques.

```typescript
async function processEmailForFollowups(
  supabase: EdgeSupabaseClient,
  email: TrackedEmailWithCounts,
  templates: FollowupTemplateRow[],
  workingHours: WorkingHoursConfig
): Promise<number>;
```

**Logique Améliorée** :

1. Calcul total relances (manuelles + automatiques)
2. Vérification limite maximum (3)
3. Détermination numéro relance automatique suivant
4. Application heures ouvrables
5. Insertion relance avec statut 'scheduled'

##### `getTotalFollowupsCount()`

Compte le total des relances (manuelles + automatiques) pour un email.

```typescript
async function getTotalFollowupsCount(
  supabase: EdgeSupabaseClient,
  trackedEmailId: string
): Promise<number>;
```

**Query SQL** :

```sql
SELECT get_total_followup_count($1::uuid) as total_count
```

## Fonctions SQL Utilitaires

### `get_total_followup_count(UUID)`

```sql
CREATE OR REPLACE FUNCTION get_total_followup_count(
  p_tracked_email_id UUID
) RETURNS INTEGER AS $$
DECLARE
  automatic_count INTEGER;
  manual_count INTEGER;
BEGIN
  -- Compteur relances automatiques envoyées
  SELECT COUNT(*) INTO automatic_count
  FROM followups
  WHERE tracked_email_id = p_tracked_email_id
    AND status = 'sent';

  -- Compteur relances manuelles
  SELECT COUNT(*) INTO manual_count
  FROM manual_followups
  WHERE tracked_email_id = p_tracked_email_id;

  RETURN COALESCE(automatic_count, 0) + COALESCE(manual_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### `reschedule_pending_followups(UUID, TIMESTAMPTZ, INTEGER)`

```sql
CREATE OR REPLACE FUNCTION reschedule_pending_followups(
  p_tracked_email_id UUID,
  p_base_time TIMESTAMPTZ,
  p_adjustment_hours INTEGER DEFAULT 4
) RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- Replanification relances en attente
  UPDATE followups
  SET
    scheduled_for = p_base_time + (p_adjustment_hours * followup_number || ' hours')::INTERVAL,
    updated_at = NOW()
  WHERE tracked_email_id = p_tracked_email_id
    AND status = 'scheduled'
    AND scheduled_for > NOW();

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  -- Logging audit
  INSERT INTO audit_logs (
    action, entity_type, entity_id,
    new_values, created_at
  ) VALUES (
    'reschedule_followups',
    'followups',
    p_tracked_email_id,
    jsonb_build_object(
      'adjustment_hours', p_adjustment_hours,
      'base_time', p_base_time,
      'updated_count', updated_count
    ),
    NOW()
  );

  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Vue `followup_activity_summary`

Vue unifiée combinant relances automatiques et manuelles.

```sql
CREATE OR REPLACE VIEW followup_activity_summary AS
SELECT
  te.id,
  te.subject,
  te.status,
  te.sent_at,
  te.conversation_id,
  te.sender_email,
  te.recipient_emails,

  -- Statistiques
  COALESCE(auto_stats.count, 0) as automatic_followups,
  COALESCE(manual_stats.count, 0) as manual_followups,
  COALESCE(auto_stats.count, 0) + COALESCE(manual_stats.count, 0) as total_followups,

  -- Dernière activité
  GREATEST(
    te.sent_at,
    auto_stats.last_sent,
    manual_stats.last_detected
  ) as last_activity_at,

  -- Statut effectif
  CASE
    WHEN COALESCE(auto_stats.count, 0) + COALESCE(manual_stats.count, 0) >= 3 THEN 'max_reached'
    WHEN te.status = 'pending' AND COALESCE(auto_stats.count, 0) + COALESCE(manual_stats.count, 0) > 0 THEN 'active_followup'
    ELSE te.status
  END as effective_status,

  -- Prochaine relance automatique
  next_auto.scheduled_for as next_automatic_followup,
  next_auto.followup_number as next_followup_number,

  -- Détails pour dashboard
  json_build_object(
    'automatic', auto_stats.details,
    'manual', manual_stats.details
  ) as followup_details

FROM tracked_emails te

-- Stats relances automatiques
LEFT JOIN (
  SELECT
    tracked_email_id,
    COUNT(*) as count,
    MAX(sent_at) as last_sent,
    json_agg(
      json_build_object(
        'followup_number', followup_number,
        'sent_at', sent_at,
        'subject', subject,
        'status', status
      ) ORDER BY followup_number
    ) as details
  FROM followups
  WHERE status = 'sent'
  GROUP BY tracked_email_id
) auto_stats ON te.id = auto_stats.tracked_email_id

-- Stats relances manuelles
LEFT JOIN (
  SELECT
    tracked_email_id,
    COUNT(*) as count,
    MAX(detected_at) as last_detected,
    json_agg(
      json_build_object(
        'sequence_number', followup_sequence_number,
        'detected_at', detected_at,
        'subject', subject,
        'sender_email', sender_email
      ) ORDER BY followup_sequence_number
    ) as details
  FROM manual_followups
  GROUP BY tracked_email_id
) manual_stats ON te.id = manual_stats.tracked_email_id

-- Prochaine relance automatique
LEFT JOIN (
  SELECT DISTINCT ON (tracked_email_id)
    tracked_email_id,
    scheduled_for,
    followup_number
  FROM followups
  WHERE status = 'scheduled'
    AND scheduled_for > NOW()
  ORDER BY tracked_email_id, scheduled_for ASC
) next_auto ON te.id = next_auto.tracked_email_id;
```

## Types TypeScript

### Types Principaux

```typescript
// Type pour email avec compteur relances
interface TrackedEmailWithCounts {
  id: string;
  subject: string;
  sender_email: string;
  recipient_emails: string[];
  sent_at: string;
  status: string;
  conversation_id: string;
  last_activity_at: string;
  total_followups_sent: number;
}

// Type pour relance manuelle
interface ManualFollowupInsert {
  tracked_email_id: string;
  microsoft_message_id: string;
  conversation_id: string;
  sender_email: string;
  subject?: string;
  followup_sequence_number: number;
  affects_automatic_scheduling: boolean;
}

// Type pour résultat coordination
interface CoordinationResult {
  manual_followup_created: boolean;
  automatic_followups_rescheduled: number;
  next_automatic_followup_number: number;
  max_followups_reached: boolean;
}
```

### Types pour Configuration

```typescript
interface WorkingHoursConfig {
  timezone: string;
  start: string; // "07:00"
  end: string; // "18:00"
  working_days: WorkingDay[];
  holidays: string[]; // ISO dates
}

interface FollowupSettings {
  max_followups: number;
  default_interval_hours: number;
  stop_after_days: number;
  rate_limit_per_hour: number;
  system_enabled: boolean;
  stop_on_bounce: boolean;
  stop_on_unsubscribe: boolean;
}
```

## Algorithme de Coordination

### Pseudo-Code Principal

```texte
fonction handleManualFollowup(email):
  1. Vérifier si email original existe (conversationId)
  2. Vérifier si pas déjà détecté (microsoft_message_id)
  3. Calculer numéro séquence = total_followups_count + 1
  4. Insérer dans manual_followups
  5. Si affects_automatic_scheduling = true:
     a. Appeler reschedule_pending_followups()
     b. Logger replanification
  6. Vérifier si limite maximum atteinte
  7. Si max atteint, marquer tracked_email comme 'max_reached'

fonction schedulerLogic(email):
  1. total_followups = get_total_followup_count(email.id)
  2. Si total_followups >= max_followups: marquer 'max_reached'
  3. next_followup_number = total_followups + 1
  4. Calculer scheduled_for = last_activity + (interval * next_followup_number)
  5. Ajuster pour heures ouvrables si activé
  6. Insérer followup avec statut 'scheduled'
```

### Séquencement des Relances

```texte
Email Original (T0)
├── Relance Auto #1 (T0 + 4h) OU Relance Manuelle (T0 + Xh)
├── Relance Auto #2 (dernière_activité + 4h)
└── Relance Auto #3 (dernière_activité + 4h) → MAX ATTEINT
```

## Monitoring et Observabilité

### Métriques Clés

```typescript
interface SystemMetrics {
  // Volume
  total_emails_tracked: number;
  total_followups_sent: number;
  total_manual_followups_detected: number;

  // Performance
  detection_accuracy: number; // % relances manuelles bien détectées
  coordination_success_rate: number; // % replanifications réussies
  average_response_time: number; // Temps moyen réponse après relance

  // Santé système
  webhook_processing_time_ms: number;
  scheduler_execution_time_ms: number;
  failed_operations_count: number;
}
```

### Logs Structurés

```typescript
interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  component: "webhook" | "scheduler" | "database";
  operation: string;
  details: Record<string, unknown>;
  performance_ms?: number;
  error?: string;
}
```

### Alertes Automatiques

- **Détection en échec** : Si > 10% des emails Reply ne sont pas détectés comme relances manuelles
- **Replanification échouée** : Si reschedule_pending_followups() échoue
- **Templates inactifs** : Si aucun template actif trouvé
- **Limite dépassée** : Si tentative d'envoi > 3 relances

## Tests et Validation

### Tests Automatisés

```typescript
describe("Manual Followup Detection", () => {
  test("should detect manual followup via conversationId", async () => {
    // Créer email original
    const originalEmail = await createTrackedEmail();

    // Simuler relance manuelle avec même conversationId
    const replyEmail = createReplyEmail(originalEmail.conversation_id);

    // Traiter via webhook
    const result = await handlePotentialManualFollowup(supabase, replyEmail);

    expect(result).toBe(true);

    // Vérifier insertion manual_followups
    const manualFollowup = await supabase
      .from("manual_followups")
      .select("*")
      .eq("tracked_email_id", originalEmail.id)
      .single();

    expect(manualFollowup.data).not.toBeNull();
    expect(manualFollowup.data.followup_sequence_number).toBe(1);
  });

  test("should reschedule pending automatic followups", async () => {
    // Setup email avec relances automatiques programmées
    const email = await setupEmailWithPendingFollowups();

    // Déclencher relance manuelle
    await triggerManualFollowup(email);

    // Vérifier replanification
    const followups = await getPendingFollowups(email.id);
    followups.forEach(followup => {
      expect(followup.scheduled_for).toBeAfter(originalSchedule);
    });
  });
});
```

### Validation de Données

```sql
-- Vérifier cohérence séquences
SELECT
  te.id,
  COUNT(f.*) as automatic_count,
  COUNT(mf.*) as manual_count,
  MAX(mf.followup_sequence_number) as max_sequence
FROM tracked_emails te
LEFT JOIN followups f ON te.id = f.tracked_email_id AND f.status = 'sent'
LEFT JOIN manual_followups mf ON te.id = mf.tracked_email_id
GROUP BY te.id
HAVING COUNT(f.*) + COUNT(mf.*) > 3; -- Détecte dépassement limite

-- Vérifier doublon détection
SELECT
  microsoft_message_id,
  COUNT(*) as duplicate_count
FROM manual_followups
GROUP BY microsoft_message_id
HAVING COUNT(*) > 1; -- Détecte doublons
```

---

_Documentation API mise à jour avec le système de coordination manuel/automatique. Version 2025-09-24._
