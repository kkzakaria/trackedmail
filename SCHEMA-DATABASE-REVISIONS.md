# Révisions du Schéma de Base de Données

## Analyse basée sur FLUX-DETECTION-REPONSES.md et Microsoft Graph API

### Propriétés manquantes identifiées

D'après l'analyse du flux de détection et de la documentation Microsoft Graph, voici les propriétés importantes à ajouter :

## 1. Table `tracked_emails` - Ajouts requis

### Propriétés pour la détection des réponses
```sql
-- Ajouter ces colonnes à la table tracked_emails
ALTER TABLE tracked_emails ADD COLUMN conversation_index TEXT; -- Pour l'ordre chronologique dans le thread
ALTER TABLE tracked_emails ADD COLUMN internet_message_id TEXT; -- ID standard RFC pour le threading
ALTER TABLE tracked_emails ADD COLUMN in_reply_to TEXT; -- Reference directe au message parent
ALTER TABLE tracked_emails ADD COLUMN references TEXT; -- Chaîne complète des références du thread
```

### Justification
- **conversation_index**: Propriété Microsoft Graph pour déterminer l'ordre des messages dans une conversation
- **internet_message_id**: ID unique standard (format `<id@domain>`) utilisé pour le threading email
- **in_reply_to**: Référence directe au message auquel on répond (crucial pour la détection)
- **references**: Chaîne contenant tous les IDs de messages du thread

## 2. Table `webhook_subscriptions` - Nouvelle table requise

```sql
CREATE TABLE webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id TEXT NOT NULL UNIQUE, -- ID retourné par Microsoft Graph
  resource TEXT NOT NULL, -- Ex: /users/{id}/messages
  change_type TEXT NOT NULL, -- created, updated, deleted
  notification_url TEXT NOT NULL,
  expiration_date_time TIMESTAMPTZ NOT NULL,
  client_state TEXT NOT NULL, -- Secret pour validation

  -- Gestion du cycle de vie
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_renewed_at TIMESTAMPTZ,
  renewal_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,

  -- Métadonnées
  mailbox_id UUID REFERENCES mailboxes(id) ON DELETE CASCADE,
  include_resource_data BOOLEAN DEFAULT false,

  CONSTRAINT chk_change_type CHECK (change_type IN ('created', 'updated', 'deleted'))
);

CREATE INDEX idx_webhook_subscriptions_expiration ON webhook_subscriptions(expiration_date_time) WHERE is_active = true;
CREATE INDEX idx_webhook_subscriptions_mailbox ON webhook_subscriptions(mailbox_id);
```

## 3. Table `email_responses` - Révisions

```sql
-- Ajouter ces colonnes manquantes
ALTER TABLE email_responses ADD COLUMN conversation_id TEXT;
ALTER TABLE email_responses ADD COLUMN conversation_index TEXT;
ALTER TABLE email_responses ADD COLUMN internet_message_id TEXT;
ALTER TABLE email_responses ADD COLUMN in_reply_to TEXT;
ALTER TABLE email_responses ADD COLUMN references TEXT;
ALTER TABLE email_responses ADD COLUMN body_content TEXT; -- Pas seulement preview

-- Index supplémentaires pour la détection
CREATE INDEX idx_email_responses_conversation_id ON email_responses(conversation_id);
CREATE INDEX idx_email_responses_internet_message_id ON email_responses(internet_message_id);
```

## 4. Table `system_config` - Ajout configuration tenant

```sql
-- Ajouter la configuration du domaine tenant
INSERT INTO system_config (key, value, description) VALUES
  ('tenant_config', '{
    "domain": "@company.com",
    "microsoft_tenant_id": "",
    "exclude_internal_emails": true
  }', 'Configuration du tenant Microsoft');
```

## 5. Table `message_headers` - Nouvelle table pour les headers

