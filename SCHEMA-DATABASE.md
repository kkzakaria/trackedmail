# Schéma de Base de Données Supabase

## Vue d'ensemble

Le schéma est conçu pour une application mono-tenant de suivi et relance d'emails, utilisant PostgreSQL via Supabase.

## Tables principales

### 1. users

Table des utilisateurs de l'application (utilise Supabase Auth)

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT auth.uid(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('administrateur', 'manager', 'utilisateur')),
  mailbox_address TEXT, -- Adresse email Microsoft à suivre
  timezone TEXT DEFAULT 'UTC',
  pause_relances BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. mailboxes

Boîtes mail suivies par l'application

```sql
CREATE TABLE mailboxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_address TEXT NOT NULL UNIQUE,
  display_name TEXT,
  microsoft_user_id TEXT, -- ID utilisateur Microsoft Graph
  is_active BOOLEAN DEFAULT true,
  last_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3. user_mailbox_assignments

Assignation des boîtes mail aux utilisateurs

```sql
CREATE TABLE user_mailbox_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  mailbox_id UUID REFERENCES mailboxes(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES users(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, mailbox_id)
);
```

### 4. tracked_emails

Emails envoyés suivis par le système

```sql
CREATE TABLE tracked_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  microsoft_message_id TEXT NOT NULL UNIQUE,
  conversation_id TEXT,
  mailbox_id UUID REFERENCES mailboxes(id) ON DELETE CASCADE,

  -- Métadonnées email
  subject TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  recipient_emails TEXT[] NOT NULL,
  cc_emails TEXT[],
  bcc_emails TEXT[],

  -- Contenu
  body_preview TEXT,
  body_content TEXT,
  has_attachments BOOLEAN DEFAULT false,
  importance TEXT CHECK (importance IN ('low', 'normal', 'high')),

  -- Statut de suivi
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',      -- En attente de réponse
    'responded',    -- A reçu une réponse
    'stopped',      -- Arrêté manuellement
    'max_reached',  -- Max de relances atteint
    'bounced',      -- Email non délivré
    'expired'       -- Expiré après 30 jours
  )),

  -- Dates importantes
  sent_at TIMESTAMPTZ NOT NULL,
  responded_at TIMESTAMPTZ,
  stopped_at TIMESTAMPTZ,

  -- Thread tracking
  is_reply BOOLEAN DEFAULT false,
  parent_message_id TEXT,
  thread_position INTEGER DEFAULT 1,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les recherches fréquentes
CREATE INDEX idx_tracked_emails_status ON tracked_emails(status);
CREATE INDEX idx_tracked_emails_conversation_id ON tracked_emails(conversation_id);
CREATE INDEX idx_tracked_emails_sent_at ON tracked_emails(sent_at);
CREATE INDEX idx_tracked_emails_mailbox_id ON tracked_emails(mailbox_id);
```

### 5. followup_templates

Templates de relance configurables

```sql
CREATE TABLE followup_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  followup_number INTEGER NOT NULL, -- 1ère, 2ème, 3ème relance
  delay_hours INTEGER DEFAULT 96, -- Délai spécifique pour ce template
  is_active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,

  -- Variables disponibles dans le template
  available_variables TEXT[] DEFAULT ARRAY[
    'destinataire_nom',
    'destinataire_entreprise',
    'objet_original',
    'date_envoi_original',
    'numero_relance',
    'jours_depuis_envoi'
  ],

  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(followup_number, is_active) -- Une seule template active par niveau
);
```

### 6. followups

Relances envoyées

```sql
CREATE TABLE followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_email_id UUID REFERENCES tracked_emails(id) ON DELETE CASCADE,
  template_id UUID REFERENCES followup_templates(id),

  -- Données de la relance
  followup_number INTEGER NOT NULL,
  microsoft_message_id TEXT UNIQUE,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,

  -- Statut
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN (
    'scheduled',    -- Programmée
    'sent',        -- Envoyée
    'failed',      -- Échec d'envoi
    'cancelled'    -- Annulée
  )),

  -- Timing
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les relances à traiter
CREATE INDEX idx_followups_scheduled ON followups(scheduled_for) WHERE status = 'scheduled';
CREATE INDEX idx_followups_tracked_email ON followups(tracked_email_id);
```

### 7. email_responses

Réponses détectées aux emails suivis

```sql
CREATE TABLE email_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_email_id UUID REFERENCES tracked_emails(id) ON DELETE CASCADE,
  microsoft_message_id TEXT NOT NULL UNIQUE,

  -- Métadonnées de la réponse
  sender_email TEXT NOT NULL,
  subject TEXT,
  body_preview TEXT,
  received_at TIMESTAMPTZ NOT NULL,

  -- Type de réponse
  response_type TEXT CHECK (response_type IN (
    'direct_reply',     -- Réponse directe
    'forward',          -- Email transféré
    'auto_reply',       -- Réponse automatique
    'bounce'           -- Email non délivré
  )),

  is_auto_response BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_responses_tracked_email ON email_responses(tracked_email_id);
