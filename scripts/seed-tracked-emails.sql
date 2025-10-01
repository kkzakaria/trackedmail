-- Script de peuplement de la table tracked_emails avec des données de test
-- Génère environ 100 emails trackés avec des données réalistes

DO $$
DECLARE
  mailbox_ids UUID[] := ARRAY[
    '78b19a8f-55df-4f34-9bab-aefc357479af',
    '038478e7-29d6-4024-a098-ed659c85c2ab',
    '19a55aa9-be10-4064-8eb5-0b9489e1b64f',
    '5eb2fe58-d73d-4ff7-8cd2-1b920269735c',
    'c643e7c7-7bb2-46b4-bb2c-036c45d0e905'
  ];

  subjects TEXT[] := ARRAY[
    'Proposition commerciale - Solution CRM',
    'Demande de devis pour projet web',
    'Suivi de votre demande',
    'Nouvelle opportunité de collaboration',
    'Présentation de nos services',
    'Réunion de suivi - Projet X',
    'Votre projet nous intéresse',
    'Information sur notre offre',
    'Confirmation de rendez-vous',
    'Rappel - En attente de votre retour',
    'Proposition de partenariat',
    'Question technique sur votre produit',
    'Demande d''information complémentaire',
    'Offre spéciale - Tarif préférentiel',
    'Invitation à notre événement',
    'Catalogue produits 2025',
    'Solution adaptée à vos besoins',
    'Devis personnalisé joint',
    'Réponse à votre demande',
    'Mise à jour de votre dossier'
  ];

  recipient_domains TEXT[] := ARRAY[
    'client-alpha.fr',
    'beta-corp.com',
    'gamma-solutions.fr',
    'delta-industries.com',
    'epsilon-tech.fr',
    'zeta-consulting.com',
    'eta-services.fr',
    'theta-group.com',
    'iota-systems.fr',
    'kappa-partners.com'
  ];

  first_names TEXT[] := ARRAY[
    'Jean', 'Marie', 'Pierre', 'Sophie', 'Luc',
    'Claire', 'Thomas', 'Julie', 'Marc', 'Emma',
    'Nicolas', 'Laura', 'David', 'Sarah', 'Antoine'
  ];

  last_names TEXT[] := ARRAY[
    'Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert',
    'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau',
    'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia'
  ];

  statuses TEXT[] := ARRAY['pending', 'responded', 'stopped', 'max_reached', 'expired', 'bounced'];

  i INT;
  mailbox_id UUID;
  subject TEXT;
  recipient_email TEXT;
  sender_email TEXT;
  status TEXT;
  sent_date TIMESTAMP;
  days_ago INT;
  followup_count INT;
  response_count INT;
  requires_manual BOOLEAN;

BEGIN
  -- Générer 100 emails trackés
  FOR i IN 1..100 LOOP
    -- Sélectionner une mailbox aléatoire
    mailbox_id := mailbox_ids[1 + floor(random() * array_length(mailbox_ids, 1))];

    -- Sélectionner un sujet aléatoire
    subject := subjects[1 + floor(random() * array_length(subjects, 1))];

    -- Générer une adresse email de destinataire
    recipient_email := lower(
      first_names[1 + floor(random() * array_length(first_names, 1))] || '.' ||
      last_names[1 + floor(random() * array_length(last_names, 1))] || '@' ||
      recipient_domains[1 + floor(random() * array_length(recipient_domains, 1))]
    );

    -- Récupérer l'email de l'expéditeur depuis la mailbox
    SELECT email_address INTO sender_email
    FROM mailboxes
    WHERE id = mailbox_id;

    -- Générer un statut aléatoire avec une distribution réaliste
    -- 40% pending, 30% responded, 15% stopped, 10% max_reached, 5% autres
    CASE
      WHEN random() < 0.40 THEN status := 'pending';
      WHEN random() < 0.70 THEN status := 'responded';
      WHEN random() < 0.85 THEN status := 'stopped';
      WHEN random() < 0.95 THEN status := 'max_reached';
      ELSE status := statuses[1 + floor(random() * array_length(statuses, 1))];
    END CASE;

    -- Générer une date d'envoi entre 1 et 60 jours dans le passé
    days_ago := 1 + floor(random() * 60);
    sent_date := NOW() - (days_ago || ' days')::INTERVAL;

    -- Générer des compteurs de relances basés sur le statut
    CASE status
      WHEN 'pending' THEN
        followup_count := floor(random() * 3)::INT;
        response_count := 0;
        requires_manual := (random() < 0.1); -- 10% nécessitent révision manuelle
      WHEN 'responded' THEN
        followup_count := floor(random() * 2)::INT;
        response_count := 1 + floor(random() * 3)::INT;
        requires_manual := FALSE;
      WHEN 'stopped' THEN
        followup_count := floor(random() * 3)::INT;
        response_count := 0;
        requires_manual := FALSE;
      WHEN 'max_reached' THEN
        followup_count := 3;
        response_count := 0;
        requires_manual := (random() < 0.3); -- 30% nécessitent révision manuelle
      ELSE
        followup_count := floor(random() * 4)::INT;
        response_count := 0;
        requires_manual := (random() < 0.05);
    END CASE;

    -- Insérer l'email tracké
    INSERT INTO tracked_emails (
      mailbox_id,
      subject,
      recipient_emails,
      sender_email,
      status,
      sent_at,
      microsoft_message_id,
      conversation_id,
      internet_message_id,
      followup_count,
      requires_manual_review
    ) VALUES (
      mailbox_id,
      subject,
      ARRAY[recipient_email],
      sender_email,
      status,
      sent_date,
      'msg_' || gen_random_uuid()::TEXT,
      'conv_' || gen_random_uuid()::TEXT,
      '<' || gen_random_uuid()::TEXT || '@company.com>',
      followup_count,
      requires_manual
    );

  END LOOP;

  RAISE NOTICE '100 emails trackés créés avec succès';

END $$;

-- Afficher un résumé des données insérées
SELECT
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM tracked_emails
GROUP BY status
ORDER BY count DESC;

SELECT
  m.display_name,
  COUNT(te.id) as email_count
FROM mailboxes m
LEFT JOIN tracked_emails te ON te.mailbox_id = m.id
GROUP BY m.id, m.display_name
ORDER BY email_count DESC;
