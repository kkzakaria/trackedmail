-- Script de peuplement des followups pour les emails en statut pending ou max_reached

DO $$
DECLARE
  email_record RECORD;
  followup_templates TEXT[] := ARRAY[
    'Je me permets de revenir vers vous concernant ma proposition.',
    'Avez-vous eu l''occasion d''examiner ma dernière proposition ?',
    'Je reste à votre disposition pour toute information complémentaire.',
    'Je souhaiterais savoir si vous avez pu consulter mon message précédent.',
    'Puis-je avoir votre retour sur la proposition que je vous ai envoyée ?',
    'Je me permets de vous relancer concernant notre échange.',
    'Seriez-vous disponible pour en discuter prochainement ?'
  ];
  followup_num INT;
  followup_date TIMESTAMP;
  days_after_send INT;
  i INT;
BEGIN
  -- Pour chaque email avec followup_count > 0
  FOR email_record IN
    SELECT * FROM tracked_emails WHERE followup_count > 0
  LOOP
    -- Créer le nombre de followups défini dans followup_count
    FOR i IN 1..email_record.followup_count LOOP
      -- Calculer la date de relance (espacées de 3-7 jours)
      days_after_send := 3 + ((i - 1) * (3 + floor(random() * 5)::INT));
      followup_date := email_record.sent_at + (days_after_send || ' days')::INTERVAL;

      -- Insérer le followup
      INSERT INTO followups (
        tracked_email_id,
        followup_number,
        subject,
        body,
        scheduled_for,
        sent_at,
        status,
        microsoft_message_id
      ) VALUES (
        email_record.id,
        i,
        'Re: ' || email_record.subject,
        followup_templates[1 + floor(random() * array_length(followup_templates, 1))],
        followup_date,
        followup_date,
        'sent',
        'followup_' || gen_random_uuid()::TEXT
      );
    END LOOP;

    -- Mettre à jour last_followup_sent_at dans tracked_emails
    UPDATE tracked_emails
    SET last_followup_sent_at = email_record.sent_at + ((3 + ((email_record.followup_count - 1) * 5)) || ' days')::INTERVAL
    WHERE id = email_record.id;

  END LOOP;

  RAISE NOTICE '% followups créés', (SELECT COUNT(*) FROM followups);

END $$;

-- Afficher un résumé
SELECT
  te.status,
  COUNT(DISTINCT te.id) as emails_with_followups,
  COUNT(f.id) as total_followups,
  ROUND(AVG(te.followup_count), 2) as avg_followups_per_email
FROM tracked_emails te
LEFT JOIN followups f ON f.tracked_email_id = te.id
WHERE te.followup_count > 0
GROUP BY te.status
ORDER BY total_followups DESC;

-- Résumé global
SELECT
  COUNT(DISTINCT tracked_email_id) as emails_with_followups,
  COUNT(*) as total_followups,
  MIN(followup_number) as min_followup_num,
  MAX(followup_number) as max_followup_num
FROM followups;