```

### 8. webhook_events

Historique des événements webhook Microsoft Graph

```sql
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id TEXT NOT NULL,
  change_type TEXT NOT NULL,
  resource_data JSONB NOT NULL,
  client_state TEXT,

  -- Traitement
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  processing_error TEXT,
  retry_count INTEGER DEFAULT 0,

  received_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_events_processed ON webhook_events(processed);
CREATE INDEX idx_webhook_events_received_at ON webhook_events(received_at);
```

### 9. microsoft_graph_tokens

Gestion sécurisée des tokens Microsoft Graph

```sql
CREATE TABLE microsoft_graph_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_type TEXT NOT NULL, -- 'access' ou 'refresh'
  encrypted_token TEXT NOT NULL, -- Token chiffré avec Supabase Vault
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT,
  last_refreshed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 10. system_config

Configuration globale du système

```sql
CREATE TABLE system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configuration par défaut
INSERT INTO system_config (key, value, description) VALUES
  ('working_hours', '{
    "timezone": "UTC",
    "start": "07:00",
    "end": "18:00",
    "working_days": ["monday", "tuesday", "wednesday", "thursday", "friday"],
    "holidays": []
  }', 'Heures de travail pour les relances'),
  ('followup_settings', '{
    "max_followups": 3,
    "default_interval_hours": 96,
    "stop_after_days": 30,
    "stop_on_bounce": true,
    "stop_on_unsubscribe": true
  }', 'Paramètres de relance');
```

### 11. audit_logs

Logs d'audit pour la conformité

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
```

## Row Level Security (RLS)

```sql
-- Activation RLS sur toutes les tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE mailboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracked_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE followup_templates ENABLE ROW LEVEL SECURITY;

-- Politiques pour les utilisateurs
CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- Politiques pour les emails suivis
CREATE POLICY "Users can view assigned mailbox emails"
  ON tracked_emails FOR SELECT
  USING (
    mailbox_id IN (
      SELECT mailbox_id FROM user_mailbox_assignments
      WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('manager', 'administrateur')
    )
  );

-- Managers et admins peuvent voir tout
CREATE POLICY "Managers can view all data"
  ON tracked_emails FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('manager', 'administrateur')
    )
  );
```

## Functions et Triggers

```sql
-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Appliquer le trigger à toutes les tables avec updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_tracked_emails_updated_at BEFORE UPDATE ON tracked_emails
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Fonction pour détecter les réponses et mettre à jour le statut
CREATE OR REPLACE FUNCTION update_email_status_on_response()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE tracked_emails
  SET
    status = 'responded',
    responded_at = NEW.received_at
  WHERE id = NEW.tracked_email_id
    AND status = 'pending';

  -- Annuler les relances programmées
  UPDATE followups
  SET status = 'cancelled'
  WHERE tracked_email_id = NEW.tracked_email_id
    AND status = 'scheduled';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_email_status
  AFTER INSERT ON email_responses
  FOR EACH ROW EXECUTE FUNCTION update_email_status_on_response();
```

## Views utiles

```sql
-- Vue des emails nécessitant une relance
CREATE VIEW emails_needing_followup AS
SELECT
  te.*,
  COALESCE(MAX(f.followup_number), 0) as last_followup_number,
  MAX(f.sent_at) as last_followup_at
FROM tracked_emails te
LEFT JOIN followups f ON f.tracked_email_id = te.id AND f.status = 'sent'
WHERE te.status = 'pending'
  AND te.sent_at < NOW() - INTERVAL '96 hours'
GROUP BY te.id
HAVING COALESCE(MAX(f.followup_number), 0) < 3;

-- Vue statistiques par boîte mail
CREATE VIEW mailbox_statistics AS
SELECT
  m.id,
  m.email_address,
  COUNT(DISTINCT te.id) as total_emails,
  COUNT(DISTINCT te.id) FILTER (WHERE te.status = 'pending') as pending_emails,
  COUNT(DISTINCT te.id) FILTER (WHERE te.status = 'responded') as responded_emails,
  COUNT(DISTINCT f.id) as total_followups_sent,
  ROUND(
    COUNT(DISTINCT te.id) FILTER (WHERE te.status = 'responded')::numeric /
    NULLIF(COUNT(DISTINCT te.id), 0) * 100, 2
  ) as response_rate
FROM mailboxes m
LEFT JOIN tracked_emails te ON te.mailbox_id = m.id
LEFT JOIN followups f ON f.tracked_email_id = te.id AND f.status = 'sent'
GROUP BY m.id, m.email_address;
```

## Indexes supplémentaires pour les performances

```sql
-- Index composite pour les requêtes de relance
CREATE INDEX idx_tracked_emails_pending_sent
  ON tracked_emails(status, sent_at)
  WHERE status = 'pending';

-- Index pour la recherche par email
CREATE INDEX idx_tracked_emails_recipient_emails
  ON tracked_emails USING GIN(recipient_emails);

-- Index pour les webhooks non traités
CREATE INDEX idx_webhook_events_unprocessed
  ON webhook_events(received_at)
  WHERE processed = false;
```
