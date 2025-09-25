-- Test Script pour la Double Vérification de Sécurité dans followup-sender
-- Réinitialise et crée des données de test spécifiques

BEGIN;

-- 1. Nettoyer les données existantes (au cas où)
DELETE FROM email_responses;
DELETE FROM followups;
DELETE FROM manual_followups;
DELETE FROM tracked_emails;
DELETE FROM mailboxes;
DELETE FROM users;

-- 2. Créer un utilisateur de test
INSERT INTO users (id, email, role, created_at)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'test@company.com',
  'administrateur',
  NOW()
);

-- 3. Créer une mailbox de test
INSERT INTO mailboxes (id, email_address, display_name, microsoft_user_id, is_active, created_at)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  'sender@company.com',
  'Test Sender',
  'microsoft-user-123',
  true,
  NOW()
);

-- 4. Créer des emails de test avec différents scénarios

-- SCENARIO 1: Email sans réponse (followup doit être envoyé)
INSERT INTO tracked_emails (id, mailbox_id, sender_email, recipient_emails, subject, status, sent_at, microsoft_message_id, conversation_id, internet_message_id)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  '22222222-2222-2222-2222-222222222222',
  'sender@company.com',
  ARRAY['client1@external.com'],
  'Proposition commerciale - Safe Email',
  'pending',
  NOW() - INTERVAL '5 hours',
  'microsoft-msg-safe-123',
  'conversation-safe-123',
  'internet-msg-safe-123'
);

-- Followup programmé pour cet email safe
INSERT INTO followups (id, tracked_email_id, template_id, followup_number, subject, body, scheduled_for, status)
VALUES (
  '44444444-4444-4444-4444-444444444444',
  '33333333-3333-3333-3333-333333333333',
  NULL, -- Template sera null pour simplifier
  1,
  'Re: Proposition commerciale - Safe Email',
  'Bonjour, je reviens vers vous concernant ma proposition...',
  NOW() - INTERVAL '1 hour', -- Prêt à être envoyé
  'scheduled'
);

-- SCENARIO 2: Email AVEC réponse (followup doit être BLOQUÉ par sécurité)
INSERT INTO tracked_emails (id, mailbox_id, sender_email, recipient_emails, subject, status, sent_at, microsoft_message_id, conversation_id, internet_message_id)
VALUES (
  '55555555-5555-5555-5555-555555555555',
  '22222222-2222-2222-2222-222222222222',
  'sender@company.com',
  ARRAY['client2@external.com'],
  'Demande d''informations - DANGEROUS Email',
  'pending', -- Status encore pending (race condition simulée)
  NOW() - INTERVAL '6 hours',
  'microsoft-msg-danger-456',
  'conversation-danger-456',
  'internet-msg-danger-456'
);

-- Réponse reçue pour cet email (DEVRAIT BLOQUER LE FOLLOWUP)
INSERT INTO email_responses (id, tracked_email_id, microsoft_message_id, sender_email, subject, received_at, response_type)
VALUES (
  '66666666-6666-6666-6666-666666666666',
  '55555555-5555-5555-5555-555555555555',
  'microsoft-response-456',
  'client2@external.com',
  'Re: Demande d''informations - DANGEROUS Email',
  NOW() - INTERVAL '2 hours',
  'direct_reply'
);

-- Followup programmé MALGRÉ la réponse (cas de race condition)
INSERT INTO followups (id, tracked_email_id, template_id, followup_number, subject, body, scheduled_for, status)
VALUES (
  '77777777-7777-7777-7777-777777777777',
  '55555555-5555-5555-5555-555555555555',
  NULL,
  1,
  'Re: Demande d''informations - DANGEROUS Email',
  'Bonjour, je n''ai pas encore reçu de réponse...',
  NOW() - INTERVAL '30 minutes', -- Prêt à être envoyé
  'scheduled'
);

-- SCENARIO 3: Email avec réponse automatique (followup peut être envoyé selon logique)
INSERT INTO tracked_emails (id, mailbox_id, sender_email, recipient_emails, subject, status, sent_at, microsoft_message_id, conversation_id, internet_message_id)
VALUES (
  '88888888-8888-8888-8888-888888888888',
  '22222222-2222-2222-2222-222222222222',
  'sender@company.com',
  ARRAY['client3@external.com'],
  'Rendez-vous - Auto Response Email',
  'pending',
  NOW() - INTERVAL '3 hours',
  'microsoft-msg-auto-789',
  'conversation-auto-789',
  'internet-msg-auto-789'
);

-- Réponse automatique (out of office)
INSERT INTO email_responses (id, tracked_email_id, microsoft_message_id, sender_email, subject, received_at, response_type, is_auto_response)
VALUES (
  '99999999-9999-9999-9999-999999999999',
  '88888888-8888-8888-8888-888888888888',
  'microsoft-auto-response-789',
  'client3@external.com',
  'Automatic Reply: Out of Office',
  NOW() - INTERVAL '1 hour',
  'auto_reply',
  true
);

-- Followup programmé (devrait être bloqué car il y a une réponse, même automatique)
INSERT INTO followups (id, tracked_email_id, template_id, followup_number, subject, body, scheduled_for, status)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '88888888-8888-8888-8888-888888888888',
  NULL,
  1,
  'Re: Rendez-vous - Auto Response Email',
  'Bonjour, concernant notre rendez-vous...',
  NOW() - INTERVAL '10 minutes',
  'scheduled'
);

COMMIT;

-- Vérification des données créées
SELECT
  'SUMMARY' as type,
  (SELECT COUNT(*) FROM tracked_emails) as tracked_emails,
  (SELECT COUNT(*) FROM followups WHERE status = 'scheduled') as scheduled_followups,
  (SELECT COUNT(*) FROM email_responses) as responses;

-- Détail des scenarios
SELECT
  'SCENARIO DETAILS' as info,
  te.id,
  te.subject,
  te.status,
  CASE
    WHEN er.id IS NOT NULL THEN 'HAS_RESPONSE'
    ELSE 'NO_RESPONSE'
  END as response_status,
  CASE
    WHEN f.id IS NOT NULL THEN 'HAS_SCHEDULED_FOLLOWUP'
    ELSE 'NO_FOLLOWUP'
  END as followup_status,
  er.is_auto_response
FROM tracked_emails te
LEFT JOIN email_responses er ON te.id = er.tracked_email_id
LEFT JOIN followups f ON te.id = f.tracked_email_id AND f.status = 'scheduled'
ORDER BY te.subject;