```sql
CREATE TABLE message_headers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_email_id UUID REFERENCES tracked_emails(id) ON DELETE CASCADE,
  email_response_id UUID REFERENCES email_responses(id) ON DELETE CASCADE,

  header_name TEXT NOT NULL,
  header_value TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Contrainte: soit tracked_email_id soit email_response_id doit être défini
  CONSTRAINT chk_message_reference CHECK (
    (tracked_email_id IS NOT NULL AND email_response_id IS NULL) OR
    (tracked_email_id IS NULL AND email_response_id IS NOT NULL)
  )
);

CREATE INDEX idx_message_headers_tracked_email ON message_headers(tracked_email_id);
CREATE INDEX idx_message_headers_email_response ON message_headers(email_response_id);
CREATE INDEX idx_message_headers_name ON message_headers(header_name);
```

## 6. Table `detection_logs` - Pour le monitoring

```sql
CREATE TABLE detection_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Message analysé
  microsoft_message_id TEXT NOT NULL,
  conversation_id TEXT,

  -- Résultat de la détection
  is_response BOOLEAN NOT NULL,
  tracked_email_id UUID REFERENCES tracked_emails(id),
  detection_method TEXT CHECK (detection_method IN (
    'conversation_id',
    'in_reply_to',
    'references',
    'heuristic',
    'not_detected'
  )),

  -- Raison du rejet si applicable
  rejection_reason TEXT CHECK (rejection_reason IN (
    'internal_email',
    'already_responded',
    'auto_response',
    'no_match',
    NULL
  )),

  -- Métriques
  detection_time_ms INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_detection_logs_created_at ON detection_logs(created_at);
CREATE INDEX idx_detection_logs_tracked_email ON detection_logs(tracked_email_id);
```

## 7. Index supplémentaires pour les performances

```sql
-- Index pour la recherche par conversation
CREATE INDEX idx_tracked_emails_conversation_id ON tracked_emails(conversation_id);
CREATE INDEX idx_tracked_emails_internet_message_id ON tracked_emails(internet_message_id);

-- Index composites pour la détection
CREATE INDEX idx_tracked_emails_conv_status
  ON tracked_emails(conversation_id, status)
  WHERE status = 'pending';

CREATE INDEX idx_tracked_emails_msgid_status
  ON tracked_emails(internet_message_id, status)
  WHERE status = 'pending';

-- Index pour le nettoyage des messages du tenant
CREATE INDEX idx_tracked_emails_sender
  ON tracked_emails(sender_email)
  WHERE sender_email LIKE '%@company.com';
```

## 8. Fonction pour nettoyer les sujets

```sql
CREATE OR REPLACE FUNCTION clean_email_subject(subject TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Enlever les préfixes de réponse/transfert
  RETURN TRIM(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        subject,
        '^(RE:|FW:|FWD:|TR:)\s*', '', 'gi'
      ),
      '^\[.*?\]\s*', '', 'g'
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Index fonctionnel pour la recherche par sujet nettoyé
CREATE INDEX idx_tracked_emails_clean_subject
  ON tracked_emails(clean_email_subject(subject));
```

## 9. Vue pour les emails nécessitant une analyse

```sql
CREATE VIEW pending_response_detection AS
SELECT
  te.*,
  COALESCE(er.count_responses, 0) as response_count
FROM tracked_emails te
LEFT JOIN (
  SELECT tracked_email_id, COUNT(*) as count_responses
  FROM email_responses
  GROUP BY tracked_email_id
) er ON er.tracked_email_id = te.id
WHERE te.status = 'pending'
  AND NOT EXISTS (
    SELECT 1 FROM email_responses
    WHERE tracked_email_id = te.id
    AND NOT is_auto_response
  );
```

## Résumé des changements critiques

1. **Ajout des propriétés de threading** : `conversation_index`, `internet_message_id`, `in_reply_to`, `references`
2. **Nouvelle table `webhook_subscriptions`** : Pour gérer les souscriptions Microsoft Graph
3. **Nouvelle table `message_headers`** : Pour stocker les headers importants (Auto-Submitted, etc.)
4. **Nouvelle table `detection_logs`** : Pour le monitoring et le debugging
5. **Configuration du tenant** : Ajout du domaine pour exclure les emails internes
6. **Index optimisés** : Pour améliorer les performances de détection
7. **Fonction de nettoyage des sujets** : Pour l'analyse heuristique

Ces modifications permettront une détection fiable des réponses selon les mécanismes décrits dans FLUX-DETECTION-REPONSES.md.