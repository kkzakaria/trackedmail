-- Migration: Ajouter le tracking de conversation aux réponses détectées
-- Permet de charger les threads complets via Microsoft Graph API

-- Ajouter les identifiants Microsoft nécessaires pour récupérer les threads
ALTER TABLE email_responses
  ADD COLUMN IF NOT EXISTS conversation_id TEXT,
  ADD COLUMN IF NOT EXISTS internet_message_id TEXT;

-- Index pour charger efficacement les threads par conversation
CREATE INDEX IF NOT EXISTS idx_email_responses_conversation_id
  ON email_responses(conversation_id)
  WHERE conversation_id IS NOT NULL;

-- Index pour recherche par internet_message_id (identifiant unique)
CREATE INDEX IF NOT EXISTS idx_email_responses_internet_message_id
  ON email_responses(internet_message_id)
  WHERE internet_message_id IS NOT NULL;

-- Commentaires pour documentation
COMMENT ON COLUMN email_responses.conversation_id IS
  'Conversation ID Microsoft Graph de la réponse (peut différer de l''email original si créé comme nouveau message) - permet de charger son thread complet via Graph API';

COMMENT ON COLUMN email_responses.internet_message_id IS
  'Internet Message ID unique RFC 822 de la réponse - identifiant global du message email';
