-- Script de peuplement des réponses pour les emails ayant le statut "responded"

DO $$
DECLARE
  email_record RECORD;
  response_subjects TEXT[] := ARRAY[
    'Re: ',
    'RE: ',
    'Réponse: '
  ];
  response_contents TEXT[] := ARRAY[
    'Merci pour votre proposition. Je suis intéressé et souhaiterais en discuter davantage.',
    'Bonjour, votre offre m''intéresse. Pourriez-vous m''envoyer plus de détails ?',
    'Merci pour votre message. Je pense que nous pouvons envisager une collaboration.',
    'C''est une proposition intéressante. Quand serions-nous disponibles pour en parler ?',
    'J''ai bien reçu votre message. Je souhaite obtenir des informations complémentaires.',
    'Merci pour cette opportunité. Je vais étudier votre proposition et reviendrai vers vous.',
    'Bonjour, je suis disponible pour une réunion la semaine prochaine.',
    'Votre offre correspond à nos besoins. Planifions un rendez-vous.',
    'Merci pour le devis. Nous sommes intéressés et souhaitons aller plus loin.',
    'J''apprécie votre démarche. Pouvons-nous organiser un échange téléphonique ?'
  ];
  response_date TIMESTAMP;
  hours_after_send INT;
BEGIN
  -- Pour chaque email avec le statut "responded"
  FOR email_record IN
    SELECT * FROM tracked_emails WHERE status = 'responded'
  LOOP
    -- Générer une date de réponse entre 2h et 5 jours après l'envoi
    hours_after_send := 2 + floor(random() * 118)::INT; -- Entre 2h et 120h (5 jours)
    response_date := email_record.sent_at + (hours_after_send || ' hours')::INTERVAL;

    -- Insérer une réponse
    INSERT INTO email_responses (
      tracked_email_id,
      microsoft_message_id,
      conversation_id,
      sender_email,
      subject,
      body_preview,
      received_at,
      is_auto_response,
      response_type
    ) VALUES (
      email_record.id,
      'response_' || gen_random_uuid()::TEXT,
      email_record.conversation_id,
      email_record.recipient_emails[1], -- Le destinataire original devient l'expéditeur de la réponse
      response_subjects[1 + floor(random() * array_length(response_subjects, 1))] || email_record.subject,
      response_contents[1 + floor(random() * array_length(response_contents, 1))],
      response_date,
      FALSE,
      'direct_reply'
    );

    -- Mettre à jour responded_at dans tracked_emails
    UPDATE tracked_emails
    SET responded_at = response_date
    WHERE id = email_record.id;

  END LOOP;

  RAISE NOTICE '% réponses créées pour les emails avec statut "responded"',
    (SELECT COUNT(*) FROM email_responses);

END $$;

-- Afficher un résumé
SELECT
  te.status,
  COUNT(DISTINCT te.id) as emails_count,
  COUNT(er.id) as responses_count
FROM tracked_emails te
LEFT JOIN email_responses er ON er.tracked_email_id = te.id
GROUP BY te.status
ORDER BY emails_count DESC;
